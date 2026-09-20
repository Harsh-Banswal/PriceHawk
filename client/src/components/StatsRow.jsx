import React from 'react';
import { Tag, TrendingDown, TrendingUp, BarChart2 } from 'lucide-react';

export function StatsRow({ history = [], latestPrice = null }) {
  const prices = history
    .filter((h) => h.price !== null && h.price !== undefined)
    .map((h) => Number(h.price));

  const current = latestPrice !== null ? latestPrice : (prices.length > 0 ? prices[prices.length - 1] : null);
  const min = prices.length > 0 ? Math.min(...prices) : null;
  const max = prices.length > 0 ? Math.max(...prices) : null;
  const avg = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : null;

  const stats = [
    {
      label: 'Current Price',
      value: current ? `₹${Number(current).toLocaleString('en-IN')}` : '--',
      icon: Tag,
    },
    {
      label: 'Lowest Recorded',
      value: min ? `₹${Number(min).toLocaleString('en-IN')}` : '--',
      icon: TrendingDown,
    },
    {
      label: 'Highest Recorded',
      value: max ? `₹${Number(max).toLocaleString('en-IN')}` : '--',
      icon: TrendingUp,
    },
    {
      label: 'Average Price',
      value: avg ? `₹${Number(avg.toFixed(2)).toLocaleString('en-IN')}` : '--',
      icon: BarChart2,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, i) => {
        const Icon = stat.icon;
        return (
          <div
            key={i}
            className="bg-white border border-neutral-300 p-4 flex items-center justify-between shadow-xs"
          >
            <div>
              <p className="text-[11px] font-mono uppercase tracking-wider text-neutral-500">
                {stat.label}
              </p>
              <p className="text-xl font-black text-neutral-900 mt-1 tracking-tight font-sans">
                {stat.value}
              </p>
            </div>
            <div className="p-2.5 bg-neutral-100 border border-neutral-300 text-neutral-900">
              <Icon className="w-5 h-5" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default StatsRow;
