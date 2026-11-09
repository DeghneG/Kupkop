'use client';

import React, { useState } from 'react';
import { Flag } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { FLAG_REASON_LABELS } from '@/lib/sos/labels';
import type { FlagReason } from '@/types/database';

interface FlagReportProps {
  reportId: string;
  userId: string | null;
  onSignIn?: () => void;
}

// Anyone signed in can flag a fake, duplicate or abusive report. An admin decides; nothing is hidden automatically.
export default function FlagReport({ reportId, userId, onSignIn }: FlagReportProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<FlagReason | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  if (result?.ok) {
    return (
      <p role="status" className="text-[12px] text-fg-muted text-center py-2">
        {result.text}
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => (userId ? setOpen(true) : onSignIn?.())}
        className="w-full min-h-[44px] rounded-xl text-fg-muted hover:text-fg font-semibold text-[14px] flex items-center justify-center gap-2 cursor-pointer"
      >
        <Flag className="w-4 h-4" aria-hidden="true" />
        {userId ? 'Report a problem with this case' : 'Sign in to report a problem'}
      </button>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason || !userId) return;
    setBusy(true);
    setResult(null);
    const { error } = await createClient()
      .from('report_flags')
      .insert({ report_id: reportId, flagged_by: userId, reason, note: note.trim() || null });
    setBusy(false);
    if (error) {
      setResult({
        ok: error.code === '23505',
        text:
          error.code === '23505'
            ? 'You already reported this case. An admin will review it.'
            : 'Could not send. Please try again.',
      });
      return;
    }
    setResult({ ok: true, text: 'Thanks. An admin will review this case.' });
  };

  return (
    <form onSubmit={submit} className="rounded-2xl border border-border p-4 space-y-3">
      <fieldset className="space-y-1">
        <legend className="text-[14px] font-semibold text-fg pb-1">What is wrong with this case?</legend>
        {(Object.keys(FLAG_REASON_LABELS) as FlagReason[]).map((r) => (
          <label key={r} className="min-h-[44px] flex items-center gap-3 text-[14px] text-fg cursor-pointer">
            <input
              type="radio"
              name={`flag-${reportId}`}
              checked={reason === r}
              onChange={() => setReason(r)}
              className="w-4 h-4 accent-[var(--action)]"
            />
            {FLAG_REASON_LABELS[r]}
          </label>
        ))}
      </fieldset>
      <label className="block space-y-1">
        <span className="text-[12px] font-semibold text-fg">Details (optional)</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={300}
          rows={2}
          className="w-full rounded-xl border border-border bg-surface-muted text-fg text-[14px] p-3 focus:outline-none focus:ring-2 focus:ring-action"
        />
      </label>
      {result && !result.ok && (
        <p role="alert" className="text-[12px] font-semibold text-fg">
          {result.text}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="min-h-[44px] px-4 rounded-xl border border-border bg-surface hover:bg-surface-muted text-fg font-semibold text-[14px] cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!reason || busy}
          className="flex-1 min-h-[44px] rounded-xl bg-fg text-page font-semibold text-[14px] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? 'Sending…' : 'Send to admin'}
        </button>
      </div>
    </form>
  );
}
