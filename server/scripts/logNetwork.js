import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('request', req => {
    if (req.url().includes('challenge') || req.url().includes('session') || req.url().includes('price')) {
      console.log('-> REQ:', req.method(), req.url(), req.postData());
    }
  });

  page.on('response', async res => {
    if (res.url().includes('challenge') || res.url().includes('session') || res.url().includes('price')) {
      let text = '';
      try { text = await res.text(); } catch {}
      console.log('<- RESP:', res.status(), res.url(), text.slice(0, 300));
    }
  });

  await page.goto('https://demo.inelabteamdev.com/product/161', { waitUntil: 'networkidle' });

  const priceBlock = page.locator('.price-block').first();
  const box = await priceBlock.boundingBox();
  if (box) {
    const startX = box.x + 20;
    const startY = box.y + 20;
    await page.mouse.move(startX, startY);
    for (let i = 1; i <= 12; i++) {
      await page.waitForTimeout(70);
      await page.mouse.move(startX + i * 15, startY + (i % 2) * 15);
    }
    await page.waitForTimeout(400);
  }

  const revealBtn = page.locator('button[aria-label="Reveal price"]').first();
  if (!await revealBtn.isDisabled()) {
    console.log('Clicking reveal...');
    await revealBtn.click();
  }

  await page.waitForTimeout(3000);
  await browser.close();
}

main().catch(console.error);
