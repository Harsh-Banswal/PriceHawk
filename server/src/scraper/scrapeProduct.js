/**
 * @file scrapeProduct.js
 * @description Orchestrates navigation, Proof-of-Work waiting, price stabilization, and retry handling for a product page.
 *
 * REASONING:
 * 1. Autonomous In-Page Execution:
 *    We do NOT intercept or re-implement the site's WASM Proof-of-Work algorithm or decryption routine.
 *    Instead, we instruct Chromium to navigate to the product URL, allowing the site's client scripts
 *    to naturally fetch /api/challenge, calculate the PoW hash, obtain the session token,
 *    and decrypt the price payload into the DOM.
 *
 * 2. Whole-Page Retry Strategy:
 *    If networkidle drops, the 30-second token expires, or the price fails to settle, we do not retry
 *    sub-steps. A fresh goto is performed with exponential backoff + jitter via `withRetry()`.
 *
 * 3. Discriminated Result Contract:
 *    The returned object aligns strictly with the `scrape_logs` schema:
 *    - outcome: 'success' | 'success_after_retry' | 'failed_timeout' | 'failed_navigation' | 'failed_parse' | 'failed_validation'
 *    - reconciled: boolean
 *    - data: only populated on verified success
 */

import config from '../config.js';
import logger from '../utils/logger.js';
import { waitForStablePrice, PriceUnstableError } from './waitForStablePrice.js';
import { withRetry } from './retry.js';

/**
 * Navigates to a single product page, waits for DOM execution and stabilization,
 * and extracts validated pricing. Single-attempt execution.
 *
 * @param {import('playwright').Page} page
 * @param {string} productUrl
 * @param {Object} [options]
 * @returns {Promise<{
 *   price: number,
 *   mrp: number | null,
 *   discountPercent: number | null,
 *   stockStatus: string,
 *   reconciled: boolean,
 *   currency: string
 * }>}
 */
