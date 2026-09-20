/**
 * Debug SKU 33 (Ironwood Keyboard Pro) specifically
 */
import { getContext, closeBrowser } from '../src/scraper/browser.js';

async function main() {
  let context = null;
  try {
    context = await getContext();
    const page = await context.newPage();

    page.on('response', async res => {
      const url = res.url();
      if (url.includes('session') || url.includes('challenge') || url.includes('/price') || url.includes('layout')) {
        const text = await res.text().catch(() => '');
        console.log(`<- ${res.status()} ${url.split('/').slice(-2).join('/')} | ${text.slice(0, 120)}`);
      }
    });

    console.log('[1] Navigating to product 33...');
    await page.goto('https://demo.inelabteamdev.com/product/33', {
      waitUntil: 'networkidle',
      timeout: 60000,
    });
    console.log('[1] Navigation done');

    // Check overlay + price-block
    const info = await page.evaluate(() => {
      const overlay = document.querySelectorAll('.cookie-overlay').length;
      const pb = document.querySelector('.price-block');
      return { overlay, classList: Array.from(pb?.classList ?? []) };
    });
    console.log('[2] overlay count:', info.overlay, 'price-block:', info.classList);

    // Scroll + hover
    const priceBlock = page.locator('.price-block').first();
    await priceBlock.scrollIntoViewIfNeeded();
    const box = await priceBlock.boundingBox();
    if (box) {
      const startX = box.x + 30, startY = box.y + 25;
      await page.mouse.move(startX, startY);
      for (let i = 1; i <= 15; i++) {
        await page.waitForTimeout(60);
        await page.mouse.move(startX + i * 10, startY + (i % 2) * 8);
      }
      await page.waitForTimeout(800);
      console.log('[3] Hover done');
    }

    const revealBtn = page.locator('button[aria-label="Reveal price"]').first();
    for (let attempt = 1; attempt <= 6; attempt++) {
      const state = await page.evaluate(() => {
        const el = document.querySelector('.price-block');
        return { isIdle: el?.classList.contains('price-idle') ?? true, classList: Array.from(el?.classList ?? []) };
      });
      console.log(`[4.${attempt}] State:`, state.classList.join(' '));
      if (!state.isIdle) { console.log('[4] Click processed!'); break; }

      if (await revealBtn.isVisible({ timeout: 500 }).catch(() => false) && !await revealBtn.isDisabled().catch(() => true)) {
        const err = await revealBtn.click({ timeout: 2000 }).then(() => null).catch(e => e.message);
        console.log(`[4.${attempt}] click:`, err || 'OK');
      }
      await page.waitForTimeout(700);
    }

    console.log('[5] Waiting 30s for price to appear...');
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(1000);
      const state = await page.evaluate(() => {
        const el = document.querySelector('.price-block');
        return { classList: Array.from(el?.classList ?? []), text: el?.innerText?.slice(0, 100) };
      });
      console.log(`  @${i+1}s:`, state.classList.join(' '), '|', state.text?.replace(/\n/g,' ').slice(0,60));
      if (state.classList.includes('price-success') || state.classList.includes('price-error')) break;
    }

  } finally {
    if (context) await context.close().catch(() => {});
    await closeBrowser().catch(() => {});
  }
}

main().catch(console.error);
