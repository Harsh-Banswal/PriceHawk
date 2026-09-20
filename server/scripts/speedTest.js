import { getBrowser, closeBrowser } from '../src/scraper/browser.js';
import { waitForStablePrice } from '../src/scraper/waitForStablePrice.js';

async function run() {
  const browser = await getBrowser();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Abort heavy images, fonts, and media
  await page.route('**/*.{png,jpg,jpeg,webp,gif,ico,woff,woff2}', r => r.abort());
  
  const t0 = Date.now();
  await page.goto('https://demo.inelabteamdev.com/product/80', { waitUntil: 'domcontentloaded' });
  console.log('DOM loaded in', Date.now() - t0, 'ms');

  const priceBlock = page.locator('.price-block').first();
  await priceBlock.scrollIntoViewIfNeeded();
  const box = await priceBlock.boundingBox();
  if (box) {
    const startX = box.x + 30;
    const startY = box.y + 25;
    await page.mouse.move(startX, startY);
    for (let i = 1; i <= 8; i++) {
      await page.waitForTimeout(25);
      await page.mouse.move(startX + i * 12, startY + (i % 2) * 8);
    }
    await page.waitForTimeout(400);
  }

  const revealBtn = page.locator("button[aria-label='Reveal price']").first();
  if (await revealBtn.isVisible()) {
    await revealBtn.click();
  }

  const result = await waitForStablePrice(page, { timeoutMs: 15000 });
  console.log('Result extracted in', Date.now() - t0, 'ms:', { price: result.price, mrp: result.mrp, reconciled: result.reconciled });
  await context.close();
  await closeBrowser();
}

run();
