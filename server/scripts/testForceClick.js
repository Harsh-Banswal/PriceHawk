import { getContext, closeBrowser } from '../src/scraper/browser.js';
import { extractFromPage } from '../src/scraper/priceExtractor.js';

async function testForceClick() {
  let context = null;
  try {
    context = await getContext();
    const page = await context.newPage();
    console.log('Navigating to SKU 80...');
    await page.goto('https://demo.inelabteamdev.com/product/80', { waitUntil: 'networkidle', timeout: 60000 });

    const pb = page.locator('.price-block').first();
    await pb.scrollIntoViewIfNeeded();
    const box = await pb.boundingBox();
    if (box) {
      await page.mouse.move(box.x + 30, box.y + 25);
      for (let i = 1; i <= 15; i++) { await page.waitForTimeout(60); await page.mouse.move(box.x + 30 + i*10, box.y + 25 + (i%2)*8); }
      await page.waitForTimeout(800);
    }

    const btn = page.locator('button[aria-label="Reveal price"]').first();
    for (let a = 1; a <= 6; a++) {
      const isIdle = await page.evaluate(() => document.querySelector('.price-block')?.classList.contains('price-idle') ?? true);
      if (!isIdle) { console.log('Cleared price-idle at attempt', a); break; }
      console.log(`Clicking with force:true (attempt ${a})...`);
      await btn.click({ force: true, timeout: 2000 }).catch(e => console.log('click err:', e.message));
      await page.waitForTimeout(700);
    }

    console.log('Waiting up to 10s for extraction...');
    for (let i = 1; i <= 10; i++) {
      await page.waitForTimeout(1000);
      const ex = await extractFromPage(page);
      if (ex.price !== null) {
        console.log(`SUCCESS at t=${i}s:`, JSON.stringify(ex));
        break;
      }
      const err = await page.evaluate(() => document.querySelector('.price-substatus')?.innerText);
      if (err) {
        console.log(`Got error at t=${i}s:`, err);
        const tryBtn = page.locator('button:has-text("Try again")').first();
        if (await tryBtn.isVisible().catch(() => false)) {
          console.log('Clicking Try again with force:true...');
          await tryBtn.click({ force: true }).catch(() => {});
        }
      }
    }

  } finally {
    if (context) await context.close().catch(() => {});
    await closeBrowser().catch(() => {});
  }
}

testForceClick().catch(console.error);
