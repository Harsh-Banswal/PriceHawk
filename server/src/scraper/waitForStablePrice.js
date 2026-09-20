/**
 * @file waitForStablePrice.js
 * @description Polls and waits for animated or computed price elements to settle into a stable state.
 *
 * REASONING:
 * 1. Animated / Output Tag Semantics:
 *    The store's /api/products/:id/layout specifies priceTag as "output". Once the client-side
 *    JavaScript finishes the Proof-of-Work and decrypts the price payload, the DOM may undergo
 *    number ticker animations, progressive element insertion, or multi-frame DOM re-assembly.
 *
 * 2. Why Fixed sleep() is Forbidden:
 *    A hardcoded sleep (e.g. sleep(2000)) introduces severe latency during batch scrapes and
 *    fails nondeterministically when network or CPU latency delays decryption.
 *
 * 3. Polling and Stabilization Contract:
 *    We sample the extracted price every ~150ms for up to ~6000ms. The value is considered stable
 *    only when two consecutive reads yield identical, non-null, positive price values.
 *    If the value continues fluctuating or never appears within 6s, a distinguishable
 *    `PriceUnstableError` is thrown to trigger an upstream retry.
 */

import { extractFromPage } from './priceExtractor.js';

export class PriceUnstableError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'PriceUnstableError';
    this.code = 'ERR_PRICE_UNSTABLE';
    this.details = details;
  }
}

/**
 * Polls the page until the extracted price settles stably across two consecutive reads.
 *
 * @param {import('playwright').Page} page - Active Playwright page
 * @param {Object} [options]
 * @param {number} [options.pollIntervalMs=150] - Interval between price extraction polls
 * @param {number} [options.timeoutMs=6000] - Total time budget to wait for stabilization
 * @returns {Promise<Awaited<ReturnType<typeof extractFromPage>>>} - The stable extraction result
 * @throws {PriceUnstableError} If price does not stabilize within timeoutMs
 */
export async function waitForStablePrice(page, options = {}) {
  const pollIntervalMs = options.pollIntervalMs || 60;
  const timeoutMs = options.timeoutMs ?? options.stabilityTimeoutMs ?? 6000;
  const minConsecutiveMatches = options.minConsecutiveMatches || 2; // Requires 3 consecutive identical reads
  const startTime = Date.now();

  let previousTuple = null;
  let consecutiveMatches = 0;
  let lastExtraction = null;
  const recordedSamples = [];
  let tryAgainCount = 0;

  while (Date.now() - startTime < timeoutMs) {
    try {
      lastExtraction = await extractFromPage(page);
      const currentPrice = lastExtraction.price;
      const currentMrp = lastExtraction.mrp;
      const currentDiscount = lastExtraction.discountPercent;
      const currentReconciled = lastExtraction.reconciled;

      const elapsed = Date.now() - startTime;
      recordedSamples.push({
        time: elapsed,
        price: currentPrice,
        mrp: currentMrp,
        discount: currentDiscount,
        reconciled: currentReconciled,
      });

      if (options.onSample) {
        options.onSample({
          elapsed,
          price: currentPrice,
          rawTexts: lastExtraction.rawTexts,
          mrp: currentMrp,
          discountPercent: currentDiscount,
          reconciled: currentReconciled,
        });
      }

      // Must have a valid positive price
      if (currentPrice !== null && currentPrice > 0) {
        const tupleKey = `${currentPrice}_${currentMrp}_${currentDiscount}`;

        if (previousTuple !== null && tupleKey === previousTuple) {
          consecutiveMatches += 1;

          // Require at least minConsecutiveMatches identical readings (spanning >= 240ms)
          // to guard against landing on an intermediate digit-ticker animation frame by chance.
          if (consecutiveMatches >= minConsecutiveMatches) {
            // Price is stable — return immediately, no reconciliation check needed.
            return lastExtraction;
          }
        } else {
          consecutiveMatches = 0;
          previousTuple = tupleKey;
        }
      } else {
        consecutiveMatches = 0;
        previousTuple = null;
      }
      // Check for in-page failure state (e.g. challenge_failed, upstream 500, 503)
      if (currentPrice === null && elapsed > 500) {
        const errorState = await page
          .evaluate(() => {
            const substatus = document.querySelector('.price-substatus')?.innerText?.trim();
            const status = document.querySelector('.price-status')?.innerText?.trim();
            const allButtons = Array.from(document.querySelectorAll('.price-block button, button'));
            const tryBtn = allButtons.find((b) =>
              (b.textContent || '').toLowerCase().includes('try again')
            );
            return {
              hasError: !!(substatus || (status && status.toLowerCase().includes('couldn'))),
              errorText: substatus || status,
              hasBtn: !!tryBtn,
            };
          })
          .catch(() => null);

        if (errorState && errorState.hasError) {
          tryAgainCount += 1;
          if (tryAgainCount > 3) {
            throw new PriceUnstableError(`In-page challenge error: ${errorState.errorText}`);
          }
          // Attempt instant in-page recovery by clicking Try again
          await page.click('button:has-text("Try again")', { timeout: 1500 }).catch(() => {});
          await new Promise((r) => setTimeout(r, 800));
          continue;
        }
      }
    } catch {
      // Ignore transient evaluation errors while DOM is mutating
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  // If timeout was reached without settling
  throw new PriceUnstableError(
    `Price failed to stabilize within ${timeoutMs}ms. Samples recorded: ${JSON.stringify(
      recordedSamples.slice(-5)
    )}`,
    {
      samples: recordedSamples,
      lastExtraction,
    }
  );
}

export default {
  waitForStablePrice,
  PriceUnstableError,
};
