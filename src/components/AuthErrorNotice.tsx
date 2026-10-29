'use client';

import React, { useState, useSyncExternalStore } from 'react';
import { AlertCircle, X } from 'lucide-react';

const noSubscribe = () => () => {};

// /auth/callback sends a failed email link or Google sign-in here with ?auth-error=true
export default function AuthErrorNotice() {
  const failed = useSyncExternalStore(
    noSubscribe,
    () => new URLSearchParams(window.location.search).get('auth-error') === 'true',
    () => false
  );
  const [dismissed, setDismissed] = useState(false);

  if (!failed || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    window.history.replaceState(null, '', window.location.pathname);
  };

  return (
    <div role="alert" className="mt-4 mx-4 flex items-start gap-3 rounded-2xl border border-border bg-surface p-4">
      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-claimed-fg" aria-hidden="true" />
      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-[14px] font-semibold text-fg">That sign-in link didn&apos;t work</p>
        <p className="text-[12px] text-fg-muted">
          Links expire after one use, and only work in the browser that asked for them. Tap Sign in and use the code
          from a new email instead.
        </p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="w-11 h-11 -m-2 shrink-0 rounded-full flex items-center justify-center text-fg-muted hover:text-fg cursor-pointer"
      >
        <X className="w-4 h-4" aria-hidden="true" />
      </button>
    </div>
  );
}
