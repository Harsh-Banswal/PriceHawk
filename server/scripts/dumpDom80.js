import { getContext, closeBrowser } from '../src/scraper/browser.js';

async function dumpDom(sku) {
  let context = null;
  try {
    context = await getContext();
    const page = await context.newPage();
    await page.goto(`https://demo.inelabteamdev.com/product/${sku}`, { waitUntil: 'networkidle', timeout: 60000 });

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

    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(1000);
      const isSuccess = await page.evaluate(() => document.querySelector('.price-block')?.classList.contains('price-success') || false);
      const isFailed = await page.evaluate(() => document.querySelector('.price-substatus')?.innerText || false);
      if (isSuccess) { console.log('Price loaded at t =', i); break; }
      if (isFailed) {
        console.log('Got failed: ' + isFailed + ', retrying click...');
        await page.click('button:has-text("Try again")').catch(() => {});
      }
    }

    const elements = await page.evaluate(() => {
      const block = document.querySelector('.price-block');
      if (!block) return [];
      return Array.from(block.querySelectorAll('*')).map(el => {
        const s = window.getComputedStyle(el);
        return {
          tag: el.tagName,
          class: el.className,
          text: el.innerText,
          directText: Array.from(el.childNodes).filter(n => n.nodeType === 3).map(n => n.textContent.trim()).filter(Boolean).join(' '),
          decor: s.textDecorationLine || s.textDecoration,
          fontSize: s.fontSize,
          display: s.display,
          childCount: el.children.length
        };
      });
    });

    console.log(`=== DUMP FOR SKU ${sku} ===`);
    for (const el of elements) {
      console.log(`[${el.tag}] .${el.class} | children: ${el.childCount} | direct: "${el.directText}" | decor: "${el.decor}" | text: "${el.text.replace(/\n/g, ' ')}"`);
    }

  } finally {
    if (context) await context.close().catch(() => {});
    await closeBrowser().catch(() => {});
  }
}

dumpDom(80).catch(console.error);
