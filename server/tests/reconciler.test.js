import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcilePrice } from '../src/services/reconciler.js';

test('CRITICAL RULE: price reconciliation tests', async (t) => {
  await t.test('accepts valid price matching MRP and discount percent exactly', () => {
    const res = reconcilePrice({
      price: 800,
      mrp: 1000,
      discountPercent: 20,
    });
    assert.equal(res.reconciled, true);
    assert.equal(res.price, 800);
    assert.equal(res.mrp, 1000);
    assert.equal(res.discountPercent, 20);
    assert.equal(res.reason, null);
  });

  await t.test('accepts valid price with rounding tolerance (e.g. ₹999 at 15% off = ₹849.15 -> ₹849)', () => {
    const res = reconcilePrice({
      price: 849,
      mrp: 999,
      discountPercent: 15,
    });
    assert.equal(res.reconciled, true);
    assert.equal(res.price, 849);
    assert.equal(res.mrp, 999);
    assert.equal(res.discountPercent, 15);
  });

  await t.test('strictly rejects carried-forward prices ("Never write 0, null, or a carried-forward price")', () => {
    const res = reconcilePrice({
      price: 500,
      mrp: 600,
      discountPercent: 16.67,
      isCarriedForward: true,
    });
    assert.equal(res.reconciled, false);
    assert.equal(res.price, null);
    assert.match(res.reason, /carried-forward/i);
  });

  await t.test('strictly rejects price = 0 ("Never write 0, null, or a carried-forward price")', () => {
    const res = reconcilePrice({
      price: 0,
      mrp: 500,
      discountPercent: 100,
    });
    assert.equal(res.reconciled, false);
    assert.equal(res.price, null);
    assert.match(res.reason, /strictly positive/i);
  });

  await t.test('strictly rejects negative price', () => {
    const res = reconcilePrice({
      price: -50,
      mrp: 100,
    });
    assert.equal(res.reconciled, false);
    assert.equal(res.price, null);
    assert.match(res.reason, /strictly positive/i);
  });

  await t.test('strictly rejects null or undefined price ("Never write 0, null, or a carried-forward price")', () => {
    const resNull = reconcilePrice({ price: null });
    assert.equal(resNull.reconciled, false);
    assert.equal(resNull.price, null);

    const resUndef = reconcilePrice({ price: undefined });
    assert.equal(resUndef.reconciled, false);
    assert.equal(resUndef.price, null);

    const resEmpty = reconcilePrice({ price: '' });
    assert.equal(resEmpty.reconciled, false);
  });

  await t.test('strictly rejects non-numeric price string', () => {
    const res = reconcilePrice({ price: 'N/A' });
    assert.equal(res.reconciled, false);
    assert.equal(res.price, null);
  });

  await t.test('strictly rejects price greater than MRP', () => {
    const res = reconcilePrice({
      price: 1200,
      mrp: 1000,
    });
    assert.equal(res.reconciled, false);
    assert.equal(res.price, null);
    assert.match(res.reason, /cannot exceed MRP/i);
  });

  await t.test('strictly rejects price when discount discrepancy exceeds tolerance', () => {
    // 1000 at 50% discount should be ~500, but scraped price is 800
    const res = reconcilePrice({
      price: 800,
      mrp: 1000,
      discountPercent: 50,
    });
    assert.equal(res.reconciled, false);
    assert.equal(res.price, null);
    assert.match(res.reason, /Price mismatch against MRP and discount/i);
  });

  await t.test('calculates discount percent when MRP is present but discount is omitted', () => {
    const res = reconcilePrice({
      price: 750,
      mrp: 1000,
    });
    assert.equal(res.reconciled, true);
    assert.equal(res.price, 750);
    assert.equal(res.mrp, 1000);
    assert.equal(res.discountPercent, 25);
  });

  await t.test('calculates MRP when discount percent is present but MRP is omitted', () => {
    const res = reconcilePrice({
      price: 800,
      discountPercent: 20,
    });
    assert.equal(res.reconciled, true);
    assert.equal(res.price, 800);
    assert.equal(res.mrp, 1000);
    assert.equal(res.discountPercent, 20);
  });

  await t.test('handles standard pricing when neither MRP nor discount is displayed', () => {
    const res = reconcilePrice({
      price: 499,
    });
    assert.equal(res.reconciled, true);
    assert.equal(res.price, 499);
    assert.equal(res.mrp, 499);
    assert.equal(res.discountPercent, 0);
  });

  await t.test('parses currency formatted string prices correctly (e.g. "₹1,299.00")', () => {
    const res = reconcilePrice({
      price: '₹1,299.00',
      mrp: '₹1,999.00',
      discountPercent: '35%',
    });
    assert.equal(res.reconciled, true);
    assert.equal(res.price, 1299);
    assert.equal(res.mrp, 1999);
  });
});
