/**
 * Capture exact /api/session POST payload for SKU 33 using production getContext()
 * to see what's different from a successful challenge
 */
import { getContext, closeBrowser } from '../src/scraper/browser.js';

async function main() {
  let context = null;
  try {
    context = await getContext();
    const page = await context.newPage();

    let challengeResp = null;
    let sessionPostBody = null;
    let sessionStatus = null;
    let sessionRespBody = null;

    page.on('request', req => {
      if (req.url().includes('/api/session')) {
        sessionPostBody = req.postData();
      }
    });

    page.on('response', async res => {
      const url = res.url();
      if (url.includes('/api/challenge')) {
        const t = await res.text().catch(() => '');
        challengeResp = JSON.parse(t);
        console.log('challenge:', JSON.stringify({ difficulty: challengeResp.difficulty, salt: challengeResp.salt?.slice(0,12) }));
      }
      if (url.includes('/api/session')) {
        sessionStatus = res.status();
        sessionRespBody = await res.text().catch(() => '');
      }
    });

    console.log('Navigating to SKU 33...');
    await page.goto('https://demo.inelabteamdev.com/product/33', { waitUntil: 'networkidle', timeout: 60000 });

    const pb = page.locator('.price-block').first();
    await pb.scrollIntoViewIfNeeded();
    const box = await pb.boundingBox();
    if (box) {
      const sx = box.x + 30, sy = box.y + 25;
      await page.mouse.move(sx, sy);
      for (let i = 1; i <= 15; i++) { await page.waitForTimeout(60); await page.mouse.move(sx + i*10, sy + (i%2)*8); }
      await page.waitForTimeout(800);
    }

    const btn = page.locator('button[aria-label="Reveal price"]').first();
    for (let a = 1; a <= 5; a++) {
      const isIdle = await page.evaluate(() => document.querySelector('.price-block')?.classList.contains('price-idle') ?? true);
      if (!isIdle) { console.log('price-idle cleared at attempt', a); break; }
      await btn.click({ timeout: 2000 }).catch(e => console.log('click err:', e.message.slice(0, 60)));
      await page.waitForTimeout(700);
    }

    // Wait for session response
    console.log('Waiting up to 15s for session...');
    for (let i = 0; i < 15; i++) {
      await page.waitForTimeout(1000);
      if (sessionStatus !== null) break;
    }

    console.log('\n--- RESULTS ---');
    console.log('session status:', sessionStatus);
    console.log('session response:', sessionRespBody);

    if (sessionPostBody) {
      const sp = JSON.parse(sessionPostBody);
      console.log('\nsession POST body keys:', Object.keys(sp));
      console.log('nonce:', sp.nonce);
      console.log('wasmOut:', sp.wasmOut);
      console.log('derived (first 20):', sp.derived?.slice(0, 20));

      // Parse att
      const att = JSON.parse(sp.att);
      console.log('\natt.env.canvas:', att.env.canvas);
      console.log('att.env.gl:', att.env.gl);
      console.log('att.env.hc:', att.env.hc);
      console.log('att.env.scr:', att.env.scr);
      console.log('att.env.frames:', att.env.frames);
      console.log('att.ix.trusted:', att.ix?.trusted);
      console.log('att.ix.dwellMs:', att.ix?.dwellMs);
      console.log('att.ix.moves count:', att.ix?.moves?.length);
    }

  } finally {
    if (context) await context.close().catch(() => {});
    await closeBrowser().catch(() => {});
  }
}

main().catch(console.error);
