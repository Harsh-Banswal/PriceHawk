#!/usr/bin/env node
/**
 * @file headedRun.js
 * @description Headed scrape runner displaying a live terminal timeline and visible Chromium browser.
 *
 * Runs the exact production scrapeProduct.js / priceExtractor.js / waitForStablePrice.js logic.
 *
 * CLI Arguments:
 *   --productId <id>        Target a specific product ID in Supabase
 *   --simulate slow         Delays /api/products/:id/price response by ~5s via page.route()
 *   --simulate error        Aborts the first /api/session call to trigger a whole-page retry
 *
 * Usage:
 *   npm run scrape:headed
 *   npm run scrape:headed:slow
 *   npm run scrape:headed:error
 */

// 1. Force HEADED=true before loading any config/browser modules
process.env.HEADED = 'true';

import config from '../src/config.js';
import supabase from '../src/db/supabase.js';
import { getBrowser, getContext, closeBrowser } from '../src/scraper/browser.js';
import { scrapeProductWithRetry } from '../src/scraper/scrapeProduct.js';

// Parse command line arguments
const args = process.argv.slice(2);

function getArgValue(flag) {
  const idx = args.indexOf(flag);
  if (idx !== -1 && idx + 1 < args.length) {
    return args[idx + 1];
  }
  const prefix = `${flag}=`;
  const matching = args.find((a) => a.startsWith(prefix));
  if (matching) {
    return matching.slice(prefix.length);
  }
  return null;
}

const targetProductId = getArgValue('--productId');
const simulateMode = getArgValue('--simulate'); // 'slow' | 'error' | null

const timelineStart = Date.now();
function elapsed() {
  return `+${Date.now() - timelineStart}ms`;
}

function logTimeline(phase, message, details = null) {
  const timestamp = `[${elapsed().padStart(8)}]`;
  console.log(`${timestamp} [${phase}] ${message}`);
  if (details) {
    if (typeof details === 'object') {
      for (const [key, val] of Object.entries(details)) {
        console.log(`           |-- ${key}: ${typeof val === 'object' ? JSON.stringify(val) : val}`);
      }
    } else {
      console.log(`           |-- ${details}`);
    }
  }
}

async function resolveTargetProduct() {
  // If a specific productId was passed
  if (targetProductId) {
    logTimeline('INIT', `Searching for product ID: ${targetProductId}`);
    try {
      const { data, error } = await supabase
        .from('tracked_products')
        .select('*')
        .eq('id', targetProductId)
        .single();

      if (!error && data) {
        return data;
      }
    } catch {
      // Fall through to sample
    }
  }

  // Otherwise, attempt to load first active product from DB
  try {
    const { data: products } = await supabase
      .from('tracked_products')
      .select('*')
      .eq('is_active', true)
      .limit(1);

    if (products && products.length > 0) {
      return products[0];
    }
  } catch {
    // Fall through
  }

  // Fallback demo product matching demo.inelabteamdev.com
  return {
    id: targetProductId || 'demo-prod-001',
    name: 'Wireless Noise Cancelling Headphones',
    slug: 'wireless-noise-cancelling-headphones',
    product_url: `${config.storeBaseUrl.replace(/\/+$/, '')}/p/wireless-noise-cancelling-headphones`,
    is_active: true,
  };
}

