import { getContext, closeBrowser } from '../src/scraper/browser.js';
import { extractFromPage } from '../src/scraper/priceExtractor.js';

async function testSku80Live() {
  let context = null;
  try {
    context = await getContext();
    const page = await context.newPage();
    console.log('Navigating to SKU 80...');
    await page.goto('https://demo.inelabteamdev.com/product/80', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.locator('.price-block').first().waitFor({ state: 'attached', timeout: 8000 }).catch(() => {});

    // Dismiss cookie
    for (let c = 1; c <= 3; c++) {
      const b = page.locator('button[aria-label="Accept cookies"]').first();
      if (await b.isVisible({ timeout: 300 }).catch(() => false)) {
        await b.click().catch(() => {});
        await page.waitForTimeout(200);
      }
    }
    await page.evaluate(() => document.querySelectorAll('.cookie-overlay, [class*="cookie"]').forEach(el => el.remove())).catch(() => {});

    // Hover
    const pb = page.locator('.price-block').first();
    await pb.scrollIntoViewIfNeeded();
    const box = await pb.boundingBox();
    if (box) {
      await page.mouse.move(box.x + 30, box.y + 25);
      for (let i = 1; i <= 15; i++) { await page.waitForTimeout(60); await page.mouse.move(box.x + 30 + i*10, box.y + 25 + (i%2)*8); }
      await page.waitForTimeout(800);
    }

    // Click reveal
    const btn = page.locator('button[aria-label="Reveal price"]').first();
    for (let a = 1; a <= 5; a++) {
      const isIdle = await page.evaluate(() => document.querySelector('.price-block')?.classList.contains('price-idle') ?? true);
      if (!isIdle) break;
      await btn.click({ timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(700);
    }

    console.log('Sampling for 12 seconds...');
    for (let i = 1; i <= 12; i++) {
      await page.waitForTimeout(1000);
      const ex = await extractFromPage(page);
      const html = await page.evaluate(() => document.querySelector('.price-block')?.outerHTML || '');
      const status = await page.evaluate(() => document.querySelector('.price-substatus')?.innerText || '');
      console.log(`[t=${i}s] price: ${ex.price}, mrp: ${ex.mrp}, disc: ${ex.discountPercent}, rec: ${ex.reconciled}, status: "${status}"`);
      if (ex.price !== null) {
        console.log('SUCCESS! ex:', ex);
        break;
      }
      if (status) {
        console.log('Clicking Try again...');
        await page.click('button:has-text("Try again")').catch(() => {});
      }
      if (i === 12) {
        console.log('HTML at end:\n', html);
      }
    }

  } finally {
    if (context) await context.close().catch(() => {});
    await closeBrowser().catch(() => {});
  }
}

testSku80Live().catch(console.error);
