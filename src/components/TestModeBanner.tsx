import React from 'react';
import { AlertTriangle, ShieldAlert } from 'lucide-react';

export default function TestModeBanner() {
  return (
    <aside
      role="banner"
      aria-label="Prototype Test Mode Notice"
      className="w-full bg-amber-500 text-amber-950 font-semibold text-xs px-3 py-1.5 shadow-sm border-b border-amber-600 flex items-center justify-between z-50 sticky top-0"
    >
      <div className="flex items-center gap-1.5 truncate">
        <AlertTriangle className="w-4 h-4 text-amber-950 shrink-0" aria-hidden="true" />
        <span className="tracking-wide uppercase font-bold">Test Mode</span>
        <span className="hidden sm:inline text-amber-900">•</span>
        <span className="truncate text-amber-900 text-[11px] sm:text-xs font-medium">
          Prototype only — not connected to 911 / real dispatch
        </span>
      </div>

      <div className="flex items-center gap-1.5 shrink-0 pl-2">
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-100 tracking-wider uppercase">
          Phase 0
        </span>
      </div>
    </aside>
  );
}
