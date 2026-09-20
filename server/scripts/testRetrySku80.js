import { getContext, closeBrowser } from '../src/scraper/browser.js';
import { scrapeProductWithRetry } from '../src/scraper/scrapeProduct.js';

async function testWithRetry(sku) {
  let context = null;
  try {
    context = await getContext();
    const page = await context.newPage();
    console.log(`Starting scrapeProductWithRetry for SKU ${sku}...`);
    const startTime = Date.now();
    const result = await scrapeProductWithRetry(page, `https://demo.inelabteamdev.com/product/${sku}`, {
      maxAttempts: 6,
      stabilityTimeoutMs: 15000,
    });
    const totalTime = (Date.now() - startTime) / 1000;
    console.log(`Finished in ${totalTime.toFixed(1)}s:`, JSON.stringify(result, null, 2));
  } finally {
    if (context) await context.close().catch(() => {});
    await closeBrowser().catch(() => {});
  }
}

testWithRetry(80).catch(console.error);
