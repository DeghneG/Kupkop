'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusTrap } from '@/lib/useFocusTrap';

export interface ConfirmOptions {
  /** A question that names the exact action: "Claim case #KK-4821?" */
  title: string;
  /** What will happen, in plain words */
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Runs when the person confirms. The sheet closes when it finishes. */
  onConfirm: () => Promise<unknown> | unknown;
}

/** A stray touch cannot confirm: the button stays off for this long after the sheet opens. */
export const CONFIRM_ARM_MS = 600;

interface ConfirmSheetProps {
  options: ConfirmOptions | null;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

// One "Are you sure?" step for every serious button (D-042): claim, release, clinic answers, status changes.
// Not a browser dialog: it names the action, says what happens, and ignores touches in its first moments.
export function ConfirmSheet({ options, busy, onConfirm, onCancel }: ConfirmSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [armed, setArmed] = useState(false);
  const open = options != null;
  useFocusTrap(panelRef, open);

  useEffect(() => {
    if (!open) return;
    const arm = setTimeout(() => setArmed(true), CONFIRM_ARM_MS);
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onCancel();
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(arm);
      setArmed(false);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, busy, onCancel]);

  if (!options) return null;

  return (
    <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message" className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="fixed inset-0 bg-black/60" onClick={busy ? undefined : onCancel} aria-hidden="true" />
      <div
        ref={panelRef}
        className="relative z-10 w-full max-w-sm bg-surface border-t sm:border border-border rounded-t-[24px] sm:rounded-[24px] p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] sm:pb-5 space-y-4"
      >
        <div className="space-y-1.5">
          <h2 id="confirm-title" className="text-[22px] font-semibold text-fg leading-tight">
            {options.title}
          </h2>
          <p id="confirm-message" className="text-[14px] text-fg-muted leading-snug">
            {options.message}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="flex-1 min-h-[48px] rounded-xl border border-border bg-surface hover:bg-surface-muted text-fg font-semibold text-[14px] cursor-pointer disabled:opacity-50"
          >
            {options.cancelLabel ?? 'Cancel'}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!armed || busy}
            aria-disabled={!armed || busy}
            className="flex-1 min-h-[48px] rounded-xl bg-action text-action-fg font-semibold text-[14px] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? 'Working…' : options.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/** `ask(options)` opens the sheet; render `sheet` once near the root of the screen. */
export function useConfirm() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [busy, setBusy] = useState(false);

  const ask = useCallback((next: ConfirmOptions) => setOptions(next), []);
  const cancel = useCallback(() => setOptions(null), []);
  const confirm = useCallback(async () => {
    if (!options) return;
    setBusy(true);
    try {
      await options.onConfirm();
    } finally {
      setBusy(false);
      setOptions(null);
    }
  }, [options]);

  const sheet = <ConfirmSheet options={options} busy={busy} onConfirm={confirm} onCancel={cancel} />;
  return { ask, sheet };
}

export default ConfirmSheet;
