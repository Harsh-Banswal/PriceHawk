import { chromium } from 'playwright';

async function main() {
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

  page.on('request', req => {
    if (req.url().includes('session')) {
      console.log('--- SESSION REQUEST HEADERS ---', req.headers());
      console.log('--- SESSION REQUEST POST DATA ---', req.postData());
    }
  });

  page.on('response', async res => {
    if (res.url().includes('session') || res.url().includes('price') || res.url().includes('challenge')) {
      console.log('--- RESP:', res.status(), res.url(), (await res.text().catch(() => '')).slice(0, 300));
    }
  });

  await page.goto('https://demo.inelabteamdev.com/product/161', { waitUntil: 'networkidle' });

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
  if (!await revealBtn.isDisabled()) {
    await revealBtn.click();
    console.log('Clicked Reveal price. Waiting 6000ms...');
    await page.waitForTimeout(6000);
  }

  const blockInfo = await page.evaluate(() => {
    const el = document.querySelector('.price-block');
    return el ? { html: el.outerHTML, text: el.innerText } : null;
  });
  console.log('Final price block info:', JSON.stringify(blockInfo, null, 2));

  await browser.close();
}

main().catch(console.error);
