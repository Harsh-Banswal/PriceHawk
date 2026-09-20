import { getContext, closeBrowser } from '../src/scraper/browser.js';
import { extractFromPage } from '../src/scraper/priceExtractor.js';

async function testWhyPriceNull() {
  let context = null;
  try {
    context = await getContext();
    const page = await context.newPage();
    await page.goto('https://demo.inelabteamdev.com/product/80', { waitUntil: 'networkidle', timeout: 60000 });

    // Dismiss cookie banner
    for (let c = 1; c <= 3; c++) {
      const b = page.locator('button[aria-label="Accept cookies"]').first();
      if (await b.isVisible({ timeout: 300 }).catch(() => false)) {
        await b.click().catch(() => {});
        await page.waitForTimeout(200);
      }
    }
    await page.evaluate(() => document.querySelectorAll('.cookie-overlay, [class*="cookie"]').forEach(el => el.remove())).catch(() => {});

    // Hover & click
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
      await btn.click({ timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(700);
    }

    // Wait 5s for price-success
    await page.waitForTimeout(5000);

    // Run custom inspection
    const data = await page.evaluate(() => {
      const strikePattern = /(strike|line-?through|linethrough|del|decoy|old-?price|crossed|original-?price)/i;
      function isElementOrAncestorStruck(el) {
        let curr = el;
        while (curr && curr !== document.body && curr !== document.documentElement) {
          if (curr.tagName === 'DEL' || curr.tagName === 'S' || curr.tagName === 'STRIKE') return true;
          if (strikePattern.test(curr.className || '') || curr.getAttribute('data-decoy') === 'true' || curr.getAttribute('aria-hidden') === 'true') return true;
          const style = window.getComputedStyle(curr);
          if ((style.textDecorationLine || style.textDecoration || '').toLowerCase().includes('line-through')) return true;
          curr = curr.parentElement;
        }
        return false;
      }
      function isStruckThrough(el) {
        if (isElementOrAncestorStruck(el)) return true;
        if (el.children && el.children.length > 0) {
          const descendants = el.querySelectorAll('*');
          for (const desc of descendants) {
            if (desc.tagName === 'DEL' || desc.tagName === 'S' || desc.tagName === 'STRIKE') return true;
            if (strikePattern.test(desc.className || '') || desc.getAttribute('data-decoy') === 'true') return true;
            const descStyle = window.getComputedStyle(desc);
            if ((descStyle.textDecorationLine || descStyle.textDecoration || '').toLowerCase().includes('line-through')) return true;
          }
        }
        return false;
      }

      const allElements = Array.from(document.querySelectorAll('*'));
      const rawMatches = [];
      for (const el of allElements) {
        const text = (el.innerText || '').trim();
        const compacted = text.replace(/[\s\r\n]+/g, '');
        if (/^₹[\d,]+/.test(compacted)) {
          rawMatches.push({
            tag: el.tagName,
            className: el.className,
            text,
            isStruck: isStruckThrough(el),
            hasChildren: el.children.length
          });
        }
      }
      return rawMatches;
    });

    console.log('Matches matching /^₹[\\d,]+/:\n', JSON.stringify(data, null, 2));

    const ex = await extractFromPage(page);
    console.log('\nextractFromPage result:\n', JSON.stringify(ex, null, 2));

  } finally {
    if (context) await context.close().catch(() => {});
    await closeBrowser().catch(() => {});
  }
}

testWhyPriceNull().catch(console.error);
