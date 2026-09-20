/**
 * @file products.js
 * @description REST endpoints for managing tracked products, price history, and scrape logs.
 */

import express from 'express';
import axios from 'axios';
import config from '../config.js';
import supabase from '../db/supabase.js';
import logger from '../utils/logger.js';
import { scrapeTrackedProduct } from '../scraper/runScrapeCycle.js';
import { getWithSWR, invalidateCache } from '../utils/priceCache.js';

const router = express.Router();

/**
 * Helper to compute date range cutoff ISO string.
 *
 * @param {'24h' | '7d' | '30d' | 'all'} range
 * @returns {string|null}
 */
function getCutoffDate(range) {
  const now = Date.now();
  switch (range) {
    case '24h':
      return new Date(now - 24 * 60 * 60 * 1000).toISOString();
    case '7d':
      return new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
    case '30d':
      return new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
    case 'all':
    default:
      return null;
  }
}

/**
 * POST /api/products
 * Body: { storeProductId, name, slug }
 * Upserts tracked_products, then runs one immediate Playwright scrape so the UI isn't empty.
 */
router.post('/', async (req, res, next) => {
  const storeProductId = req.body.storeProductId || req.body.store_product_id;
  const name = req.body.name;
  const slug = req.body.slug || String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const productUrl =
    req.body.productUrl ||
    req.body.product_url ||
    `${config.storeBaseUrl.replace(/\/+$/, '')}/product/${storeProductId}`;

  if (!storeProductId || !name || !slug) {
    return res.status(400).json({
      error: 'storeProductId, name, and slug are required in request body',
    });
  }

  try {
    logger.info(`Upserting tracked product: ${storeProductId} (${name})`);

    const upsertPayload = {
      store_product_id: storeProductId,
      name,
      slug,
      product_url: productUrl,
      is_active: true,
      scrape_interval_minutes: req.body.scrapeIntervalMinutes || req.body.scrape_interval_minutes || 120,
    };

    // Upsert on store_product_id
    const { data: product, error: upsertErr } = await supabase
      .from('tracked_products')
      .upsert(upsertPayload, { onConflict: 'store_product_id' })
      .select()
      .single();

    if (upsertErr) throw upsertErr;

    // Run one immediate Playwright scrape so UI isn't empty
    logger.info(`Running immediate initial Playwright scrape for product ${product.id}`);
    let scrapeResult = null;
    try {
      scrapeResult = await scrapeTrackedProduct(product);
      // Invalidate cache so dashboard immediately shows the new product's price
      if (scrapeResult && scrapeResult.reconciled) {
        invalidateCache();
      }
    } catch (scrapeErr) {
      logger.error(`Initial scrape encountered an error for ${product.id}:`, scrapeErr);
      scrapeResult = {
        outcome: 'failed_navigation',
        reconciled: false,
        errorMessage: scrapeErr.message,
      };
    }

    return res.status(201).json({
      message: 'Product tracked successfully with initial scrape complete',
      product,
      initialScrape: scrapeResult,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Fetches and enriches all tracked products from Supabase.
 * Extracted as a standalone function so it can be used both directly and as the cache fetcher.
 *
 * @returns {Promise<{ products: Array }>}
 */
async function fetchEnrichedProducts() {
  const { data: products, error: prodErr } = await supabase
    .from('tracked_products')
    .select('*')
    .order('created_at', { ascending: false });

  if (prodErr) throw prodErr;

  if (!products || products.length === 0) {
    return { products: [] };
  }

  const now = Date.now();
  const cutoff24h = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const cutoff7d = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();

  const enrichedProducts = await Promise.all(
    products.map(async (product) => {
      // 1. Fetch latest price
      const { data: latestPrices } = await supabase
        .from('price_history')
        .select('*')
        .eq('product_id', product.id)
        .order('scraped_at', { ascending: false })
        .limit(1);

      const latestPriceRow = latestPrices && latestPrices.length > 0 ? latestPrices[0] : null;

      // 2. Fetch latest scrape log
      const { data: latestLogs } = await supabase
        .from('scrape_logs')
        .select('*')
        .eq('product_id', product.id)
        .order('created_at', { ascending: false })
        .limit(1);

      const latestLogRow = latestLogs && latestLogs.length > 0 ? latestLogs[0] : null;

      // 3. Compute 24h / 7d price deltas
      let priceDelta24h = null;
      let priceDelta7d = null;

      if (latestPriceRow && latestPriceRow.price > 0) {
        // 24h Delta
        const { data: prices24h } = await supabase
          .from('price_history')
          .select('price, scraped_at')
          .eq('product_id', product.id)
          .lte('scraped_at', cutoff24h)
          .order('scraped_at', { ascending: false })
          .limit(1);

        if (prices24h && prices24h.length > 0 && prices24h[0].price) {
          priceDelta24h = Number((latestPriceRow.price - prices24h[0].price).toFixed(2));
        } else {
          // If no records exist older than 24h, find earliest price recorded within the 24h window
          const { data: earliest24h } = await supabase
            .from('price_history')
            .select('price, scraped_at')
            .eq('product_id', product.id)
            .gte('scraped_at', cutoff24h)
            .order('scraped_at', { ascending: true })
            .limit(1);

          if (earliest24h && earliest24h.length > 0 && earliest24h[0].price) {
            if (earliest24h[0].scraped_at !== latestPriceRow.scraped_at) {
              priceDelta24h = Number((latestPriceRow.price - earliest24h[0].price).toFixed(2));
            } else {
              priceDelta24h = 0;
            }
          }
        }

        // 7d Delta
        const { data: prices7d } = await supabase
          .from('price_history')
          .select('price, scraped_at')
          .eq('product_id', product.id)
          .lte('scraped_at', cutoff7d)
          .order('scraped_at', { ascending: false })
          .limit(1);

        if (prices7d && prices7d.length > 0 && prices7d[0].price) {
          priceDelta7d = Number((latestPriceRow.price - prices7d[0].price).toFixed(2));
        } else {
          const { data: earliest7d } = await supabase
            .from('price_history')
            .select('price, scraped_at')
            .eq('product_id', product.id)
            .gte('scraped_at', cutoff7d)
            .order('scraped_at', { ascending: true })
            .limit(1);

          if (earliest7d && earliest7d.length > 0 && earliest7d[0].price) {
            if (earliest7d[0].scraped_at !== latestPriceRow.scraped_at) {
              priceDelta7d = Number((latestPriceRow.price - earliest7d[0].price).toFixed(2));
            } else {
              priceDelta7d = 0;
            }
          }
        }
      }

      // Parse stock status and units
      const rawStock = latestPriceRow ? latestPriceRow.stock_status : 'unknown';
      let stockStatus = 'unknown';
      let stockUnits = null;
      let stockText = null;

      if (rawStock && rawStock !== 'unknown' && !rawStock.toLowerCase().includes('delivery estimates')) {
        stockText = rawStock;
        const unitMatch =
          rawStock.match(/(\d+)\s*(?:units?\s*)?left\b/i) ||
          rawStock.match(/(\d+)\s*in\s*stock\b/i) ||
          rawStock.match(/(?:only|hurry,?\s*just|selling\s*fast\s*[—–-])\s*(\d+)/i) ||
          rawStock.match(/:(\d+)$/);

        if (unitMatch) {
          stockUnits = parseInt(unitMatch[1], 10);
        }

        const lower = rawStock.toLowerCase();
        if (
          lower.includes('out of stock') ||
          lower.includes('sold out') ||
          lower.startsWith('out_of_stock')
        ) {
          stockStatus = 'out_of_stock';
        } else if (
          lower.includes('low stock') ||
          lower.includes('only') ||
          lower.includes('hurry') ||
          lower.startsWith('low_stock')
        ) {
          stockStatus = 'low_stock';
        } else if (
          lower.includes('in stock') ||
          lower.includes('available') ||
          lower.startsWith('in_stock')
        ) {
          stockStatus = 'in_stock';
        } else {
          stockStatus = 'in_stock';
        }
      }

      return {
        id: product.id,
        storeProductId: product.store_product_id,
        name: product.name,
        slug: product.slug,
        productUrl: product.product_url,
        scrapeIntervalMinutes: product.scrape_interval_minutes,
        isActive: product.is_active,
        createdAt: product.created_at,
        latestPrice: latestPriceRow ? Number(latestPriceRow.price) : null,
        latestMrp: latestPriceRow && latestPriceRow.mrp ? Number(latestPriceRow.mrp) : null,
        latestDiscountPercent:
          latestPriceRow && latestPriceRow.discount_percent
            ? Number(latestPriceRow.discount_percent)
            : null,
        currency: latestPriceRow ? latestPriceRow.currency : 'INR',
        stockStatus,
        stockUnits,
        stockText,
        rawStockStatus: rawStock,
        lastScrapedAt: latestPriceRow ? latestPriceRow.scraped_at : null,
        reconciled: latestLogRow ? latestLogRow.price_reconciled : false,
        lastOutcome: latestLogRow ? latestLogRow.outcome : null,
        lastErrorMessage: latestLogRow ? latestLogRow.error_message : null,
        priceDelta24h,
        priceDelta7d,
      };
    })
  );

  return { products: enrichedProducts };
}

/**
 * GET /api/products
 * Returns all tracked products enriched with latest price, stock, deltas.
 * Served from in-memory SWR cache — instant for users, refreshes silently in background.
 */
router.get('/', async (req, res, next) => {
  try {
    if (req.query.fresh === 'true' || req.query.bypassCache === 'true') {
      invalidateCache();
    }
    const { data, fromCache, cacheAgeMs } = await getWithSWR(fetchEnrichedProducts);

    // Surface cache metadata in response headers for debugging
    res.set('X-Cache', fromCache ? 'HIT' : 'MISS');
    if (cacheAgeMs !== null) res.set('X-Cache-Age', String(Math.round(cacheAgeMs / 1000)) + 's');

    return res.json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/products/:id
 * Returns single product metadata, including specs and one review.
 */
router.get('/:id', async (req, res, next) => {
  const { id } = req.params;

  try {
    const { data: product, error: prodErr } = await supabase
      .from('tracked_products')
      .select('*')
      .eq('id', id)
      .single();

    if (prodErr || !product) {
      return res.status(404).json({ error: `Product not found with id ${id}` });
    }

    let specs = {};
    let review = null;
    let reviews = [];
    let description = null;
    let brand = null;
    let category = null;

    try {
      // The store metadata API uses singular /api/product/:id
      const storeMetadataUrl = `${config.storeBaseUrl.replace(/\/+$/, '')}/api/product/${product.store_product_id}`;
      const metaResp = await axios.get(storeMetadataUrl, { timeout: 5000 });
      if (metaResp.data) {
        description = metaResp.data.description || null;
        brand = metaResp.data.brand || null;
        category = metaResp.data.category || null;

        if (metaResp.data.specs && typeof metaResp.data.specs === 'object') {
          specs = metaResp.data.specs;
        }

        if (Array.isArray(metaResp.data.reviews) && metaResp.data.reviews.length > 0) {
          reviews = metaResp.data.reviews.map((r) => ({
            id: r.id,
            author: r.author,
            rating: r.rating || 5,
            title: r.title || '',
            comment: r.body || r.comment || '',
            body: r.body || r.comment || '',
            date: r.date || '',
            verifiedPurchase: !!r.verifiedPurchase,
            helpfulVotes: r.helpfulVotes || 0,
          }));
          review = reviews[0];
        }
      }
    } catch (fetchErr) {
      logger.warn(`Could not fetch store metadata for SKU ${product.store_product_id} from ${config.storeBaseUrl}/api/product/${product.store_product_id}: ${fetchErr.message}`);
    }

    return res.json({
      product: {
        ...product,
        brand: brand || null,
        category: category || null,
        description: description || null,
      },
      specs,
      review,
      reviews,
      description,
      brand,
      category,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/products/:id
 * Removes tracked product (cascades to price_history and scrape_logs).
 */
router.delete('/:id', async (req, res, next) => {
  const { id } = req.params;

  try {
    const { error } = await supabase
      .from('tracked_products')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return res.json({
      success: true,
      message: `Product ${id} and all associated price history and logs removed successfully`,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/products/:id/history?range=24h|7d|30d|all
 * Returns price history points for charts and trend analysis.
 */
router.get('/:id/history', async (req, res, next) => {
  const { id } = req.params;
  const range = req.query.range || 'all';
  const cutoff = getCutoffDate(range);

  try {
    let query = supabase
      .from('price_history')
      .select('*')
      .eq('product_id', id);

    if (cutoff) {
      query = query.gte('scraped_at', cutoff);
    }

    const { data: history, error } = await query.order('scraped_at', { ascending: true });

    if (error) throw error;

    return res.json({
      productId: id,
      range,
      count: history ? history.length : 0,
      history: history || [],
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/products/:id/logs?limit=50
 * Returns recent scrape logs for troubleshooting.
 */
router.get('/:id/logs', async (req, res, next) => {
  const { id } = req.params;
  const limit = Math.max(1, Math.min(200, parseInt(req.query.limit || '50', 10)));

  try {
    const { data: logs, error } = await supabase
      .from('scrape_logs')
      .select('*')
      .eq('product_id', id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return res.json({
      productId: id,
      total: logs ? logs.length : 0,
      logs: logs || [],
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/products/:id
 * Updates scrape_interval_minutes, is_active.
 */
router.patch('/:id', async (req, res, next) => {
  const { id } = req.params;
  const { is_active, isActive, scrape_interval_minutes, scrapeIntervalMinutes } = req.body;

  try {
    const updates = {};
    if (typeof is_active === 'boolean') updates.is_active = is_active;
    if (typeof isActive === 'boolean') updates.is_active = isActive;

    const interval = scrape_interval_minutes !== undefined ? scrape_interval_minutes : scrapeIntervalMinutes;
    if (interval !== undefined && !Number.isNaN(parseInt(interval, 10))) {
      updates.scrape_interval_minutes = parseInt(interval, 10);
    }

    const { data: updated, error } = await supabase
      .from('tracked_products')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return res.json({
      message: 'Product updated successfully',
      product: updated,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
