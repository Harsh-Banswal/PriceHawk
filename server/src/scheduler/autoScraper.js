/**
 * @file autoScraper.js
 * @description In-server continuous background price tracking daemon and persistent auto-retry scheduler.
 *
 * FEATURES:
 * 1. Autonomous Background Polling:
 *    Automatically checks and scrapes monitored products on a recurring schedule without requiring
 *    manual user intervention or external cron pings.
 * 2. Persistent Auto-Retry:
 *    If a product's scrape fails or price is missing (even after exhausting in-flight attempts),
 *    the scheduler automatically re-queues it for rapid retry in the next cycle until a verified
 *    reconciled price is obtained.
 * 3. Real-Time Price Change Detection:
 *    Detects price fluctuations (e.g. ₹20,000 -> ₹10,000) and commits timestamped entries to
 *    Supabase `price_history`, updating charts and 24h deltas for the live UI.
 */

import supabase from '../db/supabase.js';
import logger from '../utils/logger.js';
import { scrapeTrackedProduct } from '../scraper/runScrapeCycle.js';
import { invalidateCache } from '../utils/priceCache.js';

let schedulerTimer = null;
let isCycleRunning = false;
let lastCycleTime = null;
let cycleCount = 0;

// Configurable cycle check interval (default 3 minutes for responsive updates)
const CHECK_INTERVAL_MS = parseInt(process.env.AUTO_SCRAPE_INTERVAL_MS || '180000', 10);

/**
 * Runs a single autonomous background tracking & auto-retry cycle.
 */
export async function runAutoScrapeCycle() {
  if (isCycleRunning) {
    logger.debug('Auto-scraper cycle already in progress, skipping overlapping run.');
    return { skipped: true, reason: 'cycle_in_progress' };
  }

  isCycleRunning = true;
  lastCycleTime = new Date().toISOString();
  cycleCount += 1;

  try {
    logger.info(`[AutoScraper] Starting cycle #${cycleCount}...`);

    // 1. Fetch active tracked products
    const { data: products, error } = await supabase
      .from('tracked_products')
      .select('*')
      .eq('is_active', true);

    if (error || !products || products.length === 0) {
      logger.debug('[AutoScraper] No active products to scrape.');
      return { total: 0, scraped: 0 };
    }

    const now = Date.now();
    const toScrape = [];

    // 2. Identify products needing scrape or retry
    for (const product of products) {
      // Check latest scrape log & price history
      const { data: latestLogs } = await supabase
        .from('scrape_logs')
        .select('*')
        .eq('product_id', product.id)
        .order('created_at', { ascending: false })
        .limit(1);

      const latestLog = latestLogs && latestLogs.length > 0 ? latestLogs[0] : null;

      const { data: latestPrices } = await supabase
        .from('price_history')
        .select('*')
        .eq('product_id', product.id)
        .order('scraped_at', { ascending: false })
        .limit(1);

      const latestPrice = latestPrices && latestPrices.length > 0 ? latestPrices[0] : null;

      const isFailedOrMissing =
        !latestPrice ||
        !latestPrice.price ||
        (latestLog && latestLog.outcome && latestLog.outcome.startsWith('failed')) ||
        (latestLog && latestLog.price_reconciled === false);

      const intervalMs = (product.scrape_interval_minutes || 120) * 60 * 1000;
      const lastScrapedTime = latestPrice ? new Date(latestPrice.scraped_at).getTime() : 0;
      const isDue = now - lastScrapedTime >= intervalMs;

      // Priority 1: Persistent auto-retry if price missing or previous scrape failed
      // Priority 2: Periodic schedule due
      if (isFailedOrMissing || isDue) {
        toScrape.push({
          product,
          reason: isFailedOrMissing ? 'auto_retry_missing_price' : 'schedule_due',
          lastPrice: latestPrice ? latestPrice.price : null,
        });
      }
    }

    if (toScrape.length === 0) {
      logger.debug('[AutoScraper] All monitored products are up to date and healthy.');
      return { total: products.length, scraped: 0 };
    }

    logger.info(`[AutoScraper] Found ${toScrape.length} products to scrape/retry:`, toScrape.map(t => `${t.product.name} (${t.reason})`));

    // 3. Sequentially scrape targets (or with concurrency of 2)
    const results = [];
    for (const item of toScrape) {
      try {
        logger.info(`[AutoScraper] Scraping ${item.product.name} [SKU ${item.product.store_product_id}] (${item.reason})...`);
        const res = await scrapeTrackedProduct(item.product);
        
        // Log price changes
        if (res.reconciled && res.data && res.data.price) {
          if (item.lastPrice && item.lastPrice !== res.data.price) {
            logger.info(`[AutoScraper] PRICE CHANGED for ${item.product.name}: ₹${item.lastPrice} -> ₹${res.data.price}`);
          }
          // Invalidate cache so the dashboard immediately reflects the new price
          invalidateCache();
        }

        results.push(res);
      } catch (itemErr) {
        logger.error(`[AutoScraper] Error scraping ${item.product.id}:`, itemErr);
      }
    }

    logger.info(`[AutoScraper] Cycle #${cycleCount} finished. Processed ${results.length} products.`);
    return {
      total: products.length,
      scraped: results.length,
      results,
    };
  } catch (err) {
    logger.error('[AutoScraper] Unexpected error in background cycle:', err);
    return { error: err.message };
  } finally {
    isCycleRunning = false;
  }
}

/**
 * Starts the continuous background scraper.
 */
export function startAutoScraper(initialDelayMs = 10000) {
  if (schedulerTimer) {
    logger.warn('[AutoScraper] Scheduler already running.');
    return;
  }

  logger.info(`[AutoScraper] Starting background scraper daemon (interval: ${CHECK_INTERVAL_MS / 1000}s, initial delay: ${initialDelayMs / 1000}s)`);

  // First run after initial delay
  setTimeout(() => {
    runAutoScrapeCycle().catch((err) => logger.error('[AutoScraper] Initial cycle error:', err));
  }, initialDelayMs);

  // Periodic recurring timer
  schedulerTimer = setInterval(() => {
    runAutoScrapeCycle().catch((err) => logger.error('[AutoScraper] Recurring cycle error:', err));
  }, CHECK_INTERVAL_MS);
}

/**
 * Stops the continuous background scraper.
 */
export function stopAutoScraper() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
    logger.info('[AutoScraper] Background scraper daemon stopped.');
  }
}

/**
 * Returns telemetry regarding background scheduler status.
 */
export function getSchedulerStatus() {
  return {
    isRunning: schedulerTimer !== null,
    isCycleRunning,
    intervalMs: CHECK_INTERVAL_MS,
    lastCycleTime,
    cycleCount,
  };
}

export default {
  startAutoScraper,
  stopAutoScraper,
  runAutoScrapeCycle,
  getSchedulerStatus,
};
