import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto('https://demo.inelabteamdev.com/product/582', { waitUntil: 'networkidle' });

  const scripts = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('script')).map(s => ({
      src: s.src,
      inline: s.innerText ? s.innerText.slice(0, 300) : null
    }));
  });
  console.log('Scripts:', scripts);

  // Let's inspect event listeners or what triggers the reveal button to enable
  const btnDetails = await page.evaluate(() => {
    const btn = document.querySelector('button[aria-label="Reveal price"]');
    if (!btn) return 'no btn';
    const card = btn.closest('.card') || btn.parentElement;
    return {
      btnId: btn.id,
      btnClasses: btn.className,
      cardHTML: card ? card.outerHTML : null,
    };
  });
  console.log('Button details:', btnDetails);

  await browser.close();
}

main().catch(console.error);
