import pLimit from 'p-limit';
import config from '../config.js';
import supabase from '../db/supabase.js';
import logger from '../utils/logger.js';
import { scrapeProductPage } from './scraper.js';
import { reconcilePrice } from './reconciler.js';

// Setup concurrency limiter using p-limit
const limit = pLimit(config.scrapeConcurrency);

/**
 * Scrapes a single tracked product, enforces retries, reconciles price,
 * and writes to scrape_logs and price_history adhering strictly to the CRITICAL RULE.
 *
 * CRITICAL RULE:
 * price_history gets a row ONLY when a scrape produces a price that passes reconciliation
 * against MRP and discount. Every other outcome writes to scrape_logs only.
 * Never write 0, null, or a carried-forward price.
 *
 * @param {Object} product
 * @param {string} product.id
 * @param {string} product.product_url
 * @returns {Promise<{
 *   productId: string,
 *   outcome: string,
 *   priceReconciled: boolean,
 *   attemptCount: number,
 *   durationMs: number,
 *   priceInserted: boolean
 * }>}
 */
export async function scrapeProduct(product) {
  const startTime = Date.now();
  let attemptCount = 0;
  let scrapeResult = null;
  let lastErrorType = 'failed_navigation';
  let lastErrorMessage = 'Unknown scrape failure';

  // Retry loop up to SCRAPE_MAX_ATTEMPTS
  while (attemptCount < config.scrapeMaxAttempts) {
    attemptCount += 1;
    logger.info(`Scraping product ${product.id} (Attempt ${attemptCount}/${config.scrapeMaxAttempts})`, {
      url: product.product_url,
    });

    scrapeResult = await scrapeProductPage(product.product_url);

    if (scrapeResult.success) {
      break;
    }

    lastErrorType = scrapeResult.errorType || 'failed_navigation';
    lastErrorMessage = scrapeResult.errorMessage || 'Scrape attempt failed';

    logger.warn(`Attempt ${attemptCount} failed for product ${product.id}: ${lastErrorMessage}`);

    // If more attempts remain, back off briefly
    if (attemptCount < config.scrapeMaxAttempts) {
      await new Promise((res) => setTimeout(res, 1000 * attemptCount));
    }
  }

  const durationMs = Date.now() - startTime;

  // Case 1: Page fetching/parsing failed after all attempts
  if (!scrapeResult || !scrapeResult.success || !scrapeResult.data) {
    const outcome = lastErrorType; // 'failed_timeout' | 'failed_navigation' | 'failed_parse'

    logger.error(`Scraping failed for product ${product.id} with outcome: ${outcome}`, {
      durationMs,
      attemptCount,
      error: lastErrorMessage,
    });

    // CRITICAL RULE: Write to scrape_logs ONLY. Never write to price_history.
    await writeScrapeLog({
      productId: product.id,
      outcome,
      attemptCount,
      durationMs,
      errorMessage: lastErrorMessage,
      priceReconciled: false,
    });

    return {
      productId: product.id,
      outcome,
      priceReconciled: false,
      attemptCount,
      durationMs,
      priceInserted: false,
    };
  }

  // Case 2: Data extracted from page -> Reconcile against MRP and discount
  const extracted = scrapeResult.data;
  const reconciliation = reconcilePrice({
    price: extracted.price,
    mrp: extracted.mrp,
    discountPercent: extracted.discount_percent,
    isCarriedForward: false, // Explicitly false: never carry forward prices
  });

  // If price fails reconciliation:
  if (!reconciliation.reconciled) {
    const outcome = 'failed_validation';
    const validationError = reconciliation.reason || 'Price failed reconciliation against MRP and discount';

    logger.warn(`Reconciliation failed for product ${product.id}: ${validationError}`, {
      extracted,
    });

    // CRITICAL RULE: Write to scrape_logs ONLY. Never write to price_history.
    await writeScrapeLog({
      productId: product.id,
      outcome,
      attemptCount,
      durationMs,
      errorMessage: validationError,
      priceReconciled: false,
    });

    return {
      productId: product.id,
      outcome,
      priceReconciled: false,
      attemptCount,
      durationMs,
      priceInserted: false,
    };
  }

  // Case 3: Reconciled successfully!
  const outcome = attemptCount === 1 ? 'success' : 'success_after_retry';

  logger.info(`Reconciliation passed for product ${product.id}`, {
    price: reconciliation.price,
    mrp: reconciliation.mrp,
    discountPercent: reconciliation.discountPercent,
    outcome,
  });

  // Write to scrape_logs
  await writeScrapeLog({
    productId: product.id,
    outcome,
    attemptCount,
    durationMs,
    errorMessage: null,
    priceReconciled: true,
  });

  // Write to price_history ONLY on reconciled success
  await writePriceHistory({
    productId: product.id,
    price: reconciliation.price,
    mrp: reconciliation.mrp,
    discountPercent: reconciliation.discountPercent,
    currency: extracted.currency || 'INR',
    stockStatus: extracted.stock_status || 'in_stock',
  });

  return {
    productId: product.id,
    outcome,
    priceReconciled: true,
    attemptCount,
    durationMs,
    priceInserted: true,
  };
}

/**
 * Inserts a log entry into scrape_logs table.
 */
async function writeScrapeLog({
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
        error_message: errorMessage,
        price_reconciled: priceReconciled,
      },
    ]);

    if (error) {
      logger.error(`Error inserting into scrape_logs for product ${productId}:`, error);
    }
  } catch (err) {
    logger.error(`Exception writing to scrape_logs for product ${productId}:`, err);
  }
}

/**
 * Inserts a verified row into price_history table.
 * ONLY called when price reconciliation succeeds.
 */
async function writePriceHistory({
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
        currency,
        stock_status: stockStatus,
      },
    ]);

    if (error) {
      logger.error(`Error inserting into price_history for product ${productId}:`, error);
    }
  } catch (err) {
    logger.error(`Exception writing to price_history for product ${productId}:`, err);
  }
}

/**
 * Concurrently scrapes active products respecting SCRAPE_CONCURRENCY.
 */
export async function scrapeActiveProducts(options = {}) {
  logger.info('Querying active products for scrape cycle...');

  const { data: products, error } = await supabase
    .from('tracked_products')
    .select('*')
    .eq('is_active', true);

  if (error) {
    logger.error('Failed to retrieve active products:', error);
    throw new Error(`Database error fetching active products: ${error.message}`);
  }

  if (!products || products.length === 0) {
    logger.info('No active products found to scrape.');
    return [];
  }

  logger.info(`Starting scrape batch for ${products.length} products with concurrency ${config.scrapeConcurrency}`);

  const tasks = products.map((product) => limit(() => scrapeProduct(product)));
  const results = await Promise.all(tasks);

  logger.info('Completed scrape batch.', {
    total: results.length,
    successes: results.filter((r) => r.priceInserted).length,
    failures: results.filter((r) => !r.priceInserted).length,
  });

  return results;
}

/**
 * Scrapes a single product by its UUID.
 */
export async function scrapeProductById(productId) {
  const { data: product, error } = await supabase
    .from('tracked_products')
    .select('*')
    .eq('id', productId)
    .single();

  if (error || !product) {
    throw new Error(`Product not found with id ${productId}`);
  }

  return scrapeProduct(product);
}

export default {
  scrapeProduct,
  scrapeProductById,
  scrapeActiveProducts,
};
