import supabase from '../src/db/supabase.js';
import { scrapeTrackedProduct } from '../src/scraper/runScrapeCycle.js';
import { closeBrowser } from '../src/scraper/browser.js';

async function testFixes() {
  try {
    const skus = ['80', '245', '802'];
    for (const sku of skus) {
      console.log(`\n========================================`);
      console.log(`TESTING SCRAPE FOR SKU: ${sku}`);
      console.log(`========================================`);
      const { data: product, error } = await supabase
        .from('tracked_products')
        .select('*')
        .eq('store_product_id', sku)
        .single();

      if (error || !product) {
        console.error(`Product not found for SKU ${sku}:`, error?.message);
        continue;
      }

      const startTime = Date.now();
      const result = await scrapeTrackedProduct(product);
      const elapsed = (Date.now() - startTime) / 1000;

      console.log(`Result for SKU ${sku} in ${elapsed.toFixed(1)}s:`);
      console.log(`- Outcome: ${result.outcome}`);
      console.log(`- Reconciled: ${result.reconciled}`);
      console.log(`- Attempts: ${result.attemptCount}`);
      if (result.data) {
        console.log(`- Price: ₹${result.data.price}`);
        console.log(`- MRP: ₹${result.data.mrp}`);
        console.log(`- Discount: ${result.data.discountPercent}%`);
      } else {
        console.log(`- Error: ${result.errorMessage}`);
      }
    }
  } finally {
    await closeBrowser().catch(() => {});
  }
}

testFixes().catch(console.error);
