import { getContext, closeBrowser } from '../src/scraper/browser.js';

async function inspectSku(sku) {
  let context = null;
  try {
    context = await getContext();
    const page = await context.newPage();
    await page.goto(`https://demo.inelabteamdev.com/product/${sku}`, { waitUntil: 'networkidle', timeout: 60000 });

    await page.evaluate(() => document.querySelectorAll('.cookie-overlay, [class*="cookie"]').forEach(el => el.remove())).catch(() => {});
    const pb = page.locator('.price-block').first();
    await pb.scrollIntoViewIfNeeded();
    const box = await pb.boundingBox();
    if (box) {
      await page.mouse.move(box.x + 30, box.y + 25);
      for (let i = 1; i <= 15; i++) { await page.waitForTimeout(60); await page.mouse.move(box.x + 30 + i*10, box.y + 25 + (i%2)*8); }
      await page.waitForTimeout(800);
    }

    const btn = page.locator('button[aria-label="Reveal price"]').first();
    for (let a = 1; a <= 5; a++) {
      const isIdle = await page.evaluate(() => document.querySelector('.price-block')?.classList.contains('price-idle') ?? true);
      if (!isIdle) break;
      await page.evaluate(() => document.querySelectorAll('.cookie-overlay').forEach(el => el.remove())).catch(() => {});
      await btn.click({ timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(700);
    }

    await page.waitForTimeout(5000);
    const html = await page.evaluate(() => document.querySelector('.price-block')?.innerHTML || '');
    console.log(`SKU ${sku} innerHTML:\n`, html);
  } finally {
    if (context) await context.close().catch(() => {});
    await closeBrowser().catch(() => {});
  }
}

inspectSku(802).catch(console.error);
