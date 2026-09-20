import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://demo.inelabteamdev.com/product/161', { waitUntil: 'networkidle' });

  await page.waitForTimeout(2000);

  const overlayHtml = await page.evaluate(() => {
    const el = document.querySelector('.cookie-overlay');
    return el ? {
      html: el.outerHTML,
      text: el.innerText,
      style: el.getAttribute('style'),
      computed: window.getComputedStyle(el).display,
    } : null;
  });
  console.log('Cookie overlay found after 2s delay:', overlayHtml);

  await browser.close();
}

main().catch(console.error);