export async function navigateAndScrape(page, productUrl, options = {}) {
  // Increase default budget: PoW solve + session + decrypt + DOM settle takes 10-20s
  const navTimeout = options.navTimeoutMs || config.navTimeoutMs || 60000;
  const attemptStartTime = Date.now();

  if (options.onNavigateStart) {
    options.onNavigateStart({
      productUrl,
      attempt: options.currentAttempt || 1,
      timestamp: attemptStartTime,
    });
  }

  // Abort heavy media/font assets that do not affect DOM layout or WASM decryption
  await page
    .route('**/*.{png,jpg,jpeg,webp,gif,ico,woff,woff2}', (route) => route.abort())
    .catch(() => {});

  // 1. Navigate to product page — wait for domcontentloaded
  let response;
  try {
    response = await page.goto(productUrl, {
      waitUntil: 'domcontentloaded',
      timeout: navTimeout,
    });
    // Optionally wait briefly for price block element if remaining navigation budget allows
    const remainingForBlock = Math.max(0, navTimeout - (Date.now() - attemptStartTime));
    if (remainingForBlock > 100) {
      await page
        .locator('.price-block')
        .first()
        .waitFor({ state: 'attached', timeout: Math.min(2000, remainingForBlock) })
        .catch(() => {});
    }
  } catch (err) {
    const msg = err.message || '';
    if (msg.toLowerCase().includes('timeout')) {
      const timeoutErr = new Error(`Page navigation timed out after ${navTimeout}ms`);
      timeoutErr.code = 'ERR_NAVIGATION_TIMEOUT';
      throw timeoutErr;
    }
    const navErr = new Error(`Page navigation failed: ${msg}`);
    navErr.code = 'ERR_NAVIGATION_FAILED';
    throw navErr;
  }

  // Check HTTP response status
  if (response && response.status() >= 400) {
    const httpErr = new Error(`HTTP ${response.status()} returned for ${productUrl}`);
    httpErr.code = 'ERR_HTTP_STATUS';
    throw httpErr;
  }

  // Calculate remaining budget
  const elapsedNav = Date.now() - attemptStartTime;
  const remainingBudgetMs = navTimeout - elapsedNav;

  if (remainingBudgetMs <= 100) {
    const timeoutErr = new Error(
      `Attempt exhausted navigation budget (${elapsedNav}ms elapsed of ${navTimeout}ms)`
    );
    timeoutErr.code = 'ERR_NAVIGATION_TIMEOUT';
    throw timeoutErr;
  }

  // Price takes ~8-10s to decrypt and render after the reveal click (PoW + session + decrypt).
  // Stability window must be capped by the remaining navigation budget.
  const effectiveStabilityTimeout = Math.max(
    100,
    Math.min(options.stabilityTimeoutMs || 15000, remainingBudgetMs)
  );

  // 2. Trigger the price reveal widget
  try {
    const priceBlock = page.locator('.price-block').first();
    const isBlockVisible = await priceBlock.isVisible({ timeout: Math.min(500, remainingBudgetMs) }).catch(() => false);

    if (isBlockVisible) {
      // 2a. Dismiss cookie consent banner if present (click Accept cookies)
      for (let c = 1; c <= 3; c++) {
        const acceptBtn = page.locator('button[aria-label="Accept cookies"]').first();
        const isVisible = await acceptBtn.isVisible({ timeout: 200 }).catch(() => false);
        if (isVisible) {
          await acceptBtn.click({ timeout: 600 }).catch(() => {});
          await page.waitForTimeout(100);
        } else {
          break;
        }
      }

      // Ensure any remaining overlay elements are purged from DOM
      await page
        .evaluate(() => {
          document.querySelectorAll('.cookie-overlay, [class*="cookie"]').forEach((el) => el.remove());
        })
        .catch(() => {});

      await priceBlock.scrollIntoViewIfNeeded();
      const box = await priceBlock.boundingBox();

      if (box) {
        // Humanized mouse movement satisfying Ar({minMoves:8, minDwellMs:600})
        const startX = box.x + 30;
        const startY = box.y + 25;
        await page.mouse.move(startX, startY);
        for (let i = 1; i <= 9; i++) {
          await page.waitForTimeout(30);
          await page.mouse.move(startX + i * 12, startY + (i % 2) * 8);
        }
        await page.waitForTimeout(420); // 9 * 30ms + 420ms = 690ms >= minDwellMs:600
      }

      const revealBtn = page.locator('button[aria-label="Reveal price"]').first();

      const MAX_CLICK_ATTEMPTS = 6;
      for (let clickAttempt = 1; clickAttempt <= MAX_CLICK_ATTEMPTS; clickAttempt++) {
        const isIdle = await page
          .evaluate(() => {
            const el = document.querySelector('.price-block');
            return el ? el.classList.contains('price-idle') : false;
          })
          .catch(() => false);

        if (!isIdle) {
          // Click was processed — price loading started
          break;
        }

        // Purge overlay again in case it was re-injected
        await page
          .evaluate(() => {
            document.querySelectorAll('.cookie-overlay, [class*="cookie"]').forEach((el) => el.remove());
          })
          .catch(() => {});

        const isBtnVisible = await revealBtn.isVisible({ timeout: 500 }).catch(() => false);
        const isBtnDisabled = await revealBtn.isDisabled().catch(() => true);

        if (isBtnVisible && !isBtnDisabled) {
          // Trusted click produced by Playwright
          await revealBtn.click({ timeout: 2000 }).catch((clickErr) => {
            logger.debug(`Reveal click attempt ${clickAttempt} failed: ${clickErr.message}`);
          });
        }

        if (options.onRetry) {
          logger.debug(`Reveal click attempt ${clickAttempt} — waiting for idle to clear...`);
        }
        await page.waitForTimeout(700);
      }
    }
  } catch {
    // Continue — waitForStablePrice will detect if price never appeared
  }

  // 3. Wait for price to stabilize in DOM
  const remainingBudgetForStability = Math.max(100, navTimeout - (Date.now() - attemptStartTime));
  const finalStabilityTimeout = Math.min(effectiveStabilityTimeout, remainingBudgetForStability);

  let extraction;
  try {
    extraction = await waitForStablePrice(page, {
      ...options,
      pollIntervalMs: options.pollIntervalMs || 150,
      timeoutMs: finalStabilityTimeout,
      stabilityTimeoutMs: finalStabilityTimeout,
      minConsecutiveMatches: options.minConsecutiveMatches || 2,
      onSample: options.onSample,
    });
  } catch (err) {
    const totalElapsed = Date.now() - attemptStartTime;
    if (totalElapsed >= navTimeout - 200 || err.message?.toLowerCase().includes('timeout')) {
      const timeoutErr = new Error(
        `Scrape attempt timed out after ${totalElapsed}ms (budget: ${navTimeout}ms): ${err.message}`
      );
      timeoutErr.code = 'ERR_NAVIGATION_TIMEOUT';
      throw timeoutErr;
    }
    if (err instanceof PriceUnstableError) {
      err.code = 'ERR_PRICE_UNSTABLE';
    }
    throw err;
  }

  if (options.onExtraction) {
    options.onExtraction(extraction);
  }

  // 4. Validate extracted price existence
  if (!extraction || extraction.price === null || extraction.price <= 0) {
    const parseErr = new Error('No valid positive price element found in rendered DOM');
    parseErr.code = 'ERR_PRICE_NOT_FOUND';
    throw parseErr;
  }


  return {
    price: extraction.price,
    mrp: extraction.mrp,
    discountPercent: extraction.discountPercent,
    stockStatus: extraction.stockStatus,
    stockUnits: extraction.stockUnits || null,
    stockText: extraction.stockText || null,
    reconciled: extraction.reconciled,
    currency: 'INR',
  };
}

