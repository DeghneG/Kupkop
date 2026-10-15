import React from 'react';
import { AlertTriangle } from 'lucide-react';

export default function TestModeBanner() {
  return (
    <aside
      role="banner"
      aria-label="Prototype Test Mode Notice"
      className="w-full bg-amber-400 dark:bg-amber-950 text-amber-950 dark:text-amber-200 border-b border-amber-500 dark:border-amber-900 px-4 py-2 z-50 sticky top-0"
    >
      <div className="flex flex-wrap items-center justify-between gap-1.5 text-xs font-semibold leading-snug">
        <div className="flex items-start gap-1.5 flex-1 min-w-[220px]">
          <AlertTriangle className="w-4 h-4 text-amber-950 dark:text-amber-300 shrink-0 mt-0.5" aria-hidden="true" />
          <span className="break-words">
            <strong className="uppercase font-bold tracking-wider">Test Mode</strong> — Prototype only. Not connected to 911 or real responders.
          </span>
        </div>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-950 text-amber-100 dark:bg-amber-900 dark:text-amber-100 shrink-0 uppercase tracking-wider">
          Phase 0
        </span>
      </div>
    </aside>
  );
}
