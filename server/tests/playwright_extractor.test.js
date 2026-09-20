import test from 'node:test';
import assert from 'node:assert/strict';
import { getBrowser, closeBrowser } from '../src/scraper/browser.js';
import { extractFromPage } from '../src/scraper/priceExtractor.js';
import { waitForStablePrice } from '../src/scraper/waitForStablePrice.js';

test('Playwright extraction on obfuscated DOM with split digits and decoys', async () => {
  const browser = await getBrowser();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Construct HTML simulating demo.inelabteamdev.com:
    // - Decoy struck-through price
    // - Obfuscated class names
    // - Split price digits with CSS visual order
    // - Struck-through MRP
    // - Discount badge
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Test Product</title>
          <style>
            .split-container {
              display: flex;
              font-size: 24px;
            }
            .struck {
              text-decoration: line-through;
              color: gray;
            }
            .order-2 { order: 2; }
            .order-1 { order: 1; }
          </style>
        </head>
        <body>
          <h1 id="product-title">Noise Cancelling Headphones</h1>
          
          <!-- Struck-through Decoy Price -->
          <div class="decoy-price struck">
            ₹899
          </div>

          <!-- Struck-through MRP -->
          <div class="mrp-box">
            MRP: <del>₹1,000</del>
          </div>

          <!-- Discount badge -->
          <span class="disc-tag">20% off</span>

          <!-- True Price: Visually "₹800", rendered via split elements -->
          <div class="split-container true-price-box">
            <span class="order-1">₹80</span>
            <span class="order-2">0</span>
          </div>

          <!-- Stock badge -->
          <div class="stock-badge">
            In Stock
          </div>
        </body>
      </html>
    `;

    await page.setContent(htmlContent);

    // 1. Test extraction directly
    const extracted = await extractFromPage(page);

    assert.equal(extracted.price, 800, `Expected price 800, got ${extracted.price}`);
    assert.equal(extracted.mrp, 1000, `Expected mrp 1000, got ${extracted.mrp}`);
    assert.equal(extracted.discountPercent, 20, `Expected discount 20%, got ${extracted.discountPercent}`);
    assert.equal(extracted.stockStatus, 'in_stock', `Expected stock in_stock, got ${extracted.stockStatus}`);
    assert.equal(extracted.reconciled, true, 'Expected reconciled to be true');
    assert.ok(
      extracted.rawTexts.struckThroughCandidates.some((c) => c.includes('899') || c.includes('1,000')),
      'Struck through candidates recorded'
    );

    // 2. Test waitForStablePrice
    const stableResult = await waitForStablePrice(page, { pollIntervalMs: 50, timeoutMs: 2000 });
    assert.equal(stableResult.price, 800);
    assert.equal(stableResult.reconciled, true);

  } finally {
    await context.close();
    await closeBrowser();
  }
});
