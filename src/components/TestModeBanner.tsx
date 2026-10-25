import React from 'react';
import { AlertTriangle } from 'lucide-react';

export default function TestModeBanner() {
  return (
    <aside
      role="banner"
      aria-label="Prototype Test Mode Notice"
      className="w-full bg-banner-bg text-banner-fg border-b border-border px-4 py-1.5 z-50 sticky top-0"
    >
      <div className="flex flex-wrap items-center justify-between gap-1.5 text-[12px] font-medium leading-tight">
        <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
          <AlertTriangle className="w-3.5 h-3.5 text-banner-fg shrink-0" aria-hidden="true" />
          <span className="break-words">
            <strong className="font-semibold uppercase tracking-wider text-[11px]">Test mode</strong> — Not connected to 911 or real responders.
          </span>
        </div>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-banner-fg/15 text-banner-fg border border-banner-fg/25 shrink-0 uppercase tracking-wider">
          Phase 0
        </span>
      </div>
    </aside>
  );
}
