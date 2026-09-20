/**
 * @file browser.js
 * @description Playwright Browser Lifecycle Manager for Price Scraping.
 *
 * REASONING:
 * 1. Why Headless Playwright is Required:
 *    The target store (demo.inelabteamdev.com) protects pricing behind a multi-step gated chain:
 *    - GET /api/products/:id only returns non-pricing metadata (name, brand, specs).
 *    - The frontend executes a dynamic challenge (WASM-based Proof-of-Work blob via /api/challenge).
 *    - A temporary session token (valid for only 30s) is acquired via POST /api/session.
 *    - The price endpoint GET /api/products/:id/price returns an encrypted payload.
 *    - Decryption is executed entirely in-browser by the site's client-side JavaScript.
 *    - Visual digits are rendered into rotating obfuscated CSS classes, with split/reordered DOM nodes.
 *    Therefore, a real headless browser is required rather than plain HTTP scraping.
 *
 * 2. Browser Reusability & Context Isolation:
 *    Launching a new Chromium instance per product would incur ~800-1500ms launch overhead,
 *    spike CPU/RAM, and easily exhaust system process limits. Instead:
 *    - A single Chromium instance is launched and reused throughout an entire scrape cycle.
 *    - Each product scrape creates an isolated BrowserContext (with independent cookies/cache/storage)
 *      to avoid session bleed and 30-second token cross-contamination.
 *    - The browser is gracefully closed at the completion of each scrape cycle.
 */

import { chromium } from 'playwright';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../config.js';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('playwright').Browser|null} */
let sharedBrowser = null;
let sharedBrowserIsHeadless = null;

/**
 * Returns the active shared Chromium browser instance, launching one if not already running.
 * Reused across all product scrapes within a scrape cycle.
 *
 * @returns {Promise<import('playwright').Browser>}
 */
let activeContexts = 0;
let idleCloseTimer = null;

function resetIdleTimer() {
  if (idleCloseTimer) {
    clearTimeout(idleCloseTimer);
    idleCloseTimer = null;
  }
  if (activeContexts === 0 && sharedBrowser && sharedBrowser.isConnected()) {
    // Keep browser warm for 5 minutes between scrapes — eliminates repeat cold-start overhead.
    // Render containers stay alive; this avoids paying 1-2s Chromium launch on every request.
    idleCloseTimer = setTimeout(async () => {
      if (activeContexts === 0) {
        await closeBrowser().catch(() => {});
      }
    }, 5 * 60 * 1000);
    // Don't keep Node process alive just for the idle timer
    if (idleCloseTimer.unref) {
      idleCloseTimer.unref();
    }
  }
}

/**
 * Returns the active shared Chromium browser instance, launching one if not already running.
 * Reused across all product scrapes within a scrape cycle.
 *
 * @returns {Promise<import('playwright').Browser>}
 */
export async function getBrowser() {
  if (idleCloseTimer) {
    clearTimeout(idleCloseTimer);
    idleCloseTimer = null;
  }

  // Live reload .env to detect HEADED changes immediately without requiring server restart
  try {
    dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: true });
  } catch {
    // ignore
  }

  const isHeadless = process.env.HEADED !== 'true';

  // If a browser is already running in the opposite mode (e.g. headed vs headless toggled), close it
  if (
    sharedBrowser &&
    sharedBrowser.isConnected() &&
    sharedBrowserIsHeadless !== null &&
    sharedBrowserIsHeadless !== isHeadless
  ) {
    logger.info(
      `Browser mode switched (${sharedBrowserIsHeadless ? 'headless' : 'headed'} -> ${isHeadless ? 'headless' : 'headed'}). Closing previous browser...`
    );
    try {
      await sharedBrowser.close();
    } catch {}
    sharedBrowser = null;
    sharedBrowserIsHeadless = null;
  }

  if (!sharedBrowser || !sharedBrowser.isConnected()) {
    sharedBrowserIsHeadless = isHeadless;
    logger.info('Launching shared Chromium instance for scrape cycle...', {
      headless: isHeadless,
    });

    sharedBrowser = await chromium.launch({
      headless: isHeadless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',       // saves ~100MB RAM on Render free tier; eliminates zygote/renderer IPC
        '--disable-gpu',           // no GPU in cloud — avoids spawning GPU process
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-default-apps',
        '--mute-audio',
      ],
    });
  }
  return sharedBrowser;
}

/**
 * Creates a new, isolated browser context for a product scrape.
 * Configures realistic user-agent, viewport, and navigation timeout.
 *
 * @param {Object} [options]
 * @param {number} [options.timeout] - Navigation timeout in milliseconds
 * @returns {Promise<import('playwright').BrowserContext>}
 */
export async function getContext(options = {}) {
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 },
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
  });

  // Permanently suppress the cookie-overlay div before any page JS runs.
  // The store injects <div class="cookie-overlay"> ~1.5s after navigation; Playwright validates
  // that no element intercepts pointer events before executing any click, so this overlay
  // causes every revealBtn.click() to fail with "intercepts pointer events" even though
  // the button is visible and enabled. Using addInitScript ensures the style rule and
  // MutationObserver removal run BEFORE the overlay is injected, on every page in this context.
  await context.addInitScript(() => {
    const style = document.createElement('style');
    style.textContent = `
      .cookie-overlay, [class*="cookie-overlay"], [id*="cookie-overlay"] {
        display: none !important;
        pointer-events: none !important;
        visibility: hidden !important;
        width: 0 !important;
        height: 0 !important;
        opacity: 0 !important;
        z-index: -99999 !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);

    // Belt-and-suspenders: continuously nuke any injected overlay nodes
    const nuke = () => {
      document.querySelectorAll('.cookie-overlay, [class*="cookie-overlay"]').forEach((el) => el.remove());
    };
    nuke();
    const observer = new MutationObserver(nuke);
    observer.observe(document.documentElement, { childList: true, subtree: true });
  });

  activeContexts += 1;
  context.on('close', () => {
    activeContexts = Math.max(0, activeContexts - 1);
    resetIdleTimer();
  });

  const defaultTimeout = options.timeout || config.navTimeoutMs;
  context.setDefaultTimeout(defaultTimeout);
  context.setDefaultNavigationTimeout(defaultTimeout);

  return context;
}

/**
 * Closes the shared Chromium browser instance at the conclusion of a scrape cycle.
 *
 * @returns {Promise<void>}
 */
export async function closeBrowser() {
  if (idleCloseTimer) {
    clearTimeout(idleCloseTimer);
    idleCloseTimer = null;
  }

  if (sharedBrowser) {
    const browserToClose = sharedBrowser;
    sharedBrowser = null;
    sharedBrowserIsHeadless = null;
    activeContexts = 0;

    if (browserToClose.isConnected()) {
      logger.info('Closing shared Chromium browser instance at cycle end...');
      try {
        await Promise.race([
          browserToClose.close(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Browser teardown timed out')), 5000)
          ),
        ]);
      } catch (err) {
        logger.error('Error closing Chromium instance:', err);
      }
    }
  }
}

export default {
  getBrowser,
  getContext,
  closeBrowser,
};
