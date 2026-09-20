import { chromium } from 'playwright';
import config from '../config.js';
import logger from '../utils/logger.js';

let browserInstance = null;

/**
 * Ensures a shared browser instance is running.
 */
export async function getBrowser() {
  if (!browserInstance || !browserInstance.isConnected()) {
    logger.info('Launching Playwright Chromium browser...', { headed: config.headed });
    browserInstance = await chromium.launch({
      headless: !config.headed,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
  }
  return browserInstance;
}

/**
 * Closes the active Playwright browser instance.
 */
export async function closeBrowser() {
  if (browserInstance && browserInstance.isConnected()) {
    logger.info('Closing Playwright browser instance...');
    await browserInstance.close();
    browserInstance = null;
  }
}

/**
 * Scrapes product pricing and stock details from a product page.
 *
 * @param {string} productUrl
 * @param {Object} [options]
 * @returns {Promise<{
 *   success: boolean,
 *   data?: {
 *     price: number,
 *     mrp?: number,
 *     discount_percent?: number,
 *     stock_status: string,
 *     currency: string
 *   },
 *   errorType?: 'failed_timeout' | 'failed_navigation' | 'failed_parse',
 *   errorMessage?: string
 * }>}
 */
export async function scrapeProductPage(productUrl, options = {}) {
  const timeout = options.timeout || config.navTimeoutMs;
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
  });

  const page = await context.newPage();
  page.setDefaultTimeout(timeout);
  page.setDefaultNavigationTimeout(timeout);

  try {
    let response;
    try {
      response = await page.goto(productUrl, {
        waitUntil: 'domcontentloaded',
        timeout,
      });
    } catch (navErr) {
      const msg = navErr.message || '';
      if (msg.includes('Timeout') || msg.includes('timeout')) {
        return {
          success: false,
          errorType: 'failed_timeout',
          errorMessage: `Navigation timeout after ${timeout}ms: ${msg}`,
        };
      }
      return {
        success: false,
        errorType: 'failed_navigation',
        errorMessage: `Navigation error: ${msg}`,
      };
    }

    if (response && response.status() >= 400) {
      return {
        success: false,
        errorType: 'failed_navigation',
        errorMessage: `HTTP ${response.status()} returned for URL: ${productUrl}`,
      };
    }

    // Attempt to extract pricing & stock information from common e-commerce schemas and meta tags
    try {
      const extracted = await page.evaluate(() => {
        // 1. Try structured JSON-LD data
        const jsonLdScripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
        for (const script of jsonLdScripts) {
          try {
            const data = JSON.parse(script.textContent || '{}');
            const items = Array.isArray(data) ? data : [data];
            for (const item of items) {
              if (item['@type'] === 'Product' && item.offers) {
                const offer = Array.isArray(item.offers) ? item.offers[0] : item.offers;
                const price = parseFloat(offer.price);
                const currency = offer.priceCurrency || 'INR';
                const stock = offer.availability?.includes('InStock') ? 'in_stock' : 'out_of_stock';
                if (!Number.isNaN(price) && price > 0) {
                  return { price, mrp: null, discount_percent: null, stock_status: stock, currency };
                }
              }
            }
          } catch {
            // continue fallback
          }
        }

        // 2. Try OpenGraph / Meta price tags
        const metaPrice = document.querySelector('meta[property="product:price:amount"]')?.getAttribute('content');
        const metaCurrency = document.querySelector('meta[property="product:price:currency"]')?.getAttribute('content') || 'INR';
        if (metaPrice) {
          const parsed = parseFloat(metaPrice);
          if (!Number.isNaN(parsed) && parsed > 0) {
            return { price: parsed, mrp: null, discount_percent: null, stock_status: 'in_stock', currency: metaCurrency };
          }
        }

        // 3. Try standard selectors for Indian e-commerce / common platforms
        const priceSelectors = [
          '[data-testid="selling-price"]',
          '.price-current',
          '#priceblock_ourprice',
          '#priceblock_dealprice',
          'span.a-price-whole',
          'div._30jeq3', // Flipkart selling price
          'span.price',
          '.product-price',
          '.current-price',
          '[itemprop="price"]',
        ];

        const mrpSelectors = [
          '[data-testid="mrp-price"]',
          '.price-mrp',
          '#priceblock_saleprice',
          'span.a-text-price span.a-offscreen',
          'div._3I9_wc', // Flipkart MRP
          'span.mrp',
          '.original-price',
          '.strike-price',
        ];

        const discountSelectors = [
          '[data-testid="discount-percent"]',
          '.discount-percent',
          'div._3Ay6Sb span', // Flipkart discount tag
          '.savingsPercentage',
          '.discount',
        ];

        const stockSelectors = [
          '#availability',
          '._16FRp0', // Flipkart out of stock indicator
          '.out-of-stock',
          '.in-stock',
          '[data-testid="stock-status"]',
        ];

        const findText = (selectors) => {
          for (const s of selectors) {
            const el = document.querySelector(s);
            if (el && el.textContent) {
              const text = el.textContent.trim();
              if (text) return text;
            }
          }
          return null;
        };

        const priceText = findText(priceSelectors);
        const mrpText = findText(mrpSelectors);
        const discountText = findText(discountSelectors);
        const stockText = findText(stockSelectors);

        const cleanNumber = (str) => {
          if (!str) return null;
          const cleaned = str.replace(/[^0-9.]/g, '');
          const val = parseFloat(cleaned);
          return Number.isNaN(val) ? null : val;
        };

        let parsedPrice = cleanNumber(priceText);
        let parsedMrp = cleanNumber(mrpText);
        let parsedDiscount = cleanNumber(discountText);

        let stockStatus = 'in_stock';
        if (stockText) {
          const lower = stockText.toLowerCase();
          if (lower.includes('out of stock') || lower.includes('sold out') || lower.includes('currently unavailable')) {
            stockStatus = 'out_of_stock';
          }
        }

        if (parsedPrice !== null && parsedPrice > 0) {
          return {
            price: parsedPrice,
            mrp: parsedMrp,
            discount_percent: parsedDiscount,
            stock_status: stockStatus,
            currency: 'INR',
          };
        }

        return null;
      });

      if (!extracted || !extracted.price) {
        return {
          success: false,
          errorType: 'failed_parse',
          errorMessage: 'Could not find or parse selling price element from page HTML',
        };
      }

      return {
        success: true,
        data: extracted,
      };
    } catch (parseErr) {
      return {
        success: false,
        errorType: 'failed_parse',
        errorMessage: `DOM parsing exception: ${parseErr.message}`,
      };
    }
  } finally {
    await context.close().catch(() => {});
  }
}

export default {
  getBrowser,
  closeBrowser,
  scrapeProductPage,
};
