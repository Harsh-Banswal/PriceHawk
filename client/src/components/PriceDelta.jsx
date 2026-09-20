import React from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';

export function PriceDelta({ delta, label = '24h', inverted = false }) {
  if (delta === null || delta === undefined) {
    return (
      <span
        className={`inline-flex items-center text-[10px] font-mono px-2 py-0.5 border ${
          inverted
            ? 'bg-neutral-900 text-neutral-400 border-neutral-800'
            : 'bg-neutral-100 text-neutral-500 border-neutral-300'
        }`}
      >
        {label} STABLE
      </span>
    );
  }

  const num = Number(delta);

  if (num < 0) {
    return (
      <span
        className={`inline-flex items-center gap-0.5 text-xs font-mono font-bold px-2 py-0.5 border transition-colors ${
          inverted
            ? 'bg-neutral-900 text-white border-neutral-700'
            : 'bg-neutral-100 text-neutral-900 border-neutral-300'
        }`}
      >
        <ArrowDownRight className={`w-3.5 h-3.5 ${inverted ? 'text-white' : 'text-black'}`} />
        -₹{Math.abs(num).toFixed(0)} ({label})
      </span>
    );
  }

  if (num > 0) {
    return (
      <span
        className={`inline-flex items-center gap-0.5 text-xs font-mono font-bold px-2 py-0.5 border transition-colors ${
          inverted
            ? 'bg-neutral-900 text-white border-neutral-700'
            : 'bg-neutral-100 text-neutral-900 border-neutral-300'
        }`}
      >
        <ArrowUpRight className={`w-3.5 h-3.5 ${inverted ? 'text-white' : 'text-black'}`} />
        +₹{num.toFixed(0)} ({label})
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center text-[10px] font-mono px-2 py-0.5 border ${
        inverted
          ? 'bg-neutral-900 text-neutral-400 border-neutral-800'
          : 'bg-neutral-100 text-neutral-600 border-neutral-200'
      }`}
    >
      {label} STABLE
    </span>
  );
}

export default PriceDelta;
