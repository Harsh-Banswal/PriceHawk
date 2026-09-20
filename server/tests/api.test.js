import test from 'node:test';
import assert from 'node:assert/strict';
import { server } from '../src/index.js';
import config from '../src/config.js';
import { setSupabaseClient } from '../src/db/supabase.js';
import { createMockSupabase } from './mockSupabase.js';

test('Express API Server Endpoints & Security', async (t) => {
  const port = server.address()?.port || config.port;
  const baseUrl = `http://localhost:${port}`;

  // Inject in-memory mock Supabase for test isolation
  const mockDb = createMockSupabase();
  setSupabaseClient(mockDb);

  // Use fast timeouts for synthetic test products
  config.scrapeMaxAttempts = 1;
  config.navTimeoutMs = 2000;

  let createdProductId = null;

  await t.test('GET /healthz returns 200 and healthy status', async () => {
    const res = await fetch(`${baseUrl}/healthz`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'ok');
    assert.equal(body.service, 'price-tracker-server');
    assert.ok(body.uptime >= 0);
  });

  await t.test('GET /api/search?q=<name> searches catalog with Axios', async () => {
    const res = await fetch(`${baseUrl}/api/search?q=headphones`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.query, 'headphones');
    assert.ok(Array.isArray(body.results));
    assert.ok(body.results.length > 0);
    assert.ok(body.results[0].storeProductId);
    assert.ok(body.results[0].slug);
    assert.ok(body.results[0].productUrl);
  });

  await t.test('GET /api/search requires "q" query parameter', async () => {
    const res = await fetch(`${baseUrl}/api/search`);
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.error, /Query parameter "q" is required/i);
    assert.equal(body.stack, undefined, 'Stack trace must not leak');
  });

  await t.test('POST /api/products upserts tracked_products and runs initial scrape', async () => {
    const payload = {
      storeProductId: 'TEST-SKU-1001',
      name: 'Smart Wireless Earbuds',
      slug: 'smart-wireless-earbuds',
    };

    const res = await fetch(`${baseUrl}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.ok(body.product);
    assert.equal(body.product.store_product_id, 'TEST-SKU-1001');
    assert.equal(body.product.name, 'Smart Wireless Earbuds');
    assert.ok(body.initialScrape, 'Initial scrape should execute');

    createdProductId = body.product.id;
  });

  await t.test('GET /api/products returns products with latest price, reconciled flag, outcome, and deltas', async () => {
    // Seed price history and scrape logs for the product
    const now = Date.now();
    mockDb._tables.price_history.push(
      {
        id: 1,
        product_id: createdProductId,
        price: 799.00,
        mrp: 999.00,
        discount_percent: 20.00,
        currency: 'INR',
        stock_status: 'in_stock',
        scraped_at: new Date(now).toISOString(),
      },
      {
        id: 2,
        product_id: createdProductId,
        price: 849.00,
        mrp: 999.00,
        discount_percent: 15.00,
        currency: 'INR',
        stock_status: 'in_stock',
        scraped_at: new Date(now - 25 * 60 * 60 * 1000).toISOString(), // 25h ago
      },
      {
        id: 3,
        product_id: createdProductId,
        price: 899.00,
        mrp: 999.00,
        discount_percent: 10.00,
        currency: 'INR',
        stock_status: 'in_stock',
        scraped_at: new Date(now - 8 * 24 * 60 * 60 * 1000).toISOString(), // 8d ago
      }
    );

    mockDb._tables.scrape_logs.push({
      id: 1,
      product_id: createdProductId,
      outcome: 'success',
      attempt_count: 1,
      duration_ms: 1200,
      price_reconciled: true,
      created_at: new Date(now).toISOString(),
    });

    const res = await fetch(`${baseUrl}/api/products`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.products));
    assert.ok(body.products.length > 0);

    const prod = body.products.find((p) => p.id === createdProductId);
    assert.ok(prod);
    assert.equal(prod.latestPrice, 799.00);
    assert.equal(prod.stockStatus, 'in_stock');
    assert.equal(prod.reconciled, true);
    assert.equal(prod.lastOutcome, 'success');
    // 24h delta: 799 - 849 = -50
    assert.equal(prod.priceDelta24h, -50.00);
    // 7d delta: 799 - 899 = -100
    assert.equal(prod.priceDelta7d, -100.00);
  });

  await t.test('PATCH /api/products/:id updates scrape_interval_minutes and is_active', async () => {
    const res = await fetch(`${baseUrl}/api/products/${createdProductId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scrape_interval_minutes: 60,
        is_active: false,
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.product.scrape_interval_minutes, 60);
    assert.equal(body.product.is_active, false);
  });

  await t.test('GET /api/products/:id/history filters by range (24h, 7d, 30d, all)', async () => {
    const res24h = await fetch(`${baseUrl}/api/products/${createdProductId}/history?range=24h`);
    assert.equal(res24h.status, 200);
    const body24h = await res24h.json();
    assert.equal(body24h.productId, createdProductId);
    assert.equal(body24h.range, '24h');
    assert.ok(body24h.history.length >= 1);

    const resAll = await fetch(`${baseUrl}/api/products/${createdProductId}/history?range=all`);
    assert.equal(resAll.status, 200);
    const bodyAll = await resAll.json();
    assert.equal(bodyAll.range, 'all');
    assert.equal(bodyAll.history.length, 3);
  });

  await t.test('GET /api/products/:id/logs?limit=50 returns scrape logs', async () => {
    const res = await fetch(`${baseUrl}/api/products/${createdProductId}/logs?limit=10`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.productId, createdProductId);
    assert.ok(Array.isArray(body.logs));
    assert.ok(body.logs.length >= 1);
    assert.equal(body.logs[0].outcome, 'success');
  });

  await t.test('DELETE /api/products/:id deletes product from tracked_products', async () => {
    const res = await fetch(`${baseUrl}/api/products/${createdProductId}`, {
      method: 'DELETE',
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
  });

  await t.test('POST /api/cron/scrape enforces x-cron-secret header', async () => {
    // 1. Without header -> 401
    const resUnauthorized = await fetch(`${baseUrl}/api/cron/scrape`, {
      method: 'POST',
    });
    assert.equal(resUnauthorized.status, 401);

    // 2. With invalid header -> 401
    const resBadSecret = await fetch(`${baseUrl}/api/cron/scrape`, {
      method: 'POST',
      headers: { 'x-cron-secret': 'wrong-secret' },
    });
    assert.equal(resBadSecret.status, 401);

    // 3. With valid header -> 200 and summary { scraped, succeeded, failed, durationMs }
    const resValid = await fetch(`${baseUrl}/api/cron/scrape`, {
      method: 'POST',
      headers: { 'x-cron-secret': config.cronSecret },
    });
    assert.equal(resValid.status, 200);
    const body = await resValid.json();
    assert.ok('scraped' in body);
    assert.ok('succeeded' in body);
    assert.ok('failed' in body);
    assert.ok('durationMs' in body);
  });

  await t.test('CORS: restricts access to CLIENT_ORIGIN', async () => {
    // 1. Request with allowed origin
    const resAllowed = await fetch(`${baseUrl}/healthz`, {
      headers: { Origin: config.clientOrigin },
    });
    assert.equal(resAllowed.status, 200);
    assert.equal(resAllowed.headers.get('access-control-allow-origin'), config.clientOrigin);

    // 2. Request with unauthorized origin -> blocked
    const resBlocked = await fetch(`${baseUrl}/healthz`, {
      headers: { Origin: 'http://malicious-site.com' },
    });
    assert.equal(resBlocked.status, 403);
    const body = await resBlocked.json();
    assert.equal(body.message, 'Not allowed by CORS');
    assert.equal(body.stack, undefined, 'Stack trace must not leak');
  });

  await t.test('Security: JSON error handler never leaks stack traces on 404/500', async () => {
    const res = await fetch(`${baseUrl}/non-existent-endpoint-test`);
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.error, 'NotFound');
    assert.equal(body.stack, undefined, 'Stack trace must not leak on 404');
  });

  t.after(() => {
    server.close();
  });
});
