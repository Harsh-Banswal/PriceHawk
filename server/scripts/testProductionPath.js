/**
 * Direct test of the production getContext() + navigateAndScrape() path
 * to verify the overlay suppression and click retry work end-to-end.
 */
import { getContext, closeBrowser } from '../src/scraper/browser.js';
import { scrapeProductWithRetry } from '../src/scraper/scrapeProduct.js';

async function main() {
  let context = null;
  try {
    console.log('Creating context via production getContext()...');
    context = await getContext();
    const page = await context.newPage();

    page.on('response', async res => {
      const url = res.url();
      if (url.includes('session') || url.includes('challenge') || url.includes('/price')) {
        const text = await res.text().catch(() => '');
        console.log(`<- ${res.status()} ${url.split('/').slice(-2).join('/')}`, text.slice(0, 100));
      }
    });

    console.log('Running scrapeProductWithRetry...');
    const result = await scrapeProductWithRetry(page, 'https://demo.inelabteamdev.com/product/161', {
      navTimeoutMs: 60000,
      maxAttempts: 1,
      onSample: (s) => console.log(`  Sample @${s.elapsed}ms price=${s.price} mrp=${s.mrp} disc=${s.discountPercent}`),
    });

    console.log('\nRESULT:', JSON.stringify(result, null, 2));
  } finally {
    if (context) await context.close().catch(() => {});
    await closeBrowser().catch(() => {});
  }
}

main().catch(console.error);
