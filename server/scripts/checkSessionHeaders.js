import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('request', req => {
    if (req.url().includes('session')) {
      console.log('Session Req Headers:', req.headers());
    }
  });

  page.on('response', async res => {
    if (res.url().includes('session')) {
      console.log('Session Resp Status:', res.status());
      console.log('Session Resp Headers:', res.headers());
      console.log('Session Resp Body:', await res.text());
    }
  });

  await page.goto('https://demo.inelabteamdev.com/product/161', { waitUntil: 'networkidle' });

  const priceBlock = page.locator('.price-block').first();
  const box = await priceBlock.boundingBox();
  if (box) {
    for (let i = 0; i <= 15; i++) {
      await page.mouse.move(box.x + 20 + i * 10, box.y + 20);
      await page.waitForTimeout(60);
    }
    await page.waitForTimeout(800);
  }

  const btn = page.locator('button[aria-label="Reveal price"]').first();
  if (!await btn.isDisabled()) {
    await btn.click();
  }
  await page.waitForTimeout(4000);
  await browser.close();
}

main().catch(console.error);
