'use client';
import React, { useEffect, useState } from 'react';
import { Lock, LockOpen, Check } from 'lucide-react';
import { IncidentData } from './ListRow';
import { calculateClaimTimer, claimLockMinutes } from '@/lib/sos/escalation';

interface ActiveCaseBarProps {
  incident: IncidentData;
  error?: string | null;
  onRelease: () => void;
  onAdmit: () => void;
  onClaimAgain: () => void;
  onDismiss: () => void;
  /** "On my way" then "Arrived": each restarts the lock, once */
  onCheckin?: (kind: 'on_my_way' | 'arrived') => void;
  /** Tell a clinic you are bringing an animal (real cases only) */
  onTellClinic?: () => void;
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
  onCheckin,
  onTellClinic,
}: ActiveCaseBarProps) {
  const [, setTicker] = useState(0);
  const lockMinutes = claimLockMinutes(incident.type);
  const timer = calculateClaimTimer(incident.claimedAt, lockMinutes);
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
    ? new Date(new Date(incident.claimedAt).getTime() + lockMinutes * 60 * 1000).toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
      })
    : '';

  // The next check-in on offer, if any
  const nextCheckin = !incident.checkinKind ? 'on_my_way' : incident.checkinKind === 'on_my_way' ? 'arrived' : null;
  const standbyCount = incident.standby?.length ?? 0;
  const headsUp = incident.headsUpFacilityName
    ? incident.headsUpResponse === 'expecting'
      ? `${incident.headsUpFacilityName} is expecting you.`
      : incident.headsUpResponse === 'cannot'
        ? `${incident.headsUpFacilityName} cannot take it now${incident.headsUpNote ? `: ${incident.headsUpNote}` : ''}. Choose another clinic.`
        : `Told ${incident.headsUpFacilityName}. Waiting for their answer.`
    : null;

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
        {headsUp && (
          <p
            className={`text-[12px] ${incident.headsUpResponse === 'cannot' ? 'font-semibold text-claimed-fg' : 'text-fg-muted'}`}
            aria-live="polite"
          >
            {headsUp}
          </p>
        )}
        {standbyCount > 0 && (
          <p className="text-[12px] text-fg-muted">
            {standbyCount === 1 ? '1 volunteer is' : `${standbyCount} volunteers are`} on standby if you cannot go.
          </p>
        )}
        {error && (
          <p role="alert" className="text-[12px] font-semibold text-fg">
            {error}
          </p>
        )}
        {!expired && onCheckin && nextCheckin && (
          <button
            type="button"
            onClick={() => onCheckin(nextCheckin)}
            className="min-h-[44px] rounded-xl border border-border bg-surface hover:bg-surface-muted text-[14px] font-semibold text-fg cursor-pointer"
          >
            {nextCheckin === 'on_my_way' ? `On my way (restarts the ${lockMinutes}-minute lock)` : "I've arrived (restarts the lock)"}
          </button>
        )}
        {!expired && onTellClinic && (
          <button
            type="button"
            onClick={onTellClinic}
            className="min-h-[44px] rounded-xl border border-border bg-surface hover:bg-surface-muted text-[14px] font-semibold text-fg cursor-pointer"
          >
            {incident.headsUpFacilityName ? 'Tell a different clinic' : 'Tell a clinic I’m coming'}
          </button>
        )}
        {incident.checkinKind === 'arrived' && <p className="text-[12px] text-fg-muted">You checked in: arrived.</p>}
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
