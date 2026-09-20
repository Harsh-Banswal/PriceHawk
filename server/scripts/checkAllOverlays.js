import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://demo.inelabteamdev.com/product/161', { waitUntil: 'networkidle' });

  // Let's find any element containing "cookie" or "overlay" in class, id, or text
  const list = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('*'))
      .filter(el => {
        const str = (el.className + ' ' + el.id + ' ' + (el.getAttribute('style') || '')).toLowerCase();
        return str.includes('cookie') || str.includes('overlay') || str.includes('modal') || str.includes('banner');
      })
      .map(el => ({
        tag: el.tagName,
        class: el.className,
        id: el.id,
        html: el.outerHTML.slice(0, 200),
      }));
  });
  console.log('Matching elements:', list);

  await browser.close();
}

main().catch(console.error);
