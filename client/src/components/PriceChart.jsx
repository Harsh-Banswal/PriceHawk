import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { TrendingDown, Calendar } from 'lucide-react';

export function PriceChart({ history = [], range, onRangeChange }) {
  // Format chart data
  const chartData = history.map((item) => {
    const d = new Date(item.scraped_at);
    return {
      timestamp: range === '24h'
        ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit' }),
      price: item.price ? Number(item.price) : null, // null creates a real gap
      mrp: item.mrp ? Number(item.mrp) : null,
      fullDate: d.toLocaleString(),
    };
  });

  const validPrices = chartData.filter((d) => d.price !== null).map((d) => d.price);
  const minPrice = validPrices.length > 0 ? Math.floor(Math.min(...validPrices) * 0.95) : 'auto';
  const maxPrice = validPrices.length > 0 ? Math.ceil(Math.max(...validPrices) * 1.05) : 'auto';

  const ranges = [
    { label: '24 Hours', value: '24h' },
    { label: '7 Days', value: '7d' },
    { label: '30 Days', value: '30d' },
    { label: 'All Time', value: 'all' },
  ];

  return (
    <div className="bg-white border border-neutral-300 p-6 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-base font-bold text-neutral-900 flex items-center gap-2 uppercase tracking-tight">
            <TrendingDown className="w-5 h-5 text-black" />
            Price History & Trend Analysis
          </h3>
          <p className="text-xs font-mono text-neutral-500 mt-1">
            Verified prices only. Gaps indicate unverified or failed scrape attempts without synthetic carry-forward.
          </p>
        </div>

        {/* Range Toggle Buttons */}
        <div className="inline-flex bg-neutral-100 p-1 border border-neutral-300 self-start sm:self-auto">
          {ranges.map((r) => (
            <button
              key={r.value}
              onClick={() => onRangeChange(r.value)}
              className={`px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wider transition-all ${
                range === r.value
                  ? 'bg-black text-white shadow-xs'
                  : 'text-neutral-600 hover:text-black'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {chartData.length === 0 || validPrices.length === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center text-neutral-500 gap-2 border border-dashed border-neutral-300 bg-neutral-50">
          <Calendar className="w-8 h-8 text-neutral-400" />
          <p className="text-xs font-mono uppercase tracking-wider">
            No price history points recorded for this range yet.
          </p>
        </div>
      ) : (
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
              <XAxis
                dataKey="timestamp"
                stroke="#737373"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#E5E7EB' }}
                fontFamily="monospace"
              />
              <YAxis
                stroke="#737373"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#E5E7EB' }}
                domain={[minPrice, maxPrice]}
                tickFormatter={(v) => `₹${v}`}
                fontFamily="monospace"
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-white border border-black p-3 shadow-xl text-xs font-mono space-y-1">
                        <p className="text-neutral-500 text-[10px] uppercase">{data.fullDate}</p>
                        <p className="text-sm font-black text-black">
                          Price: ₹{data.price?.toLocaleString('en-IN') || 'N/A'}
                        </p>
                        {data.mrp && (
                          <p className="text-neutral-500 text-xs">
                            MRP: ₹{data.mrp.toLocaleString('en-IN')}
                          </p>
                        )}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Line
                type="monotone"
                dataKey="price"
                stroke="#000000"
                strokeWidth={2}
                dot={{ r: 3, fill: '#000000', strokeWidth: 0 }}
                activeDot={{ r: 5, fill: '#000000', stroke: '#000000', strokeWidth: 2 }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export default PriceChart;
