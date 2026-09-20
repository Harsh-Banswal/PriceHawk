/**
 * Compare challenge solve for SKU 33 (variant:2, fails) vs SKU 161 (variant:1, succeeds)
 */
import { getContext, closeBrowser } from '../src/scraper/browser.js';

async function testProduct(id, label) {
  let context = null;
  try {
    context = await getContext();
    const page = await context.newPage();

    let challengeData = null;
    let sessionStatus = null;
    let sessionBody = null;
    let sessionPostData = null;

    page.on('request', req => {
      if (req.url().includes('/api/session')) {
        sessionPostData = req.postData();
      }
    });

    page.on('response', async res => {
      const url = res.url();
      if (url.includes('/api/challenge')) {
        const text = await res.text().catch(() => '');
        challengeData = JSON.parse(text);
        console.log(`[${label}] challenge:`, JSON.stringify({ salt: challengeData.salt?.slice(0,8), ts: challengeData.ts, difficulty: challengeData.difficulty }));
      }
      if (url.includes('/api/session')) {
        sessionStatus = res.status();
        sessionBody = await res.text().catch(() => '');
      }
    });

    await page.goto(`https://demo.inelabteamdev.com/product/${id}`, { waitUntil: 'networkidle', timeout: 60000 });

    const priceBlock = page.locator('.price-block').first();
    await priceBlock.scrollIntoViewIfNeeded();
    const box = await priceBlock.boundingBox();
    if (box) {
      const sx = box.x + 30, sy = box.y + 25;
      await page.mouse.move(sx, sy);
      for (let i = 1; i <= 15; i++) {
        await page.waitForTimeout(60);
        await page.mouse.move(sx + i*10, sy + (i%2)*8);
      }
      await page.waitForTimeout(800);
    }

    const btn = page.locator('button[aria-label="Reveal price"]').first();
    for (let a = 1; a <= 4; a++) {
      const isIdle = await page.evaluate(() => document.querySelector('.price-block')?.classList.contains('price-idle') ?? true);
      if (!isIdle) break;
      await btn.click({ timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(700);
    }

    await page.waitForTimeout(5000);

    // Parse the session POST payload to check wat output
    let att = null;
    try { att = JSON.parse(JSON.parse(sessionPostData || '{}').att || 'null'); } catch {}

    console.log(`[${label}] session status:`, sessionStatus);
    console.log(`[${label}] session body:`, sessionBody?.slice(0,100));
    if (sessionPostData) {
      const sp = JSON.parse(sessionPostData);
      console.log(`[${label}] nonce:`, sp.nonce, 'wasmOut:', sp.wasmOut, 'derived:', sp.derived?.slice(0,12));
    }

  } finally {
    if (context) await context.close().catch(() => {});
    await closeBrowser().catch(() => {});
  }
}

async function main() {
  console.log('\n=== Testing SKU 161 (should succeed) ===');
  await testProduct(161, 'SKU161');

  console.log('\n=== Testing SKU 33 (fails 401) ===');
  await testProduct(33, 'SKU33');
}

main().catch(console.error);