async function main() {
  console.log('='.repeat(80));
  console.log('                 HEADED SCRAPE RUN TIMELINE MONITOR');
  console.log('='.repeat(80));

  const product = await resolveTargetProduct();

  console.log(`Target Product: "${product.name}" (ID: ${product.id})`);
  console.log(`Target URL:     ${product.product_url}`);
  console.log(`Browser Mode:   HEADED (Chromium window visible)`);
  console.log(`Simulation:     ${simulateMode ? simulateMode.toUpperCase() : 'NONE'}`);
  console.log('-'.repeat(80));

  // Initialize headed browser
  logTimeline('BROWSER', 'Launching visible Chromium instance...');
  const browser = await getBrowser();
  const context = await getContext({ timeout: config.navTimeoutMs });
  const page = await context.newPage();

  // Setup simulation interceptors via page.route() if requested
  if (simulateMode === 'slow') {
    logTimeline('SIMULATION', 'Configuring --simulate slow: Intercepting price endpoint to delay by 5000ms');
    await page.route('**/price*', async (route) => {
      logTimeline('SIM:SLOW', `Intercepted price request: ${route.request().url()}`);
      logTimeline('SIM:SLOW', 'Injecting 5000ms response delay to demonstrate stability-wait logic...');
      await new Promise((res) => setTimeout(res, 5000));
      logTimeline('SIM:SLOW', '5000ms delay elapsed. Resuming network response.');
      await route.continue();
    });
  } else if (simulateMode === 'error') {
    logTimeline('SIMULATION', 'Configuring --simulate error: Aborting first /api/session call to trigger full-page retry');
    let sessionCallCount = 0;
    await page.route('**/session*', async (route) => {
      sessionCallCount += 1;
      if (sessionCallCount === 1) {
        logTimeline('SIM:ERROR', `Intercepted attempt #1 session request: ${route.request().url()}`);
        logTimeline('SIM:ERROR', 'Aborting first /api/session request to trigger whole-page retry backoff...');
        await route.abort('failed');
      } else {
        logTimeline('SIM:ERROR', `Session request attempt #${sessionCallCount} allowed to proceed.`);
        await route.continue();
      }
    });
  }

  let pollCount = 0;

  // Execute exact production scrape function with telemetry hooks
  logTimeline('SCRAPER', 'Starting scrapeProductWithRetry...');

  const result = await scrapeProductWithRetry(page, product.product_url, {
    navTimeoutMs: config.navTimeoutMs,
    maxAttempts: config.scrapeMaxAttempts,

    onNavigateStart: ({ productUrl, attempt }) => {
      logTimeline(`ATTEMPT ${attempt}`, `Navigation initiated to ${productUrl}`);
    },

    onSample: ({ elapsed: sampleElapsed, price, rawTexts, mrp, discountPercent, reconciled }) => {
      pollCount += 1;
      const priceStr = price !== null ? `₹${price}` : 'null (awaiting decryption)';
      logTimeline(`POLL #${pollCount}`, `Stability reading at +${sampleElapsed}ms: ${priceStr}`, {
        reconciledSoFar: reconciled,
        mrpFound: mrp !== null ? `₹${mrp}` : 'none',
        discountFound: discountPercent !== null ? `${discountPercent}%` : 'none',
      });

      // On first poll that finds candidates, display discarded vs accepted candidates
      if (pollCount === 1 && rawTexts) {
        if (rawTexts.struckThroughCandidates && rawTexts.struckThroughCandidates.length > 0) {
          logTimeline('CANDIDATES', 'Struck-through nodes detected (DISCARDED as decoys/original MRP):', {
            discarded: rawTexts.struckThroughCandidates.join(', '),
            reason: 'Computed style text-decoration contains line-through',
          });
        }
        if (rawTexts.priceCandidates && rawTexts.priceCandidates.length > 0) {
          logTimeline('CANDIDATES', 'Unstruck candidate prices detected:', {
            activeCandidates: rawTexts.priceCandidates.join(', '),
          });
        }
      }
    },

    onExtraction: (extraction) => {
      logTimeline('EXTRACTED', `Stable DOM extracted after ${pollCount} polling intervals:`, {
        extractedPrice: `₹${extraction.price}`,
        extractedMrp: extraction.mrp ? `₹${extraction.mrp}` : 'null',
        extractedDiscount: extraction.discountPercent ? `${extraction.discountPercent}%` : 'null',
        stockStatus: extraction.stockStatus,
      });
    },

    onReconcile: ({ price, mrp, discountPercent, reconciled }) => {
      logTimeline('RECONCILE', 'Executing MRP and discount reconciliation check...', {
        sellingPrice: `₹${price}`,
        mrp: mrp ? `₹${mrp}` : 'null',
        discountPercent: discountPercent ? `${discountPercent}%` : 'null',
        formula: mrp && discountPercent ? `|${price} - (${mrp} * (1 - ${discountPercent}/100))| <= 2` : 'N/A',
        reconciledResult: reconciled ? 'PASS' : 'FAIL',
      });
    },

    onRetry: (err, attempt, delayMs) => {
      logTimeline('RETRY', `Attempt #${attempt} failed (${err.message}). Retrying whole page in ${delayMs}ms...`);
    },
  });

  console.log('-'.repeat(80));
  logTimeline('OUTCOME', `Scrape cycle ended with outcome: [${result.outcome}]`, {
    reconciled: result.reconciled,
    totalAttempts: result.attemptCount,
    durationMs: result.durationMs,
    errorMessage: result.errorMessage || 'none',
  });

  // Database persistence adherence to CRITICAL RULE
  let wrotePriceHistory = false;

  try {
    // 1. Unconditionally write to scrape_logs
    const { error: logErr } = await supabase.from('scrape_logs').insert([
      {
        product_id: product.id,
        outcome: result.outcome,
        attempt_count: result.attemptCount,
        duration_ms: result.durationMs,
        error_message: result.errorMessage,
        price_reconciled: result.reconciled,
      },
    ]);
    if (!logErr) {
      logTimeline('DB', `Logged outcome [${result.outcome}] to scrape_logs`);
    }

    // 2. CRITICAL RULE: Write to price_history ONLY if reconciled === true
    if (result.reconciled && result.data && result.data.price > 0) {
      const { error: priceErr } = await supabase.from('price_history').insert([
        {
          product_id: product.id,
          price: result.data.price,
          mrp: result.data.mrp,
          discount_percent: result.data.discountPercent,
          currency: result.data.currency || 'INR',
          stock_status: result.data.stockStatus,
        },
      ]);
      if (!priceErr) {
        wrotePriceHistory = true;
      }
    }
  } catch (dbErr) {
    logTimeline('DB:WARN', `Database persistence note: ${dbErr.message}`);
  }

  // Gracefully close browser
  await context.close().catch(() => {});
  await closeBrowser();

  console.log('='.repeat(80));
  if (wrotePriceHistory || (result.reconciled && result.data && result.data.price > 0)) {
    console.log('WROTE price_history row');
  } else {
    console.log(`NO price_history row written — reason: ${result.outcome}`);
  }
  console.log('='.repeat(80));
}

main().catch(async (fatalErr) => {
  console.error('\n[FATAL ERROR]', fatalErr);
  await closeBrowser();
  console.log(`NO price_history row written — reason: ${fatalErr.message}`);
  process.exit(1);
});
