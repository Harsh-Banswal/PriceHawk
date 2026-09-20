import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://demo.inelabteamdev.com/product/161', { waitUntil: 'networkidle' });

  const overlay = await page.evaluate(() => {
    const el = document.querySelector('.cookie-overlay, [class*="cookie"], [class*="consent"], [id*="cookie"]');
    return el ? {
      html: el.outerHTML,
      text: el.innerText,
      buttons: Array.from(el.querySelectorAll('button')).map(b => b.innerText)
    } : 'no overlay';
  });
  console.log('Cookie overlay info:\n', overlay);

  await browser.close();
}

main().catch(console.error);
