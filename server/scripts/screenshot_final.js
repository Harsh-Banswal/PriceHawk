import { getContext, closeBrowser } from '../src/scraper/browser.js';

async function takeScreenshot() {
  const ctx = await getContext({ headless: true });
  try {
    const page = await ctx.newPage();
    await page.setViewportSize({ width: 1400, height: 1800 });
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    // Scroll down to monitored grid
    await page.locator('#monitored-grid').scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);

    const gridPath = 'C:/Users/harsh/.gemini/antigravity-ide/brain/914006e2-a5cd-487f-a7cb-f016fc9794b2/monitored_grid_sneaker_x_verified.png';
    await page.screenshot({ path: gridPath, fullPage: false });
    console.log('Saved screenshot to:', gridPath);

  } finally {
    await ctx.close().catch(() => {});
    await closeBrowser().catch(() => {});
  }
}

takeScreenshot().catch(console.error);
