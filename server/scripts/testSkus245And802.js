import { getContext, closeBrowser } from '../src/scraper/browser.js';
import { extractFromPage } from '../src/scraper/priceExtractor.js';

async function testSkus(skus) {
  let context = null;
  try {
    context = await getContext();
    for (const sku of skus) {
      const page = await context.newPage();
      try {
        console.log(`\n=== Testing SKU ${sku} ===`);
        await page.goto(`https://demo.inelabteamdev.com/product/${sku}`, { waitUntil: 'networkidle', timeout: 60000 });

        // Ensure overlay is destroyed
        await page.evaluate(() => {
          document.querySelectorAll('.cookie-overlay, [class*="cookie"]').forEach(el => el.remove());
        }).catch(() => {});

        const pb = page.locator('.price-block').first();
        await pb.scrollIntoViewIfNeeded();
        const box = await pb.boundingBox();
        if (box) {
          const sx = box.x + 30, sy = box.y + 25;
          await page.mouse.move(sx, sy);
          for (let i = 1; i <= 15; i++) { await page.waitForTimeout(60); await page.mouse.move(sx + i*10, sy + (i%2)*8); }
          await page.waitForTimeout(800);
        }

        // Clean overlay again before click
        await page.evaluate(() => {
          document.querySelectorAll('.cookie-overlay, [class*="cookie"]').forEach(el => el.remove());
        }).catch(() => {});

        const btn = page.locator('button[aria-label="Reveal price"]').first();
        for (let a = 1; a <= 6; a++) {
          const isIdle = await page.evaluate(() => document.querySelector('.price-block')?.classList.contains('price-idle') ?? true);
          if (!isIdle) { console.log(`SKU ${sku}: price-idle cleared at attempt ${a}`); break; }
          await page.evaluate(() => {
            document.querySelectorAll('.cookie-overlay, [class*="cookie"]').forEach(el => el.remove());
          }).catch(() => {});
          await btn.click({ timeout: 2000 }).catch(e => console.log(`click attempt ${a} err:`, e.message.slice(0, 70)));
          await page.waitForTimeout(700);
        }

        console.log(`Waiting up to 15s for SKU ${sku}...`);
        for (let i = 1; i <= 15; i++) {
          await page.waitForTimeout(1000);
          const ex = await extractFromPage(page);
          if (ex.price !== null) {
            console.log(`SUCCESS SKU ${sku} at t=${i}s:`, JSON.stringify(ex));
            break;
          }
          if (i === 15) {
            const blockText = await page.evaluate(() => document.querySelector('.price-block')?.innerText || '');
            console.log(`FAILED SKU ${sku} after 15s. price-block:`, JSON.stringify(blockText));
          }
        }
      } finally {
        await page.close().catch(() => {});
      }
    }
  } finally {
    if (context) await context.close().catch(() => {});
    await closeBrowser().catch(() => {});
  }
}

testSkus([245, 802]).catch(console.error);
