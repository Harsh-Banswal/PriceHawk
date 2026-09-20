import supabase from '../src/db/supabase.js';
import { scrapeTrackedProduct } from '../src/scraper/runScrapeCycle.js';
import { closeBrowser } from '../src/scraper/browser.js';
import { invalidateCache } from '../src/utils/priceCache.js';

async function rescrapeAll() {
  const { data: products } = await supabase.from('tracked_products').select('*');
  console.log(`Live re-scraping all ${products.length} products with updated extractor...`);

  for (const prod of products) {
    console.log(`Scraping SKU ${prod.store_product_id} (${prod.name}) from site...`);
    try {
      const res = await scrapeTrackedProduct(prod);
      console.log(`✓ SKU ${prod.store_product_id}: price=${res?.data?.price}, stockStatus=${res?.data?.stockStatus}, stockUnits=${res?.data?.stockUnits}`);
    } catch (e) {
      console.error(`✗ Error on SKU ${prod.store_product_id}:`, e.message);
    }
  }

  invalidateCache();
  await closeBrowser().catch(() => {});
  console.log('Finished re-scraping all products directly from live storefront.');
}

rescrapeAll().catch(console.error);
