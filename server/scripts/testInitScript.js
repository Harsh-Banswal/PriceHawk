import { chromium } from 'playwright';

async function testInitScript() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Permanently prevent cookie overlay from intercepting pointer events
  await page.addInitScript(() => {
    const style = document.createElement('style');
    style.innerHTML = '.cookie-overlay { display: none !important; pointer-events: none !important; }';
    document.documentElement.appendChild(style);

    const observer = new MutationObserver(() => {
      document.querySelectorAll('.cookie-overlay').forEach(el => el.remove());
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  });

  page.on('response', async res => {
    if (res.url().includes('session') || res.url().includes('price') || res.url().includes('challenge')) {
      const text = await res.text().catch(() => '');
      console.log('<- RESP:', res.status(), res.url(), text.slice(0, 200));
    }
  });

  console.log('Navigating to product 161 with overlay suppression...');
  await page.goto('https://demo.inelabteamdev.com/product/161', { waitUntil: 'networkidle' });

  // Locate price block and perform humanized mouse movement
  const priceBlock = page.locator('.price-block').first();
  await priceBlock.scrollIntoViewIfNeeded();
  const box = await priceBlock.boundingBox();
  console.log('Price block box:', box);

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
  const disabled = await revealBtn.isDisabled();
  console.log('Reveal button disabled?', disabled);

  if (!disabled) {
    console.log('Clicking Reveal price button without overlay blockage...');
    await revealBtn.click();

    console.log('Waiting for response...');
    await page.waitForTimeout(4000);
  }

  const resultHTML = await page.evaluate(() => {
    const block = document.querySelector('.price-block');
    return block ? block.outerHTML : document.body.innerText;
  });
  console.log('Final Price Block HTML:\n', resultHTML);

  await browser.close();
}

testInitScript().catch(console.error);
