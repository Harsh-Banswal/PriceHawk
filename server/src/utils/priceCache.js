/**
 * @file priceCache.js
 * @description In-memory price cache for the /api/products endpoint.
 *
 * STRATEGY: Stale-While-Revalidate (SWR)
 *  - Fresh cache (< 60s): served instantly, no background work.
 *  - Stale cache (60s – 5min): served instantly + background Supabase re-fetch triggered.
 *  - Hard-expired (> 5min) or no cache: synchronous fetch, then cached.
 *
 * Cache is invalidated immediately after every successful scrape so the next
 * dashboard load reflects the freshly written price_history row.
 */

import logger from './logger.js';

/** Fresh window — serve as-is, no refresh needed */
const STALE_TTL_MS = 60 * 1000; // 60 seconds

/** Hard expiry — force a synchronous re-fetch even if background refresh is lagging */
const HARD_TTL_MS = 5 * 60 * 1000; // 5 minutes

/** @type {{ data: any, timestamp: number } | null} */
let cache = null;

/** Prevent multiple parallel background refreshes firing at once */
let isRefreshing = false;

/**
 * Store enriched product list in the cache.
 * @param {any} data
 */
export function setCacheEntry(data) {
  cache = { data, timestamp: Date.now() };
  logger.debug(
    `[PriceCache] Cache updated with ${Array.isArray(data?.products) ? data.products.length : '?'} products`
  );
}

/**
 * Invalidate the cache immediately.
 * Call this after every successful scrape so the next GET /api/products is fresh.
 */
export function invalidateCache() {
  cache = null;
  logger.debug('[PriceCache] Cache invalidated (post-scrape)');
}

/**
 * Stale-While-Revalidate get.
 *
 * @param {() => Promise<any>} fetcher - Fetches fresh enriched product data from Supabase
 * @returns {Promise<{ data: any, fromCache: boolean, cacheAgeMs: number | null }>}
 */
export async function getWithSWR(fetcher) {
  const now = Date.now();

  // CASE 1: Cache is fresh — serve immediately
  if (cache !== null && now - cache.timestamp < STALE_TTL_MS) {
    logger.debug(`[PriceCache] Serving fresh cache (age: ${now - cache.timestamp}ms)`);
    return { data: cache.data, fromCache: true, cacheAgeMs: now - cache.timestamp };
  }

  // CASE 2: Stale but within hard TTL — serve stale, refresh in background
  if (cache !== null && now - cache.timestamp < HARD_TTL_MS) {
    const ageMs = now - cache.timestamp;
    logger.debug(`[PriceCache] Serving stale cache (age: ${ageMs}ms), triggering background refresh`);

    if (!isRefreshing) {
      isRefreshing = true;
      fetcher()
        .then((freshData) => setCacheEntry(freshData))
        .catch((err) => logger.warn('[PriceCache] Background refresh failed:', err.message))
        .finally(() => { isRefreshing = false; });
    }

    return { data: cache.data, fromCache: true, cacheAgeMs: ageMs };
  }

  // CASE 3: No cache or hard-expired — synchronous fetch
  logger.debug('[PriceCache] Cache miss or hard-expired — fetching synchronously');
  isRefreshing = true;
  try {
    const freshData = await fetcher();
    setCacheEntry(freshData);
    return { data: freshData, fromCache: false, cacheAgeMs: null };
  } finally {
    isRefreshing = false;
  }
}

/**
 * Returns cache telemetry for /api/scrape/status.
 */
export function getCacheTelemetry() {
  return {
    hasCache: cache !== null,
    cacheAgeMs: cache ? Date.now() - cache.timestamp : null,
    isRefreshing,
    staleTtlMs: STALE_TTL_MS,
    hardTtlMs: HARD_TTL_MS,
  };
}

export default { getWithSWR, setCacheEntry, invalidateCache, getCacheTelemetry };
