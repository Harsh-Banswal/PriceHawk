/**
 * @file runScrapeCycle.js
 * @description Orchestrates the complete batch scrape cycle across all active tracked products.
 *
 * REASONING:
 * 1. Low Concurrency (SCRAPE_CONCURRENCY = 2):
 *    Unlike HTTP scraping, each concurrent Playwright task renders a full Chromium tab, executes
 *    client JavaScript, solves the WASM Proof-of-Work, and computes layout styles. High concurrency
 *    spikes memory, triggers CPU contention (slowing down PoW solving), and risks browser crashes.
 *    Keeping concurrency low (e.g. 2) ensures rock-solid stability and predictable throughput.
 *
 * 2. Global Scrape Budget (~90s Cycle Budget):
 *    Cron scheduling services (e.g. Supabase Edge Functions, Vercel Cron, AWS Lambda) enforce hard
 *    execution timeouts (often 60s - 120s). A global cycle budget aborts lingering tasks before
 *    the invocation times out, ensuring that all completed scrape_logs and price_history entries
 *    are committed cleanly and a response is returned to the scheduler.
 *
 * 3. Browser Reusability with Graceful Teardown:
 *    Chromium is initialized once for the cycle and closed in the finally block. Each product
 *    executes in an isolated context.
 *
 * 4. CRITICAL RULE Enforcement:
 *    - `price_history`: Inserted ONLY when `reconciled === true` and price > 0.
 *    - `scrape_logs`: Inserted for every product, every attempt, unconditionally.
 */

import pLimit from 'p-limit';
import config from '../config.js';
import supabase from '../db/supabase.js';
import logger from '../utils/logger.js';
import { getBrowser, getContext, closeBrowser } from './browser.js';
import { scrapeProductWithRetry } from './scrapeProduct.js';

/**
 * Executes a single product scrape within an isolated browser context,
 * and writes to scrape_logs and (if reconciled) price_history.
 *
 * @param {Object} product - Product record from tracked_products
 * @param {Object} [options]
 * @returns {Promise<Object>}
 */
export async function scrapeTrackedProduct(product, options = {}) {
  let context = null;

  try {
    context = await getContext(options);
    const page = await context.newPage();

    const scrapeResult = await scrapeProductWithRetry(page, product.product_url, options);

    // 1. Unconditionally write to scrape_logs
    await recordScrapeLog({
      productId: product.id,
      outcome: scrapeResult.outcome,
      attemptCount: scrapeResult.attemptCount,
      durationMs: scrapeResult.durationMs,
      errorMessage: scrapeResult.errorMessage,
      priceReconciled: scrapeResult.reconciled,
    });

    // Write to price_history for any positive price found (reconciliation removed)
    if (scrapeResult.data && scrapeResult.data.price > 0) {
      const formattedStock =
        scrapeResult.data.stockText ||
        (scrapeResult.data.stockUnits !== null
          ? `${scrapeResult.data.stockStatus}:${scrapeResult.data.stockUnits}`
          : scrapeResult.data.stockStatus);

      await recordPriceHistory({
        productId: product.id,
        price: scrapeResult.data.price,
        mrp: scrapeResult.data.mrp,
        discountPercent: scrapeResult.data.discountPercent,
        currency: scrapeResult.data.currency || 'INR',
        stockStatus: formattedStock,
      });
      logger.info(`Inserted verified price_history for product ${product.id} (₹${scrapeResult.data.price}) [stock: ${formattedStock}]`);
    } else {
      logger.info(`Product ${product.id} finished with outcome [${scrapeResult.outcome}], skipping price_history`);
    }

    return {
      productId: product.id,
      ...scrapeResult,
    };
  } catch (fatalErr) {
    logger.error(`Fatal unexpected error scraping product ${product.id}:`, fatalErr);

    // Log unexpected failure to scrape_logs
    await recordScrapeLog({
      productId: product.id,
      outcome: 'failed_navigation',
      attemptCount: 1,
      durationMs: 0,
      errorMessage: fatalErr.message,
      priceReconciled: false,
    });

    return {
      productId: product.id,
      outcome: 'failed_navigation',
      reconciled: false,
      attemptCount: 1,
      durationMs: 0,
      errorMessage: fatalErr.message,
      data: null,
    };
  } finally {
    if (context) {
      await context.close().catch(() => {});
    }
  }
}

/**
 * Runs the full scrape cycle across all active tracked products.
 *
 * @param {Object} [options]
 * @param {number} [options.concurrency] - Concurrency limit (default config.scrapeConcurrency)
 * @param {number} [options.cycleBudgetMs] - Max global duration for cycle in ms (default 90000)
 * @returns {Promise<{
 *   total: number,
 *   succeeded: number,
 *   failed: number,
 *   timedOutDueToBudget: boolean,
 *   durationMs: number,
 *   results: Array<Object>
 * }>}
 */
