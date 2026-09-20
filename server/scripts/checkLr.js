import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://demo.inelabteamdev.com/product/161', { waitUntil: 'networkidle' });

  // In page context, let's see what Dr has or evaluate the bundle's lr
  const res = await page.evaluate(() => {
    // Let's find lr in the window or script
    return window.location.href;
  });
  console.log('Page loaded:', res);
  await browser.close();
}

main().catch(console.error);
