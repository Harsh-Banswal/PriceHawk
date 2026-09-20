import { getContext, closeBrowser } from '../src/scraper/browser.js';
import { navigateAndScrape } from '../src/scraper/scrapeProduct.js';

async function main() {
  let context = null;
  try {
    context = await getContext();
    const page = await context.newPage();

    page.on('console', msg => console.log('PAGE LOG:', msg.text()));

    console.log('Testing navigateAndScrape on SKU 80...');
    const res = await navigateAndScrape(page, 'https://demo.inelabteamdev.com/product/80', {
      stabilityTimeoutMs: 15000,
      onSample: s => {
        if (s.price !== null || s.elapsed % 2000 < 200) {
          console.log(`[sample elapsed=${s.elapsed}ms] price: ${s.price}, mrp: ${s.mrp}, disc: ${s.discountPercent}, rec: ${s.reconciled}`);
        }
      }
    });
    console.log('Result:', res);
  } catch (err) {
    console.error('Scrape failed:', err.message);
  } finally {
    if (context) await context.close().catch(() => {});
    await closeBrowser().catch(() => {});
  }
}

main().catch(console.error);
