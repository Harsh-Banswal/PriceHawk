import { chromium } from 'playwright';

async function testFullReveal() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('response', res => {
    if (res.url().includes('api')) {
      console.log('[API CALL]', res.status(), res.url());
    }
  });

  console.log('Navigating to https://demo.inelabteamdev.com/product/161...');
  await page.goto('https://demo.inelabteamdev.com/product/161', { waitUntil: 'networkidle' });

  console.log('Page loaded:', page.url());

  // Locate price block
  const priceBlock = page.locator('.price-block').first();
  await priceBlock.waitFor({ state: 'visible', timeout: 5000 });

  const box = await priceBlock.boundingBox();
  console.log('Price block bounding box:', box);

  if (box) {
    // Perform at least 8 mouse moves across 700ms
    console.log('Simulating human mouse moves to satisfy minMoves:8 and minDwellMs:600...');
    const startX = box.x + 10;
    const startY = box.y + 10;
    await page.mouse.move(startX, startY);

    for (let i = 1; i <= 10; i++) {
      await page.waitForTimeout(80);
      await page.mouse.move(startX + i * 15, startY + (i % 2) * 10);
    }
    await page.waitForTimeout(300);
  }

  // Check reveal button state
  const revealBtn = page.locator('button[aria-label="Reveal price"]').first();
  const isDisabled = await revealBtn.isDisabled();
  console.log('Reveal button disabled?', isDisabled);

  if (!isDisabled) {
    console.log('Clicking Reveal price button...');
    await revealBtn.click();

    // Wait for price to decrypt and render
    console.log('Waiting for price to decrypt...');
    await page.waitForTimeout(4000);

    const priceText = await page.evaluate(() => {
      const block = document.querySelector('.price-block');
      return {
        blockHTML: block ? block.outerHTML : null,
        bodyText: document.body.innerText.slice(0, 1000),
      };
    });
    console.log('Decrypted Price Block HTML:\n', priceText.blockHTML);
  }

  await browser.close();
}

testFullReveal().catch(console.error);
