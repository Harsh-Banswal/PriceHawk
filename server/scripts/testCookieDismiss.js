import { chromium } from 'playwright';

async function testWithCookieDismiss() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('response', async res => {
    if (res.url().includes('session') || res.url().includes('price') || res.url().includes('challenge')) {
      const text = await res.text().catch(() => '');
      console.log('<- RESP:', res.status(), res.url(), text.slice(0, 200));
    }
  });

  console.log('Navigating to product 161...');
  await page.goto('https://demo.inelabteamdev.com/product/161', { waitUntil: 'networkidle' });

  // 1. Check for cookie overlay and click Accept
  const cookieAcceptBtn = page.locator('button[aria-label="Accept cookies"], button:has-text("Accept")').first();
  if (await cookieAcceptBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log('Found Cookie Accept button! Clicking Accept...');
    await cookieAcceptBtn.click();
    await page.waitForTimeout(500);
  } else {
    // Also check and remove overlay from DOM if present
    await page.evaluate(() => {
      const el = document.querySelector('.cookie-overlay');
      if (el) el.remove();
    });
  }

  // 2. Locate price block and perform humanized mouse movement
  const priceBlock = page.locator('.price-block').first();
  await priceBlock.scrollIntoViewIfNeeded();
  const box = await priceBlock.boundingBox();
  console.log('Price block box:', box);

  if (box) {
    const startX = box.x + 25;
    const startY = box.y + 20;
    await page.mouse.move(startX, startY);

    for (let i = 1; i <= 15; i++) {
      await page.waitForTimeout(60);
      await page.mouse.move(startX + i * 10, startY + (i % 2) * 8);
    }
    await page.waitForTimeout(800);
  }

  // 3. Check Reveal price button
  const revealBtn = page.locator('button[aria-label="Reveal price"]').first();
  const disabled = await revealBtn.isDisabled();
  console.log('Reveal button disabled?', disabled);

  if (!disabled) {
    console.log('Clicking Reveal price button...');
    await revealBtn.click();

    await page.waitForTimeout(4000);
  }

  const resultHTML = await page.evaluate(() => {
    const block = document.querySelector('.price-block');
    return block ? block.outerHTML : document.body.innerText;
  });
  console.log('Final Price Block HTML:\n', resultHTML);

  await browser.close();
}

testWithCookieDismiss().catch(console.error);
