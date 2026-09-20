import React from 'react';
import { History, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

export function ScrapeLogsTable({ logs = [] }) {
  const getOutcomeBadge = (outcome) => {
    if (outcome === 'success') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase px-2 py-0.5 bg-neutral-100 text-neutral-900 border border-neutral-300">
          <CheckCircle2 className="w-3 h-3" />
          Success
        </span>
      );
    }
    if (outcome === 'success_after_retry') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase px-2 py-0.5 bg-neutral-200 text-neutral-900 border border-neutral-400">
          <AlertTriangle className="w-3 h-3" />
          Retried Success
        </span>
      );
    }
    // Failed scrapes stay visible with a high-contrast black badge
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase px-2 py-0.5 bg-black text-white border border-black">
        <XCircle className="w-3 h-3" />
        {outcome ? outcome.replace('failed_', 'Failed: ') : 'Failed'}
      </span>
    );
  };

  return (
    <div className="bg-white border border-neutral-300 p-6 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-neutral-200 gap-2 mb-4">
        <h3 className="text-base font-bold text-neutral-900 flex items-center gap-2 uppercase tracking-tight">
          <History className="w-5 h-5 text-black" />
          Scrape Audit Trail & Telemetry
        </h3>
        <span className="text-xs font-mono text-neutral-500 uppercase tracking-wider">
          Showing latest {logs.length} attempts (failed scrapes visible)
        </span>
      </div>

      {logs.length === 0 ? (
        <div className="py-8 text-center text-neutral-400 text-xs font-mono uppercase tracking-wider">
          No scrape logs recorded yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-neutral-800">
            <thead className="bg-neutral-100 text-neutral-700 uppercase tracking-wider text-[10px] font-mono border-y border-neutral-300">
              <tr>
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Outcome</th>
                <th className="py-2.5 px-3">Attempts</th>
                <th className="py-2.5 px-3">Duration</th>
                <th className="py-2.5 px-3">Synced</th>
                <th className="py-2.5 px-3">Diagnostic Message</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 font-mono text-xs">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-neutral-50 transition-colors">
                  <td className="py-3 px-3 whitespace-nowrap text-neutral-600">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    {getOutcomeBadge(log.outcome)}
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap font-bold text-black">
                    {log.attempt_count}
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap text-neutral-600">
                    {log.duration_ms ? `${log.duration_ms}ms` : '--'}
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    {log.price_reconciled ? (
                      <span className="text-black font-bold text-[11px]">YES</span>
                    ) : (
                      <span className="text-neutral-400 text-[11px]">NO</span>
                    )}
                  </td>
                  <td className="py-3 px-3 max-w-xs truncate text-neutral-600 text-[11px]" title={log.error_message || ''}>
                    {log.error_message || '--'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default ScrapeLogsTable;
