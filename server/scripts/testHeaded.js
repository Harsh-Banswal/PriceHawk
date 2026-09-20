import { chromium } from 'playwright';

async function testHeaded() {
  const browser = await chromium.launch({ headless: true }); // headless for now with realistic flags
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  page.on('response', async res => {
    if (res.url().includes('session') || res.url().includes('price') || res.url().includes('challenge')) {
      console.log('<- RESP', res.status(), res.url(), (await res.text().catch(() => '')).slice(0, 200));
    }
  });

  await page.goto('https://demo.inelabteamdev.com/product/161', { waitUntil: 'networkidle' });

  // Move mouse naturally onto the card
  const priceBlock = page.locator('.price-block').first();
  await priceBlock.scrollIntoViewIfNeeded();
  const box = await priceBlock.boundingBox();

  // Natural curved mouse movement
  for (let i = 0; i <= 15; i++) {
    const x = box.x + 50 + i * 10 + Math.sin(i) * 5;
    const y = box.y + 20 + Math.cos(i) * 8;
    await page.mouse.move(x, y, { steps: 5 });
    await page.waitForTimeout(60);
  }

  // Dwell for 1000ms
  await page.waitForTimeout(1000);

  const revealBtn = page.locator('button[aria-label="Reveal price"]').first();
  console.log('Button disabled?', await revealBtn.isDisabled());

  await revealBtn.click();
  console.log('Clicked reveal button');

  await page.waitForTimeout(5000);

  const content = await page.evaluate(() => {
    const b = document.querySelector('.price-block');
    return b ? b.innerText : document.body.innerText;
  });
  console.log('Result in price block:\n', content);

  await browser.close();
}

testHeaded().catch(console.error);
