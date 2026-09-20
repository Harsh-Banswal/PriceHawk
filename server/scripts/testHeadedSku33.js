/**
 * Test SKU 33 in headed mode to see if the challenge passes
 */
import { chromium } from 'playwright';

async function testHeaded(productId) {
  const browser = await chromium.launch({
    headless: false,
    args: ['--no-sandbox']
  });

  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
    });

    await context.addInitScript(() => {
      const style = document.createElement('style');
      style.textContent = '.cookie-overlay { display: none !important; pointer-events: none !important; }';
      (document.head || document.documentElement).appendChild(style);
      const observer = new MutationObserver(() => {
        document.querySelectorAll('.cookie-overlay').forEach(el => el.remove());
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
    });

    const page = await context.newPage();

    page.on('response', async res => {
      const url = res.url();
      if (url.includes('session') || url.includes('challenge')) {
        const text = await res.text().catch(() => '');
        console.log(`<- ${res.status()} ${url.split('/').slice(-1)[0]} | ${text.slice(0, 100)}`);
      }
    });

    await page.goto(`https://demo.inelabteamdev.com/product/${productId}`, { waitUntil: 'networkidle', timeout: 60000 });
    console.log('Navigated to product', productId);

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
    for (let a = 1; a <= 5; a++) {
      const isIdle = await page.evaluate(() => document.querySelector('.price-block')?.classList.contains('price-idle') ?? true);
      if (!isIdle) { console.log('Click processed at attempt', a); break; }
      await btn.click({ timeout: 2000 }).catch(e => console.log('click err:', e.message));
      await page.waitForTimeout(700);
    }

    console.log('Waiting 15s for price...');
    await page.waitForTimeout(15000);

    const info = await page.evaluate(() => {
      const el = document.querySelector('.price-block');
      return { classList: Array.from(el?.classList ?? []), text: el?.innerText?.slice(0, 150) };
    });
    console.log('Final:', info.classList.join(' '), '|', info.text?.replace(/\n/g, ' '));

    await browser.close();
  } catch (err) {
    await browser.close().catch(() => {});
    throw err;
  }
}

// Test SKU 33 in headed mode
testHeaded(33).catch(console.error);
