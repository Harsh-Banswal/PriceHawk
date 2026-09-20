import React from 'react';

/**
 * StatusDot: Minimalist wireframe indicator of scrape health.
 * Supports inverted (dark card) mode with clean letter spacing and distinct indicator dots.
 */
export function StatusDot({ outcome, showLabel = false, inverted = false }) {
  let dotColor = 'bg-neutral-500';
  let label = 'Pending';

  if (outcome === 'success') {
    dotColor = inverted ? 'bg-white' : 'bg-black';
    label = 'Healthy';
  } else if (outcome === 'success_after_retry') {
    dotColor = inverted ? 'bg-neutral-300' : 'bg-neutral-600';
    label = 'Retried';
  } else if (outcome && outcome.startsWith('failed')) {
    dotColor = 'bg-rose-500';
    label = outcome.replace('failed_', 'Err: ');
  }

  const textColor = inverted ? 'text-neutral-300' : 'text-neutral-700';

  return (
    <div className="inline-flex items-center gap-1.5" title={`Outcome: ${outcome || 'none'}`}>
      <span className="flex h-2 w-2 relative items-center justify-center">
        {outcome === 'success' && inverted && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-30"></span>
        )}
        <span className={`h-2 w-2 rounded-full ${dotColor}`}></span>
      </span>
      {showLabel && (
        <span className={`text-xs font-mono font-medium tracking-wide uppercase ${textColor}`}>
          {label}
        </span>
      )}
    </div>
  );
}

export default StatusDot;
