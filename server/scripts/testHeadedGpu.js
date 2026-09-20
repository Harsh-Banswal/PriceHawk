import { chromium } from 'playwright';

async function main() {
  // Launch with anti-detection args
  const browser = await chromium.launch({
    headless: false, // headed window
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
    ]
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  page.on('response', async res => {
    if (res.url().includes('session') || res.url().includes('price')) {
      console.log('[NETWORK]', res.status(), res.url(), (await res.text().catch(() => '')).slice(0, 150));
    }
  });

  console.log('Navigating to https://demo.inelabteamdev.com/product/161 in visible window...');
  await page.goto('https://demo.inelabteamdev.com/product/161', { waitUntil: 'networkidle' });

  const priceBlock = page.locator('.price-block').first();
  await priceBlock.scrollIntoViewIfNeeded();
  const box = await priceBlock.boundingBox();

  if (box) {
    for (let i = 0; i <= 20; i++) {
      const x = box.x + 30 + i * 8 + (i % 3) * 4;
      const y = box.y + 25 + (i % 4) * 5;
      await page.mouse.move(x, y, { steps: 3 });
      await page.waitForTimeout(50);
    }
    await page.waitForTimeout(800);
  }

  const btn = page.locator('button[aria-label="Reveal price"]').first();
  console.log('Is button disabled?', await btn.isDisabled());

  if (!await btn.isDisabled()) {
    console.log('Clicking button...');
    await btn.click();
    await page.waitForTimeout(4000);
  }

  const text = await page.evaluate(() => {
    const b = document.querySelector('.price-block');
    return b ? b.innerText : '';
  });
  console.log('Final text in price block:\n', text);

  await browser.close();
}

main().catch(console.error);
