import { getContext, closeBrowser } from '../src/scraper/browser.js';

async function main() {
  let ctx = null;
  try {
    ctx = await getContext();
    const page = await ctx.newPage();
    for (const id of [351, 188, 797, 80]) {
      await page.goto(`https://demo.inelabteamdev.com/product/${id}`, { waitUntil: 'domcontentloaded' });
      // reveal price
      const btn = page.locator('button[aria-label="Reveal price"]').first();
      await btn.click({ timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(4000);

      const res = await page.evaluate(() => {
        const badge = document.querySelector('.stock-badge');
        const st = document.querySelector('[class*="st-"]');
        return {
          badgeText: badge?.innerText,
          stText: st?.innerText,
        };
      });
      console.log(`SKU ${id} ->`, res);
    }
  } finally {
    if (ctx) await ctx.close().catch(() => {});
    await closeBrowser().catch(() => {});
  }
}

main().catch(console.error);
