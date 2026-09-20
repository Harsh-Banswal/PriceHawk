/**
 * Price Reconciler Service
 *
 * CRITICAL RULE:
 * price_history gets a row ONLY when a scrape produces a price that passes
 * reconciliation against MRP and discount. Every other outcome writes to scrape_logs only.
 * Never write 0, null, or a carried-forward price.
 */

/**
 * Validates and reconciles scraped price data.
 *
 * @param {Object} params
 * @param {number|string|null} params.price - The scraped selling price
 * @param {number|string|null} [params.mrp] - The scraped MRP (Maximum Retail Price)
 * @param {number|string|null} [params.discountPercent] - The scraped discount percentage (0-100)
 * @param {boolean} [params.isCarriedForward] - Flag indicating if price was carried forward
 * @param {number} [params.toleranceUnits=2] - Rounding tolerance in currency units (INR)
 * @param {number} [params.tolerancePercent=0.02] - Rounding tolerance percentage (e.g. 2%)
 *
 * @returns {{
 *   reconciled: boolean,
 *   price: number | null,
 *   mrp: number | null,
 *   discountPercent: number | null,
 *   reason: string | null
 * }}
 */
export function reconcilePrice({
  price,
  mrp = null,
  discountPercent = null,
  isCarriedForward = false,
  toleranceUnits = 2.0,
  tolerancePercent = 0.02,
} = {}) {
  // 1. Never allow carried-forward prices
  if (isCarriedForward) {
    return {
      reconciled: false,
      price: null,
      mrp: null,
      discountPercent: null,
      reason: 'Carried-forward prices are strictly prohibited from price_history',
    };
  }

  // 2. Parse and validate selling price
  if (price === null || price === undefined || price === '') {
    return {
      reconciled: false,
      price: null,
      mrp: null,
      discountPercent: null,
      reason: 'Price is null, missing, or empty',
    };
  }

  const numericPrice = typeof price === 'number' ? price : parseFloat(String(price).replace(/[^0-9.]/g, ''));

  if (Number.isNaN(numericPrice) || !Number.isFinite(numericPrice)) {
    return {
      reconciled: false,
      price: null,
      mrp: null,
      discountPercent: null,
      reason: `Price is not a valid number: ${price}`,
    };
  }

  // Strictly enforce price > 0 (Never write 0 or negative prices)
  if (numericPrice <= 0) {
    return {
      reconciled: false,
      price: null,
      mrp: null,
      discountPercent: null,
      reason: `Price must be strictly positive (got ${numericPrice}). Never write 0 or negative prices.`,
    };
  }

  const roundedPrice = Number(numericPrice.toFixed(2));

  // 3. Parse MRP if provided
  let numericMrp = null;
  if (mrp !== null && mrp !== undefined && mrp !== '') {
    numericMrp = typeof mrp === 'number' ? mrp : parseFloat(String(mrp).replace(/[^0-9.]/g, ''));
    if (Number.isNaN(numericMrp) || !Number.isFinite(numericMrp) || numericMrp <= 0) {
      return {
        reconciled: false,
        price: null,
        mrp: null,
        discountPercent: null,
        reason: `Invalid MRP value: ${mrp}`,
      };
    }
    numericMrp = Number(numericMrp.toFixed(2));

    // Selling price must not exceed MRP (with 0.01 epsilon for float rounding)
    if (roundedPrice > numericMrp + 0.01) {
      return {
        reconciled: false,
        price: null,
        mrp: numericMrp,
        discountPercent: null,
        reason: `Selling price (${roundedPrice}) cannot exceed MRP (${numericMrp})`,
      };
    }
  }

  // 4. Parse discountPercent if provided
  let numericDiscount = null;
  if (discountPercent !== null && discountPercent !== undefined && discountPercent !== '') {
    numericDiscount = typeof discountPercent === 'number'
      ? discountPercent
      : parseFloat(String(discountPercent).replace(/[^0-9.]/g, ''));

    if (Number.isNaN(numericDiscount) || !Number.isFinite(numericDiscount)) {
      return {
        reconciled: false,
        price: null,
        mrp: numericMrp,
        discountPercent: null,
        reason: `Invalid discount percent value: ${discountPercent}`,
      };
    }

    if (numericDiscount < 0 || numericDiscount >= 100) {
      return {
        reconciled: false,
        price: null,
        mrp: numericMrp,
        discountPercent: null,
        reason: `Discount percent must be between 0 and 99.99% (got ${numericDiscount}%)`,
      };
    }

    numericDiscount = Number(numericDiscount.toFixed(2));
  }

  // 5. Reconciliation Logic:
  // Case A: Both MRP and Discount Percent are provided
  if (numericMrp !== null && numericDiscount !== null) {
    const expectedPrice = numericMrp * (1 - numericDiscount / 100);
    const tolerance = Math.max(toleranceUnits, numericMrp * tolerancePercent);
    const discrepancy = Math.abs(roundedPrice - expectedPrice);

    if (discrepancy > tolerance) {
      return {
        reconciled: false,
        price: null,
        mrp: numericMrp,
        discountPercent: numericDiscount,
        reason: `Price mismatch against MRP and discount: expected ~${expectedPrice.toFixed(2)} (within ±${tolerance.toFixed(2)}), got ${roundedPrice}`,
      };
    }

    return {
      reconciled: true,
      price: roundedPrice,
      mrp: numericMrp,
      discountPercent: numericDiscount,
      reason: null,
    };
  }

  // Case B: MRP is provided, but Discount Percent is missing
  if (numericMrp !== null && numericDiscount === null) {
    const derivedDiscount = numericMrp > roundedPrice
      ? Number((((numericMrp - roundedPrice) / numericMrp) * 100).toFixed(2))
      : 0.0;

    return {
      reconciled: true,
      price: roundedPrice,
      mrp: numericMrp,
      discountPercent: derivedDiscount,
      reason: null,
    };
  }

  // Case C: Discount Percent is provided, but MRP is missing
  if (numericMrp === null && numericDiscount !== null) {
    if (numericDiscount === 0) {
      return {
        reconciled: true,
        price: roundedPrice,
        mrp: roundedPrice,
        discountPercent: 0.0,
        reason: null,
      };
    }

    const derivedMrp = Number((roundedPrice / (1 - numericDiscount / 100)).toFixed(2));
    return {
      reconciled: true,
      price: roundedPrice,
      mrp: derivedMrp,
      discountPercent: numericDiscount,
      reason: null,
    };
  }

  // Case D: Neither MRP nor Discount Percent provided (standard price item)
  // MRP equals selling price, discount is 0%
  return {
    reconciled: true,
    price: roundedPrice,
    mrp: roundedPrice,
    discountPercent: 0.0,
    reason: null,
  };
}

export default reconcilePrice;
