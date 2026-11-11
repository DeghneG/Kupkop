'use client';
import React, { useEffect, useState } from 'react';
import { Lock, LockOpen } from 'lucide-react';
import { IncidentData } from './ListRow';
import { calculateClaimTimer, claimLockMinutes, claimWindowMinutes } from '@/lib/sos/escalation';
import ClaimSteps from '@/components/ClaimSteps';

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
  /** Whether this device is sharing the volunteer's position with the person who reported the case */
  locationShare?: 'off' | 'sharing' | 'denied' | 'unavailable';
  /** An admin may admit without the clinic's confirmation */
  adminOverride?: boolean;
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
  locationShare = 'off',
  adminOverride = false,
}: ActiveCaseBarProps) {
  const [, setTicker] = useState(0);
  // The severity lock (15 / 30 / 60) once the volunteer checks in; before that only the short confirm window holds the claim
  const lockMinutes = claimLockMinutes(incident.type);
  const clinicExpecting = incident.headsUpResponse === 'expecting';
  const windowMinutes = claimWindowMinutes(incident.type, incident.checkinKind ?? null, clinicExpecting, incident.headsUpEtaMinutes);
  const timer = calculateClaimTimer(incident.claimedAt, windowMinutes);
  const expired = timer.isExpired;
  const expiring = !expired && timer.remainingMinutes < EXPIRING_MINUTES;
  // Step 2 ("Arrived"): the rescuer is on the way, so the countdown is not shown. The lock still runs underneath.
  // Not when a clinic is expecting them: then the time is when they are due at the clinic, which they need to see
  const hideTimer = !expired && incident.checkinKind === 'on_my_way' && !clinicExpecting;

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
    ? new Date(new Date(incident.claimedAt).getTime() + windowMinutes * 60 * 1000).toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
      })
    : '';

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
        {!hideTimer && (
          <div
            className={`flex h-7 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-3 text-[12px] font-semibold tabular-nums ${
              expired ? 'bg-surface-muted text-fg' : 'bg-claimed-bg text-claimed-fg'
            }`}
          >
            {expired ? <LockOpen className="size-3.5" aria-hidden /> : <Lock className="size-3.5" aria-hidden />}
            {expired ? 'Lock expired' : pillLabel}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {!expired && !hideTimer && (
          <div className="h-1 overflow-hidden rounded-full bg-surface-muted">
            <div
              className={`h-full rounded-full ${expiring ? 'bg-claimed-fg' : 'bg-fg-muted'}`}
              style={{ width: `${timer.percentRemaining}%` }}
            />
          </div>
        )}
        {/* On step 2 the countdown and its wording are hidden together */}
        {!hideTimer && (
        <p
          className={`text-[12px] ${expiring ? 'font-semibold text-claimed-fg' : 'text-fg-muted'}`}
          aria-live="polite"
        >
          {expired
            ? incident.checkinKind
              ? 'Others can claim this case now.'
              : 'You did not tap On my way in time. Others can claim this case now.'
            : clinicExpecting
              ? `${incident.headsUpFacilityName ?? 'The clinic'} is expecting you by ${lockUntil} (the usual drive in this traffic, plus time to hand over). If you are not there by then, the case opens to other volunteers.`
              : !incident.checkinKind
                ? 'Tap On my way, or I’m already here, before the time runs out, or the case opens for others.'
                : expiring
                ? 'Lock ends soon. Keep going or release it.'
                : `Locked to you until ${lockUntil}`}
        </p>
        )}
        {headsUp && incident.headsUpResponse !== 'cannot' && (
          <p className="text-[12px] text-fg-muted" aria-live="polite">
            {headsUp}
          </p>
        )}
        {!expired && locationShare === 'sharing' && (
          <p className="text-[12px] text-fg-muted">
            Sharing your live location with the person who reported this{clinicExpecting ? ` and with ${incident.headsUpFacilityName ?? 'the clinic'}, which is expecting you` : ''}, until you admit or release it.
          </p>
        )}
        {!expired && (locationShare === 'denied' || locationShare === 'unavailable') && (
          <p className="text-[12px] font-semibold text-claimed-fg">
            {locationShare === 'denied'
              ? 'Location is blocked, so the person who reported this cannot see where you are. Allow location for this site.'
              : 'Could not get your location yet, so it is not being shared.'}
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
        {/* One step at a time: On my way, Arrived, Tell a clinic, then Admit */}
        {!expired && (
          <ClaimSteps
            caseId={incident.id}
            state={incident}
            lockMinutes={lockMinutes}
            canAct
            adminOverride={adminOverride}
            onCheckin={onCheckin}
            onTellClinic={onTellClinic}
            onAdmit={onAdmit}
            admitLabel="Admit"
          />
        )}
      </div>

      {expired ? (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onDismiss}
            className="flex h-11 flex-1 cursor-pointer items-center justify-center rounded-xl border border-border bg-transparent text-[14px] font-semibold text-fg hover:bg-surface-muted"
          >
            Dismiss
          </button>
          <button
            type="button"
            onClick={onClaimAgain}
            className="flex h-12 flex-[1.6] cursor-pointer items-center justify-center gap-2 rounded-xl bg-action text-[14px] font-semibold text-action-fg hover:opacity-95"
          >
            <Lock className="size-3.5" aria-hidden />
            Claim again
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onRelease}
          className="flex h-11 w-full cursor-pointer items-center justify-center rounded-xl border border-border bg-transparent text-[14px] font-semibold text-fg hover:bg-surface-muted"
        >
          Release this case
        </button>
      )}
    </section>
  );
}
