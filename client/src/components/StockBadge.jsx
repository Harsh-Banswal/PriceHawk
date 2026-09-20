import React from 'react';

export function StockBadge({ status, units = null, inverted = false }) {
  const text = String(status || '').trim();
  const lower = text.toLowerCase();

  // Extract units from props or string if present
  let resolvedUnits = units;
  if (resolvedUnits === null || resolvedUnits === undefined) {
    const match =
      text.match(/(\d+)\s*(?:units?\s*)?left\b/i) ||
      text.match(/(\d+)\s*in\s*stock\b/i) ||
      text.match(/(?:only|hurry,?\s*just|selling\s*fast\s*[—–-])\s*(\d+)/i) ||
      text.match(/:(\d+)$/);
    if (match) {
      resolvedUnits = parseInt(match[1], 10);
    }
  }

  // 1. Out of stock / Sold Out
  if (
    lower.includes('out of stock') ||
    lower.includes('sold out') ||
    lower.startsWith('out_of_stock') ||
    resolvedUnits === 0
  ) {
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider ${
          inverted
            ? 'bg-neutral-900 text-neutral-400 border border-neutral-800 line-through'
            : 'bg-black text-white border border-black'
        }`}
      >
        Out of Stock
      </span>
    );
  }

  // 2. All In-Stock items (always formatted as [IN STOCK : number] in white, no low/high)
  const label =
    resolvedUnits !== null && resolvedUnits !== undefined
      ? `IN STOCK : ${resolvedUnits}`
      : 'IN STOCK';

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-[10px] font-mono font-black uppercase tracking-wider transition-colors ${
        inverted
          ? 'bg-white text-black border border-white shadow-xs'
          : 'bg-white text-black border border-black shadow-xs'
      }`}
    >
      {label}
    </span>
  );
}

export default StockBadge;
