import React, { useState } from 'react';
import { Clock, Loader2, Check } from 'lucide-react';
import { updateProduct } from '../api/client.js';

export function IntervalControl({ productId, currentInterval, onIntervalUpdated }) {
  const [intervalVal, setIntervalVal] = useState(currentInterval || 120);
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const options = [
    { label: 'Every 15 mins', value: 15 },
    { label: 'Every 30 mins', value: 30 },
    { label: 'Every 1 hour', value: 60 },
    { label: 'Every 2 hours', value: 120 },
    { label: 'Every 6 hours', value: 360 },
    { label: 'Every 12 hours', value: 720 },
    { label: 'Daily (24h)', value: 1440 },
  ];

  const handleSave = async (newVal) => {
    const val = parseInt(newVal, 10);
    setIntervalVal(val);
    setIsSaving(true);
    setJustSaved(false);

    try {
      await updateProduct(productId, { scrape_interval_minutes: val });
      setJustSaved(true);
      if (onIntervalUpdated) onIntervalUpdated(val);
      setTimeout(() => setJustSaved(false), 2000);
    } catch (err) {
      console.error('Failed to update scrape interval:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white border border-neutral-300 p-5 flex items-center justify-between gap-4 shadow-xs">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-neutral-100 border border-neutral-300 text-black">
          <Clock className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-neutral-900 uppercase tracking-tight">
            Scrape Frequency
          </h4>
          <p className="text-xs font-mono text-neutral-500">
            Controls autonomous Playwright Chromium scrape cadence
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <select
          value={intervalVal}
          onChange={(e) => handleSave(e.target.value)}
          disabled={isSaving}
          className="bg-white border border-neutral-900 text-neutral-900 text-xs font-mono font-semibold px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {isSaving && <Loader2 className="w-4 h-4 animate-spin text-black" />}
        {justSaved && (
          <span className="inline-flex items-center text-xs font-mono uppercase bg-neutral-100 border border-neutral-300 px-2 py-1 text-black font-bold gap-1">
            <Check className="w-3.5 h-3.5" /> Saved
          </span>
        )}
      </div>
    </div>
  );
}

export default IntervalControl;
