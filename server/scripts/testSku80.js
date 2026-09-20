import { getContext, closeBrowser } from '../src/scraper/browser.js';
import { extractFromPage } from '../src/scraper/priceExtractor.js';

async function testSku(sku) {
  let context = null;
  try {
    context = await getContext();
    const page = await context.newPage();
    console.log(`Navigating to SKU ${sku}...`);
    await page.goto(`https://demo.inelabteamdev.com/product/${sku}`, { waitUntil: 'networkidle', timeout: 60000 });

    const pb = page.locator('.price-block').first();
    await pb.scrollIntoViewIfNeeded();
    const box = await pb.boundingBox();
    if (box) {
      const sx = box.x + 30, sy = box.y + 25;
      await page.mouse.move(sx, sy);
      for (let i = 1; i <= 15; i++) { await page.waitForTimeout(60); await page.mouse.move(sx + i*10, sy + (i%2)*8); }
      await page.waitForTimeout(800);
    }

    const btn = page.locator('button[aria-label="Reveal price"]').first();
    for (let a = 1; a <= 6; a++) {
      const isIdle = await page.evaluate(() => document.querySelector('.price-block')?.classList.contains('price-idle') ?? true);
      if (!isIdle) { console.log('price-idle cleared at attempt', a); break; }
      await btn.click({ timeout: 2000 }).catch(e => console.log('click err:', e.message));
      await page.waitForTimeout(700);
    }

    console.log('Waiting 12s for challenge and decryption...');
    for (let i = 1; i <= 12; i++) {
      await page.waitForTimeout(1000);
      const ex = await extractFromPage(page);
      const blockHtml = await page.evaluate(() => document.querySelector('.price-block')?.outerHTML || 'NO PRICE BLOCK');
      const text = await page.evaluate(() => document.querySelector('.price-block')?.innerText || '');
      if (ex.price !== null || i % 3 === 0) {
        console.log(`[t=${i}s] ex:`, JSON.stringify(ex));
        console.log(`[t=${i}s] price-block text:`, JSON.stringify(text));
        if (ex.price !== null) break;
      }
    }
  } finally {
    if (context) await context.close().catch(() => {});
    await closeBrowser().catch(() => {});
  }
}

testSku(80).catch(console.error);
