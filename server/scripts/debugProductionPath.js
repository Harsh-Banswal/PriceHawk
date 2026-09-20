/**
 * Debug the production getContext() path step by step with verbose logging
 */
import { getContext, closeBrowser } from '../src/scraper/browser.js';

async function main() {
  let context = null;
  try {
    context = await getContext();
    const page = await context.newPage();

    page.on('response', async res => {
      const url = res.url();
      if (url.includes('session') || url.includes('challenge') || url.includes('/price')) {
        const text = await res.text().catch(() => '');
        console.log(`<- ${res.status()} ${url.slice(-40)}`, text.slice(0, 80));
      }
    });

    console.log('[1] Navigating with networkidle...');
    const t0 = Date.now();
    await page.goto('https://demo.inelabteamdev.com/product/161', {
      waitUntil: 'networkidle',
      timeout: 60000,
    });
    console.log(`[1] Navigation done in ${Date.now() - t0}ms`);

    // Check if overlay is suppressed
    const overlayCount = await page.evaluate(() =>
      document.querySelectorAll('.cookie-overlay').length
    );
    console.log('[2] cookie-overlay elements found:', overlayCount);

    // Check price-block state
    const priceBlockInfo = await page.evaluate(() => {
      const el = document.querySelector('.price-block');
      if (!el) return null;
      return { classList: Array.from(el.classList), visible: el.offsetParent !== null };
    });
    console.log('[3] price-block info:', JSON.stringify(priceBlockInfo));

    // Scroll into view
    const priceBlock = page.locator('.price-block').first();
    const isBlockVisible = await priceBlock.isVisible({ timeout: 3000 }).catch(e => {
      console.log('[3b] isVisible error:', e.message);
      return false;
    });
    console.log('[3c] isBlockVisible:', isBlockVisible);

    if (isBlockVisible) {
      const box = await priceBlock.boundingBox();
      console.log('[4] boundingBox:', JSON.stringify(box));

      if (box) {
        const startX = box.x + 30;
        const startY = box.y + 25;
        await page.mouse.move(startX, startY);
        for (let i = 1; i <= 15; i++) {
          await page.waitForTimeout(60);
          await page.mouse.move(startX + i * 10, startY + (i % 2) * 8);
        }
        await page.waitForTimeout(800);
        console.log('[5] Hover done');
      }

      const revealBtn = page.locator('button[aria-label="Reveal price"]').first();

      for (let attempt = 1; attempt <= 6; attempt++) {
        const state = await page.evaluate(() => {
          const el = document.querySelector('.price-block');
          return {
            classList: Array.from(el?.classList ?? []),
            isIdle: el?.classList.contains('price-idle') ?? false,
            btnDisabled: document.querySelector('button[aria-label="Reveal price"]')?.disabled ?? null,
          };
        }).catch(() => ({ isIdle: true, btnDisabled: null }));

        console.log(`[6.${attempt}] State:`, JSON.stringify(state));

        if (!state.isIdle) {
          console.log('[6] price-idle cleared — click was processed!');
          break;
        }

        const isBtnVisible = await revealBtn.isVisible({ timeout: 500 }).catch(() => false);
        const isBtnDisabled = await revealBtn.isDisabled().catch(() => true);
        console.log(`[6.${attempt}] btn visible=${isBtnVisible} disabled=${isBtnDisabled}`);

        if (isBtnVisible && !isBtnDisabled) {
          // Try NORMAL click first (produces isTrusted=true)
          const clickErr = await revealBtn.click({ timeout: 2000 }).then(() => null).catch(e => e.message);
          console.log(`[6.${attempt}] click result:`, clickErr || 'OK');
        }

        await page.waitForTimeout(700);
      }
    }

    // Check final state
    const finalInfo = await page.evaluate(() => {
      const el = document.querySelector('.price-block');
      return el ? { classList: Array.from(el.classList), innerText: el.innerText.slice(0, 100) } : null;
    });
    console.log('[7] Final price-block:', JSON.stringify(finalInfo));

    // Wait and sample
    console.log('[8] Waiting 8s for price to load...');
    await page.waitForTimeout(8000);

    const finalInfo2 = await page.evaluate(() => {
      const el = document.querySelector('.price-block');
      return el ? { classList: Array.from(el.classList), innerText: el.innerText.slice(0, 200) } : null;
    });
    console.log('[9] Price block after 8s:', JSON.stringify(finalInfo2));

  } finally {
    if (context) await context.close().catch(() => {});
    await closeBrowser().catch(() => {});
  }
}

main().catch(console.error);
