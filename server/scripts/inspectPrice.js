import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('[PAGE CONSOLE]', msg.type(), msg.text()));
  page.on('response', res => {
    if (res.url().includes('challenge') || res.url().includes('session') || res.url().includes('price') || res.url().includes('layout') || res.url().includes('product')) {
      console.log('[RESP]', res.status(), res.url());
    }
  });

  await page.goto('https://demo.inelabteamdev.com/product/582', { waitUntil: 'networkidle' });

  const info = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('*'));
    const priceBox = all.find(el => el.innerText && el.innerText.includes('Price hidden'));
    return {
      boxHTML: priceBox ? priceBox.outerHTML : 'null',
      boxTag: priceBox ? priceBox.tagName : 'null',
      boxClasses: priceBox ? priceBox.className : 'null',
    };
  });
  console.log('Price Box Info:', info);

  // Try hovering over the container
  console.log('Hovering over price container...');
  const box = page.locator('text=Price hidden').first();
  if (await box.count() > 0) {
    const boxParent = box.locator('..');
    await boxParent.hover();
    console.log('Hovered over parent.');
  }

  await page.waitForTimeout(3000);

  const afterHover = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('*'));
    const btn = document.querySelector('button[aria-label="Reveal price"]') || all.find(el => el.innerText && el.innerText.includes('Reveal price'));
    return {
      btnDisabled: btn ? btn.hasAttribute('disabled') : 'no btn',
      btnOuter: btn ? btn.outerHTML : 'null',
      bodyText: document.body.innerText.slice(0, 1000),
    };
  });
  console.log('After Hover Info:', afterHover);

  await browser.close();
}

main().catch(console.error);