/**
 * Scrapes a product URL with full-page retry logic, returning a discriminated result.
 *
 * @param {import('playwright').Page} page
 * @param {string} productUrl
 * @param {Object} [options]
 * @returns {Promise<{
 *   outcome: 'success' | 'success_after_retry' | 'failed_timeout' | 'failed_navigation' | 'failed_parse' | 'failed_validation',
 *   reconciled: boolean,
 *   attemptCount: number,
 *   durationMs: number,
 *   errorMessage: string | null,
 *   data: {
 *     price: number,
 *     mrp: number | null,
 *     discountPercent: number | null,
 *     stockStatus: string,
 *     currency: string
 *   } | null
 * }>}
 */
export async function scrapeProductWithRetry(page, productUrl, options = {}) {
  const startTime = Date.now();
  const maxAttempts = options.maxAttempts || config.scrapeMaxAttempts || 6;
  let attemptCounter = 0;

  try {
    const { result, attemptCount } = await withRetry(
      () => {
        attemptCounter += 1;
        return navigateAndScrape(page, productUrl, {
          ...options,
          currentAttempt: attemptCounter,
        });
      },
      {
        maxAttempts,
        baseDelayMs: 1000,
        onRetry: (err, attempt, delayMs) => {
          if (options.onRetry) {
            options.onRetry(err, attempt, delayMs);
          }
          logger.warn(`Scrape attempt ${attempt} failed for ${productUrl}: ${err.message}. Retrying in ${delayMs}ms...`);
        },
      }
    );

    const durationMs = Date.now() - startTime;
    const outcome = attemptCount === 1 ? 'success' : 'success_after_retry';

    return {
      outcome,
      reconciled: true,
      attemptCount,
      durationMs,
      errorMessage: null,
      data: result,
    };
  } catch (err) {
    const durationMs = Date.now() - startTime;
    const attemptCount = err.attemptCount || attemptCounter || maxAttempts;

    // Discriminate outcome matching scrape_logs enum:
    // 'failed_timeout' | 'failed_navigation' | 'failed_parse' | 'failed_validation'
    let outcome = 'failed_navigation';

    if (
      err.code === 'ERR_NAVIGATION_TIMEOUT' ||
      err.message?.toLowerCase().includes('timeout') ||
      err.message?.toLowerCase().includes('timed out')
    ) {
      outcome = 'failed_timeout';
    } else if (err.code === 'ERR_HTTP_STATUS' || err.code === 'ERR_NAVIGATION_FAILED') {
      outcome = 'failed_navigation';
    } else if (err.code === 'ERR_PRICE_UNSTABLE' || err.code === 'ERR_PRICE_NOT_FOUND') {
      outcome = 'failed_parse';
    }

    logger.error(`Scrape terminated with outcome [${outcome}] for ${productUrl}: ${err.message}`, {
      attemptCount,
      durationMs,
    });

    return {
      outcome,
      reconciled: false,
      attemptCount,
      durationMs,
      errorMessage: err.message,
      data: null,
    };
  }
}

export default {
  navigateAndScrape,
  scrapeProductWithRetry,
};
