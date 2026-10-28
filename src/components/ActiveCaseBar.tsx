'use client';
import React, { useEffect, useState } from 'react';
import { Lock, LockOpen, Check } from 'lucide-react';
import { IncidentData } from './ListRow';
import { calculateClaimTimer, ESCALATION_CONFIG } from '@/lib/sos/escalation';

interface ActiveCaseBarProps {
  incident: IncidentData;
  error?: string | null;
  onRelease: () => void;
  onAdmit: () => void;
  onClaimAgain: () => void;
  onDismiss: () => void;
}

// Under this many minutes the pill switches to m:ss and the note warns
const EXPIRING_MINUTES = 5;

export default function ActiveCaseBar({
  incident,
  error,
  onRelease,
  onAdmit,
  onClaimAgain,
  onDismiss,
}: ActiveCaseBarProps) {
  const [, setTicker] = useState(0);
  const timer = calculateClaimTimer(incident.claimedAt);
  const expired = timer.isExpired;
  const expiring = !expired && timer.remainingMinutes < EXPIRING_MINUTES;

  // Live tick until the lock runs out
  useEffect(() => {
    if (expired) return;
    const interval = setInterval(() => setTicker((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [expired]);

  const pillLabel = expiring
    ? `${timer.remainingMinutes}:${String(timer.remainingSeconds).padStart(2, '0')} left`
    : `${timer.remainingMinutes + (timer.remainingSeconds > 0 ? 1 : 0)}m left`;

  const lockUntil = incident.claimedAt
    ? new Date(
        new Date(incident.claimedAt).getTime() + ESCALATION_CONFIG.claimLockDurationMinutes * 60 * 1000
      ).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : '';

  return (
    <section
      role="region"
      aria-label="Your active case"
      className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 shadow-[0_1px_2px_rgba(0,0,0,0.06),0_4px_12px_rgba(0,0,0,0.06)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <b className="text-[16px] font-semibold tracking-wide tabular-nums text-fg">
            #{incident.shortId}
          </b>
          <span className="truncate text-[14px] text-fg-muted">
            {incident.animal} · {incident.type}
          </span>
        </div>
        <div
          className={`flex h-7 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-3 text-[12px] font-semibold tabular-nums ${
            expired ? 'bg-surface-muted text-fg' : 'bg-claimed-bg text-claimed-fg'
          }`}
        >
          {expired ? <LockOpen className="size-3.5" aria-hidden /> : <Lock className="size-3.5" aria-hidden />}
          {expired ? 'Lock expired' : pillLabel}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {!expired && (
          <div className="h-1 overflow-hidden rounded-full bg-surface-muted">
            <div
              className={`h-full rounded-full ${expiring ? 'bg-claimed-fg' : 'bg-fg-muted'}`}
              style={{ width: `${timer.percentRemaining}%` }}
            />
          </div>
        )}
        <p
          className={`text-[12px] ${expiring ? 'font-semibold text-claimed-fg' : 'text-fg-muted'}`}
          aria-live="polite"
        >
          {expired
            ? 'Others can claim this case now.'
            : expiring
              ? 'Lock ends soon. Admit or release.'
              : `Locked to you until ${lockUntil}`}
        </p>
        {error && (
          <p role="alert" className="text-[12px] font-semibold text-reported-fg">
            {error}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={expired ? onDismiss : onRelease}
          className="flex h-11 flex-1 cursor-pointer items-center justify-center rounded-xl border border-border bg-transparent text-[14px] font-semibold text-fg hover:bg-surface-muted"
        >
          {expired ? 'Dismiss' : 'Release'}
        </button>
        <button
          type="button"
          onClick={expired ? onClaimAgain : onAdmit}
          className="flex h-12 flex-[1.6] cursor-pointer items-center justify-center gap-2 rounded-xl bg-action text-[14px] font-semibold text-action-fg hover:opacity-95"
        >
          {expired ? <Lock className="size-3.5" aria-hidden /> : <Check className="size-3.5" aria-hidden />}
          {expired ? 'Claim again' : 'Admit'}
        </button>
      </div>
    </section>
  );
}
