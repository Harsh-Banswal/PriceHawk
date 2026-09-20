import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeStockStatus, extractStockUnits, cleanNumber } from '../src/scraper/priceExtractor.js';
import { calculateBackoff, withRetry } from '../src/scraper/retry.js';
import { PriceUnstableError } from '../src/scraper/waitForStablePrice.js';

test('scraper/priceExtractor: stock normalization', async (t) => {
  await t.test('normalizes out of stock phrases', () => {
    assert.equal(normalizeStockStatus('Currently Out Of Stock'), 'out_of_stock');
    assert.equal(normalizeStockStatus('Sold Out'), 'out_of_stock');
    assert.equal(normalizeStockStatus('Item is currently unavailable'), 'out_of_stock');
  });

  await t.test('normalizes low stock phrases', () => {
    assert.equal(normalizeStockStatus('Only 2 left in stock!'), 'low_stock');
    assert.equal(normalizeStockStatus('Hurry, few units left'), 'low_stock');
    assert.equal(normalizeStockStatus('Low Stock Alert'), 'low_stock');
  });

  await t.test('normalizes in stock phrases', () => {
    assert.equal(normalizeStockStatus('In Stock'), 'in_stock');
    assert.equal(normalizeStockStatus('Available to order'), 'in_stock');
    assert.equal(normalizeStockStatus('Ready to ship'), 'in_stock');
  });

  await t.test('handles null or unknown stock texts', () => {
    assert.equal(normalizeStockStatus(null), 'unknown');
    assert.equal(normalizeStockStatus(''), 'unknown');
    assert.equal(normalizeStockStatus('Some arbitrary label'), 'unknown');
  });
});

test('scraper/priceExtractor: extractStockUnits', async (t) => {
  await t.test('extracts units from standard storefront patterns', () => {
    assert.equal(extractStockUnits('In stock · 50 left'), 50);
    assert.equal(extractStockUnits('IN STOCK · 30 LEFT'), 30);
    assert.equal(extractStockUnits('Only 12 left'), 12);
    assert.equal(extractStockUnits('25 in stock'), 25);
    assert.equal(extractStockUnits('Selling fast — 8 left'), 8);
    assert.equal(extractStockUnits('Hurry, just 3 left'), 3);
    assert.equal(extractStockUnits('15 units left'), 15);
  });

  await t.test('returns null for non-numeric or missing stock texts', () => {
    assert.equal(extractStockUnits('In Stock'), null);
    assert.equal(extractStockUnits('Out of stock'), null);
    assert.equal(extractStockUnits('Sold Out'), null);
    assert.equal(extractStockUnits(null), null);
    assert.equal(extractStockUnits(''), null);
  });
});

test('scraper/priceExtractor: cleanNumber', async (t) => {
  await t.test('parses Indian Rupee formatted numbers', () => {
    assert.equal(cleanNumber('₹1,499.00'), 1499.00);
    assert.equal(cleanNumber('₹ 24,999'), 24999);
    assert.equal(cleanNumber('₹99'), 99);
  });

  await t.test('handles empty or null inputs', () => {
    assert.equal(cleanNumber(null), null);
    assert.equal(cleanNumber(''), null);
    assert.equal(cleanNumber('No digits'), null);
  });
});

test('scraper/retry: exponential backoff with jitter', async (t) => {
  await t.test('calculates correct backoff delays', () => {
    const delay1 = calculateBackoff(1, 1000);
    assert.ok(delay1 >= 1000 && delay1 <= 1300, `Delay1 was ${delay1}`);

    const delay2 = calculateBackoff(2, 1000);
    assert.ok(delay2 >= 2000 && delay2 <= 2300, `Delay2 was ${delay2}`);

    const delay3 = calculateBackoff(3, 1000);
    assert.ok(delay3 >= 4000 && delay3 <= 4300, `Delay3 was ${delay3}`);
  });

  await t.test('succeeds on first attempt without retrying', async () => {
    let callCount = 0;
    const { result, attemptCount } = await withRetry(async () => {
      callCount += 1;
      return 'ok';
    }, { maxAttempts: 3, baseDelayMs: 10 });

    assert.equal(result, 'ok');
    assert.equal(attemptCount, 1);
    assert.equal(callCount, 1);
  });

  await t.test('retries on failure and succeeds on later attempt', async () => {
    let callCount = 0;
    const { result, attemptCount } = await withRetry(async () => {
      callCount += 1;
      if (callCount < 2) throw new Error('Transient network glitch');
      return 'recovered';
    }, { maxAttempts: 3, baseDelayMs: 10 });

    assert.equal(result, 'recovered');
    assert.equal(attemptCount, 2);
    assert.equal(callCount, 2);
  });

  await t.test('exhausts retries and throws last error', async () => {
    let callCount = 0;
    await assert.rejects(
      async () => {
        await withRetry(async () => {
          callCount += 1;
          throw new Error('Persistent server error');
        }, { maxAttempts: 3, baseDelayMs: 10 });
      },
      /Persistent server error/
    );
    assert.equal(callCount, 3);
  });
});

test('scraper/waitForStablePrice: error discrimination', async (t) => {
  await t.test('constructs PriceUnstableError with custom code', () => {
    const err = new PriceUnstableError('Price fluctuated', { samples: [100, 110, 120] });
    assert.equal(err.name, 'PriceUnstableError');
    assert.equal(err.code, 'ERR_PRICE_UNSTABLE');
    assert.equal(err.details.samples.length, 3);
  });
});
