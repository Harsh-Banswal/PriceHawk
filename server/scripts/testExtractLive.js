import { chromium } from 'playwright';
import { extractFromPage } from '../src/scraper/priceExtractor.js';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.addInitScript(() => {
    const style = document.createElement('style');
    style.innerHTML = '.cookie-overlay { display: none !important; pointer-events: none !important; }';
    document.documentElement.appendChild(style);

    const observer = new MutationObserver(() => {
      document.querySelectorAll('.cookie-overlay').forEach(el => el.remove());
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  });

  console.log('Navigating to product 161...');
  await page.goto('https://demo.inelabteamdev.com/product/161', { waitUntil: 'networkidle' });

  // Hover & mouse moves
  const priceBlock = page.locator('.price-block').first();
  await priceBlock.scrollIntoViewIfNeeded();
  const box = await priceBlock.boundingBox();
  if (box) {
    const startX = box.x + 30;
    const startY = box.y + 25;
    await page.mouse.move(startX, startY);
    for (let i = 1; i <= 15; i++) {
      await page.waitForTimeout(60);
      await page.mouse.move(startX + i * 10, startY + (i % 2) * 8);
    }
    await page.waitForTimeout(800);
  }

  const revealBtn = page.locator('button[aria-label="Reveal price"]').first();
  for (let attempt = 1; attempt <= 5; attempt++) {
    const isIdle = await page.evaluate(() => {
      const el = document.querySelector('.price-block');
      return el ? el.classList.contains('price-idle') : false;
    });
    if (!isIdle) break;
    if (await revealBtn.isVisible() && !await revealBtn.isDisabled()) {
      await revealBtn.click();
    }
    await page.waitForTimeout(1000);
  }

  await page.waitForSelector('.price-block.price-success', { timeout: 15000 });
  console.log('Price success rendered! Calling extractFromPage...');

  const extraction = await extractFromPage(page);
  console.log('Extraction Result:', JSON.stringify(extraction, null, 2));

  await browser.close();
}

main().catch(console.error);