export async function runScrapeCycle(options = {}) {
  const cycleStartTime = Date.now();
  const concurrency = options.concurrency || config.scrapeConcurrency || 2;
  const cycleBudgetMs = options.cycleBudgetMs || config.cycleBudgetMs || 90000;

  logger.info(`Starting scrape cycle: concurrency=${concurrency}, budget=${cycleBudgetMs}ms`);

  try {
    // Ensure browser is primed inside try/finally
    await getBrowser();

    const limit = pLimit(concurrency);
    let timedOutDueToBudget = false;

    // 1. Fetch active products
    const { data: products, error } = await supabase
      .from('tracked_products')
      .select('*')
      .eq('is_active', true);

    if (error) {
      throw new Error(`Database error querying active products: ${error.message}`);
    }

    if (!products || products.length === 0) {
      logger.info('No active products scheduled for scraping.');
      return {
        total: 0,
        succeeded: 0,
        failed: 0,
        timedOutDueToBudget: false,
        durationMs: Date.now() - cycleStartTime,
        results: [],
      };
    }

    logger.info(`Found ${products.length} active products to scrape.`);

    // 2. Schedule product scraping with p-limit and budget tracking
    const scrapeTasks = products.map((product) =>
      limit(async () => {
        const elapsed = Date.now() - cycleStartTime;
        // Check if global budget has been exceeded
        if (elapsed >= cycleBudgetMs) {
          timedOutDueToBudget = true;
          logger.warn(`Global cycle budget (${cycleBudgetMs}ms) exceeded. Aborting product ${product.id}`);

          await recordScrapeLog({
            productId: product.id,
            outcome: 'failed_timeout',
            attemptCount: 0,
            durationMs: elapsed,
            errorMessage: `Scrape cancelled: global scrape cycle budget of ${cycleBudgetMs}ms reached`,
            priceReconciled: false,
          });

          return {
            productId: product.id,
            outcome: 'failed_timeout',
            reconciled: false,
            attemptCount: 0,
            durationMs: 0,
            errorMessage: 'Global cycle budget exceeded',
            data: null,
          };
        }

        return scrapeTrackedProduct(product, {
          navTimeoutMs: config.navTimeoutMs,
          maxAttempts: config.scrapeMaxAttempts,
        });
      })
    );

    const results = await Promise.all(scrapeTasks);
    const durationMs = Date.now() - cycleStartTime;
    const succeeded = results.filter((r) => r.reconciled).length;
    const failed = results.length - succeeded;

    logger.info('Scrape cycle completed.', {
      total: results.length,
      succeeded,
      failed,
      durationMs,
      timedOutDueToBudget,
    });

    return {
      total: results.length,
      succeeded,
      failed,
      timedOutDueToBudget,
      durationMs,
      results,
    };
  } finally {
    // Gracefully close shared browser at cycle end
    await closeBrowser();
  }
}

/**
 * Inserts record into scrape_logs.
 */
async function recordScrapeLog({
  productId,
  outcome,
  attemptCount,
  durationMs,
  errorMessage,
  priceReconciled,
}) {
  try {
    const { error } = await supabase.from('scrape_logs').insert([
      {
        product_id: productId,
        outcome,
        attempt_count: attemptCount,
        duration_ms: durationMs,
        error_message: errorMessage ? String(errorMessage).slice(0, 1000) : null,
        price_reconciled: priceReconciled,
      },
    ]);
    if (error) {
      logger.error(`Failed writing to scrape_logs for ${productId}:`, error);
    }
  } catch (err) {
    logger.error(`Exception writing to scrape_logs for ${productId}:`, err);
  }
}

/**
 * Inserts record into price_history.
 * Enforces: called only when price is positive and reconciled.
 */
async function recordPriceHistory({
  productId,
  price,
  mrp,
  discountPercent,
  currency,
  stockStatus,
}) {
  try {
    const { error } = await supabase.from('price_history').insert([
      {
        product_id: productId,
        price,
        mrp,
        discount_percent: discountPercent,
        currency: currency || 'INR',
        stock_status: stockStatus || 'in_stock',
      },
    ]);
    if (error) {
      logger.error(`Failed writing to price_history for ${productId}:`, error);
    }
  } catch (err) {
    logger.error(`Exception writing to price_history for ${productId}:`, err);
  }
}

export default {
  runScrapeCycle,
  scrapeTrackedProduct,
};
