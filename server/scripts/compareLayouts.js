/**
 * Compare /api/layout for succeeding vs failing SKUs
 */
import axios from 'axios';

async function main() {
  const skus = [161, 1, 513, 33, 245, 802];
  for (const sku of skus) {
    try {
      const res = await axios.get(`https://demo.inelabteamdev.com/api/products/${sku}/layout`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Referer': `https://demo.inelabteamdev.com/product/${sku}`,
          'Accept': 'application/json',
        }
      });
      const d = res.data;
      console.log(`SKU ${sku}: variant=${d.variant} priceCarrier=${d.priceCarrier} priceTag=${d.priceTag} order=${JSON.stringify(d.order)}`);
    } catch (e) {
      console.log(`SKU ${sku}: ERROR`, e.response?.status, e.message);
    }
  }
}

main().catch(console.error);
