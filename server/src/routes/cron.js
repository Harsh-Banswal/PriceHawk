/**
 * @file cron.js
 * @description Cron-triggered scrape runner endpoint protected by CRON_SECRET header.
 */

import express from 'express';
import config from '../config.js';
import logger from '../utils/logger.js';
import { runScrapeCycle } from '../scraper/runScrapeCycle.js';

const router = express.Router();

/**
 * Middleware enforcing x-cron-secret header check.
 */
function requireCronSecret(req, res, next) {
  const secretHeader = req.headers['x-cron-secret'] ||
    (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : null);

  if (!config.cronSecret || secretHeader !== config.cronSecret) {
    logger.warn('Unauthorized cron trigger attempt rejected');
    return res.status(401).json({
      error: 'Unauthorized: Invalid or missing x-cron-secret header',
    });
  }

  next();
}

/**
 * POST /api/cron/scrape
 * Runs runScrapeCycle and returns JSON summary: { scraped, succeeded, failed, durationMs }
 */
router.post('/scrape', requireCronSecret, async (req, res, next) => {
  try {
    logger.info('Authorized cron scrape triggered');
    const report = await runScrapeCycle();

    return res.json({
      scraped: report.total,
      succeeded: report.succeeded,
      failed: report.failed,
      durationMs: report.durationMs,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
