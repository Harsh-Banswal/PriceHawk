import test from 'node:test';
import assert from 'node:assert/strict';
import { getBrowser, closeBrowser } from '../src/scraper/browser.js';
import { extractFromPage } from '../src/scraper/priceExtractor.js';
import { waitForStablePrice } from '../src/scraper/waitForStablePrice.js';
import { navigateAndScrape, scrapeProductWithRetry } from '../src/scraper/scrapeProduct.js';

test('Hostile Reviewer Defensive Tests', async (t) => {
  const browser = await getBrowser();

  await t.test('Nested Child Strikethrough: parent wrapper cannot disguise struck-through decoy', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      // Decoy is wrapped in an unstruck outer container, but child has line-through
      await page.setContent(`
        <!DOCTYPE html>
        <html>
          <body>
            <div id="decoy-wrapper" class="price-box">
              <span style="text-decoration: line-through">₹899</span>
            </div>
            <div id="mrp-box">
              MRP: <del>₹1,000</del>
            </div>
            <span class="discount">20% off</span>
            <div id="true-price">
              <span>₹800</span>
            </div>
          </body>
        </html>
      `);

      const result = await extractFromPage(page);

      // The decoy ₹899 MUST be identified as struck-through and discarded
      assert.equal(result.price, 800, 'Selected price must be the true price ₹800');
      assert.equal(result.reconciled, true, 'Reconciles against MRP and discount');
      assert.ok(
        result.rawTexts.struckThroughCandidates.some((t) => t.includes('899')),
        'Nested child struck price ₹899 was correctly classified into struckThroughCandidates'
      );
      assert.ok(
        !result.rawTexts.priceCandidates.includes('₹899'),
        'Decoy ₹899 is not present in unstruck priceCandidates'
      );
    } finally {
      await context.close();
    }
  });

  await t.test('Missing MRP and Discount: Fail-Closed policy blocks unverified prices from reconciling', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      // A page displaying only a price without MRP or discount (or where anti-bot hiding blocked them)
      await page.setContent(`
        <!DOCTYPE html>
        <html>
          <body>
            <div class="price">₹499</div>
          </body>
        </html>
      `);

      const result = await extractFromPage(page);

      assert.equal(result.price, 499, 'Extracted the raw price candidate');
      // Crucial hostile check: Must NOT silently pass as reconciled
      assert.equal(
        result.reconciled,
        false,
        'Reconciliation MUST fail closed when neither MRP nor discount is available to verify against decoys'
      );
    } finally {
      await context.close();
    }
  });

  await t.test('Stability Poller: Requires 3 consecutive identical reads (minConsecutiveMatches >= 2)', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      let readCount = 0;
      // Simulate animated ticker changing values on every read
      await page.exposeFunction('getNextMockPrice', () => {
        readCount += 1;
        if (readCount === 1) return '₹100';
        if (readCount === 2) return '₹200'; // Coincidental 1st match with next
        if (readCount === 3) return '₹200'; // 2 identical reads (1 match) - should NOT settle yet!
        if (readCount === 4) return '₹300'; // Value changed! Ticker was still animating
        if (readCount === 5) return '₹800';
        if (readCount === 6) return '₹800';
        return '₹800'; // Settle on 3 consecutive identical reads
      });

      await page.setContent(`
        <!DOCTYPE html>
        <html>
          <body>
            <div id="price">₹100</div>
            <div id="mrp">MRP: ₹1,000</div>
            <div id="discount">20% off</div>
            <script>
              const el = document.getElementById('price');
              setInterval(async () => {
                if (window.getNextMockPrice) {
                  el.innerText = await window.getNextMockPrice();
                }
              }, 60);
            </script>
          </body>
        </html>
      `);

      const result = await waitForStablePrice(page, {
        pollIntervalMs: 80,
        timeoutMs: 3000,
        minConsecutiveMatches: 2,
      });

      // Must settle on final ₹800, NOT intermediate ₹200 ticker value
      assert.equal(result.price, 800, 'Poller waited for true stability (3 identical reads) rather than 2 coincidental reads');
    } finally {
      await context.close();
    }
  });

  await t.test('Unified Navigation Timeout: Single attempt does not hang past navTimeoutMs', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      // Set a short navigation budget of 800ms
      const navBudget = 800;
      const startTime = Date.now();

      let caughtErr = null;
      try {
        // Navigate to a blank page where price never appears
        await navigateAndScrape(page, 'about:blank', {
          navTimeoutMs: navBudget,
          stabilityTimeoutMs: 5000, // stability requested 5s, but nav budget is only 800ms!
          pollIntervalMs: 50,
        });
      } catch (err) {
        caughtErr = err;
      }

      const elapsed = Date.now() - startTime;
      assert.ok(caughtErr, 'Expected navigateAndScrape to reject');
      assert.ok(
        elapsed < 2000,
        `Single attempt must not exceed navigation budget (elapsed: ${elapsed}ms, budget: ${navBudget}ms)`
      );
      assert.match(
        caughtErr.message,
        /timeout|timed out|budget/i,
        'Error explicitly mentions timeout or budget exhaustion'
      );
    } finally {
      await context.close();
    }
  });

  await closeBrowser();
});
