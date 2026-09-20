import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Overlay suppression
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
      console.log('<- RESP:', res.status(), res.url(), (await res.text().catch(() => '')).slice(0, 200));
    }
  });

  console.log('Navigating to product 161...');
  await page.goto('https://demo.inelabteamdev.com/product/161', { waitUntil: 'networkidle' });

  // Mouse hover & movement to satisfy Ar ({ minMoves: 8, minDwellMs: 600 })
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
  
  // Retry clicking until price-idle disappears (bypassing Xn drop)
  for (let attempt = 1; attempt <= 5; attempt++) {
    const isIdle = await page.evaluate(() => {
      const el = document.querySelector('.price-block');
      return el ? el.classList.contains('price-idle') : false;
    });
    if (!isIdle) {
      console.log(`Transitioned out of idle at attempt ${attempt}!`);
      break;
    }
    console.log(`Clicking Reveal button (attempt ${attempt})...`);
    if (await revealBtn.isVisible() && !await revealBtn.isDisabled()) {
      await revealBtn.click();
    }
    await page.waitForTimeout(1000);
  }

  console.log('Waiting for price-success...');
  try {
    await page.waitForSelector('.price-block.price-success', { timeout: 12000 });
    console.log('SUCCESS! Price block entered price-success state!');
  } catch (err) {
    console.log('Timed out waiting for .price-success:', err.message);
  }

  const blockInfo = await page.evaluate(() => {
    const el = document.querySelector('.price-block');
    return el ? { classList: Array.from(el.classList), html: el.outerHTML, text: el.innerText } : null;
  });
  console.log('Final block info:', JSON.stringify(blockInfo, null, 2));

  await browser.close();
}

main().catch(console.error);
