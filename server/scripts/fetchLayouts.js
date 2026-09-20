/**
 * Fetch /api/layout for all SKUs in-browser to capture what the SPA sees
 */
import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const skus = [161, 1, 513, 33, 245, 802];

  for (const sku of skus) {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();

    let layoutData = null;
    page.on('response', async res => {
      if (res.url().includes('layout')) {
        const text = await res.text().catch(() => '');
        try { layoutData = JSON.parse(text); } catch {}
      }
    });

    await page.goto(`https://demo.inelabteamdev.com/product/${sku}`, { waitUntil: 'networkidle', timeout: 30000 });

    if (layoutData) {
      console.log(`SKU ${sku}: variant=${layoutData.variant} priceCarrier=${layoutData.priceCarrier} priceTag=${layoutData.priceTag} difficulty=${layoutData.difficulty ?? 'N/A'}`);
    } else {
      // Try direct fetch from page context
      const result = await page.evaluate(async (id) => {
        try {
          const r = await fetch(`/api/products/${id}/layout`);
          return { status: r.status, data: await r.json() };
        } catch (e) {
          return { error: e.message };
        }
      }, sku);
      console.log(`SKU ${sku} (direct fetch):`, JSON.stringify(result));
    }

    await context.close();
  }

  await browser.close();
}

main().catch(console.error);
