import { getContext, closeBrowser } from '../src/scraper/browser.js';
import { scrapeProductWithRetry } from '../src/scraper/scrapeProduct.js';

async function check797() {
  const ctx = await getContext({ headless: true });
  try {
    const page = await ctx.newPage();
    const result = await scrapeProductWithRetry(page, 'https://demo.inelabteamdev.com/product/797');
    console.log('Live Scrape Result for SKU 797 with updated priceExtractor:', JSON.stringify(result, null, 2));

    const badgeInfo = await page.evaluate(() => {
      const el = document.querySelector('.stock-badge');
      if (!el) return 'no .stock-badge found';
      return {
        className: el.className,
        innerText: el.innerText,
        textContent: el.textContent
      };
    });
    console.log('Badge on page 797:', badgeInfo);

  } finally {
    await ctx.close().catch(() => {});
    await closeBrowser().catch(() => {});
  }
}

check797().catch(console.error);
