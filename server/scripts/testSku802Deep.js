import { getContext, closeBrowser } from '../src/scraper/browser.js';

async function testSku802Price() {
  let context = null;
  try {
    context = await getContext();
    const page = await context.newPage();
    console.log('Navigating to SKU 802...');
    await page.goto('https://demo.inelabteamdev.com/product/802', { waitUntil: 'networkidle', timeout: 60000 });

    await page.evaluate(() => document.querySelectorAll('.cookie-overlay, [class*="cookie"]').forEach(el => el.remove())).catch(() => {});
    const pb = page.locator('.price-block').first();
    await pb.scrollIntoViewIfNeeded();
    const box = await pb.boundingBox();
    if (box) {
      await page.mouse.move(box.x + 30, box.y + 25);
      for (let i = 1; i <= 15; i++) { await page.waitForTimeout(60); await page.mouse.move(box.x + 30 + i*10, box.y + 25 + (i%2)*8); }
      await page.waitForTimeout(800);
    }

    const btn = page.locator('button[aria-label="Reveal price"]').first();
    for (let a = 1; a <= 5; a++) {
      const isIdle = await page.evaluate(() => document.querySelector('.price-block')?.classList.contains('price-idle') ?? true);
      if (!isIdle) break;
      await page.evaluate(() => document.querySelectorAll('.cookie-overlay').forEach(el => el.remove())).catch(() => {});
      await btn.click({ timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(700);
    }

    // Wait for price success or try again
    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(1000);
      const isSuccess = await page.evaluate(() => document.querySelector('.price-block')?.classList.contains('price-success') || false);
      const isFailed = await page.evaluate(() => document.querySelector('.price-substatus')?.innerText || false);
      if (isSuccess) {
        console.log('Price loaded at t =', i);
        break;
      }
      if (isFailed) {
        console.log('Failed with:', isFailed, '- clicking Try again');
        await page.click('button:has-text("Try again")').catch(() => {});
      }
    }

    // Inspect all nodes with ₹
    const details = await page.evaluate(() => {
      const results = [];
      document.querySelectorAll('*').forEach(el => {
        const text = (el.innerText || '').trim();
        if (text.includes('₹') && el.children.length === 0) {
          const style = window.getComputedStyle(el);
          results.push({
            tag: el.tagName,
            text,
            decor: style.textDecorationLine || style.textDecoration,
            fontSize: style.fontSize,
            color: style.color,
            parentClass: el.parentElement?.className,
            parentTag: el.parentElement?.tagName
          });
        }
      });
      return {
        blockText: document.querySelector('.price-block')?.innerText,
        leafNodes: results
      };
    });

    console.log('Price block text:\n', details.blockText);
    console.log('\nLeaf nodes with ₹:\n', JSON.stringify(details.leafNodes, null, 2));

  } finally {
    if (context) await context.close().catch(() => {});
    await closeBrowser().catch(() => {});
  }
}

testSku802Price().catch(console.error);
