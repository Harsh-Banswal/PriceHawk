import express from 'express';
import config from '../config.js';
import logger from '../utils/logger.js';
import supabase from '../db/supabase.js';
import { runScrapeCycle, scrapeTrackedProduct } from '../scraper/runScrapeCycle.js';
import { invalidateCache } from '../utils/priceCache.js';

const router = express.Router();

/**
 * Middleware to verify CRON_SECRET for automated scrape runs
 */
function verifyCronSecret(req, res, next) {
  const secret = req.headers['x-cron-secret'] ||
    (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : null);

  if (!config.cronSecret || secret !== config.cronSecret) {
    logger.warn('Unauthorized cron scrape attempt rejected');
    return res.status(401).json({ error: 'Unauthorized: Invalid or missing cron secret' });
  }
  next();
}

/**
 * POST /api/scrape/product/:id
 * Manually trigger a scrape for a specific tracked product
 */
router.post('/product/:id', async (req, res) => {
  const { id } = req.params;

  try {
    logger.info(`Manual scrape triggered for product ID: ${id}`);
    const { data: product, error } = await supabase
      .from('tracked_products')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !product) {
      return res.status(404).json({ error: `Product not found with id ${id}` });
    }

    const result = await scrapeTrackedProduct(product);

    // Invalidate price cache so next dashboard load reflects fresh scraped price
    if (result && result.reconciled) {
      invalidateCache();
    }

    return res.json({
      message: 'Scrape completed',
      result,
    });
  } catch (err) {
    logger.error(`Manual scrape failed for product ${id}:`, err);
    return res.status(500).json({
      error: 'Scrape execution failed',
      message: err.message,
    });
  }
});

/**
 * POST /api/scrape/all
 * Trigger scrape cycle across all active tracked products from frontend dashboard
 */
router.post('/all', async (req, res) => {
  try {
    logger.info('Manual batch scrape triggered from dashboard UI');
    const cycleReport = await runScrapeCycle();

    // Invalidate price cache after any successful batch scrape
    if (cycleReport && cycleReport.succeeded > 0) {
      invalidateCache();
    }

    return res.json({
      message: 'Batch scrape cycle completed',
      report: cycleReport,
    });
  } catch (err) {
    logger.error('Batch scrape execution failed:', err);
    return res.status(500).json({
      error: 'Batch scrape failed',
      message: err.message,
    });
  }
});

/**
 * POST /api/scrape/cron
 * Scheduled cron job trigger to scrape active products
 * Protected by CRON_SECRET header
 */
router.post('/cron', verifyCronSecret, async (req, res) => {
  try {
    logger.info('Cron scrape triggered for active products via runScrapeCycle');
    const cycleReport = await runScrapeCycle();

    return res.json({
      message: 'Scrape cycle executed successfully',
      report: cycleReport,
    });
  } catch (err) {
    logger.error('Cron scrape execution failed:', err);
    return res.status(500).json({
      error: 'Cron scrape batch failed',
      message: err.message,
    });
  }
});

/**
 * GET /api/scrape/status
 * Returns background auto-scraper status and telemetry
 */
router.get('/status', async (req, res) => {
  const { getSchedulerStatus } = await import('../scheduler/autoScraper.js');
  const { getCacheTelemetry } = await import('../utils/priceCache.js');
  return res.json({
    status: 'ok',
    scheduler: getSchedulerStatus(),
    cache: getCacheTelemetry(),
  });
});

export default router;
