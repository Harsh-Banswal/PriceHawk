import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://demo.inelabteamdev.com/product/161', { waitUntil: 'networkidle' });

  // In the page, let's fetch the bundle and eval pr to see what each string is
  const decoded = await page.evaluate(async () => {
    const res = await fetch('/assets/index-B9UiQq4X.js');
    const code = await res.text();
    const idxVr = code.indexOf('function vr(){');
    const idxEnd = code.indexOf('var lr=');
    const part = code.slice(idxVr, idxEnd);
    
    // Evaluate in page
    const fn = new Function(part + '; return { P: pr, lr: lr, pr: pr };');
    const mod = fn();
    const P = mod.P;
    return {
      P500: P(500),
      P568: P(568),
      P558: P(558),
      P495: P(495),
      P520: P(520),
      P543: P(543),
      P538: P(538),
      P497: P(497),
      P509: P(509),
      P605: P(605),
      P566: P(566),
      P536: P(536),
      P588: P(588),
      P489: P(489),
      P585: P(585),
      P523: P(523),
      P526: P(526),
    };
  });
  console.log('Decoded Strings:\n', decoded);

  await browser.close();
}

main().catch(console.error);
