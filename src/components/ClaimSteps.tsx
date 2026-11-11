'use client';

import React, { useState } from 'react';
import { Check, HeartPulse, Lock } from 'lucide-react';
import { canAdmit, claimSteps, currentStep, type ClaimStepId, type ClaimStepState } from '@/lib/sos/steps';

interface ClaimStepsProps {
  /** The case id: skipped steps are forgotten when another case is shown */
  caseId: string;
  state: ClaimStepState;
  lockMinutes: number;
  /** The rescuer can still check in and tell a clinic (their own case, live, lock not expired). Otherwise only Admit shows. */
  canAct: boolean;
  /** An admin may admit without the clinic's confirmation (a clinic with no staff account) */
  adminOverride?: boolean;
  onCheckin?: (kind: 'on_my_way' | 'arrived') => void;
  onTellClinic?: () => void;
  onAdmit: () => void;
  admitLabel?: string;
}

const secondary =
  'w-full min-h-[44px] rounded-xl border border-border bg-surface hover:bg-surface-muted text-fg font-semibold text-[14px] cursor-pointer';
const primary =
  'w-full min-h-[48px] rounded-xl bg-action hover:opacity-90 active:scale-[0.98] text-action-fg font-semibold text-[14px] flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer border-none';

// One step at a time for the rescuer: a short progress line and only the next action. Release stays with the host.
// Admit is locked until the clinic that was told confirms the animal is there.
export default function ClaimSteps({
  caseId,
  state,
  lockMinutes,
  canAct,
  adminOverride = false,
  onCheckin,
  onTellClinic,
  onAdmit,
  admitLabel = 'Mark as Admitted',
}: ClaimStepsProps) {
  const [skippedFor, setSkippedFor] = useState<{ id: string; steps: ClaimStepId[] }>({ id: caseId, steps: [] });
  const skipped = new Set<ClaimStepId>(skippedFor.id === caseId ? skippedFor.steps : []);
  // A check-in this screen cannot offer is treated as skipped, so the rescuer is never stuck on it
  if (!onCheckin) {
    skipped.add('on_my_way');
    skipped.add('arrived');
  }

  const clinic = state.headsUpFacilityName ?? 'The clinic';
  const unlocked = canAdmit(state);

  // Not the rescuer's own case (an admin looking at it): no steps, only the admin's direct admit
  if (!canAct) {
    return (
      <button type="button" onClick={onAdmit} className={primary}>
        <HeartPulse className="w-5 h-5" aria-hidden="true" />
        <span>{admitLabel} (admin)</span>
      </button>
    );
  }

  const steps = claimSteps(state);
  const current = currentStep(steps, skipped);
  const skip = () => setSkippedFor({ id: caseId, steps: [...skipped, current.id] });

  return (
    <div className="space-y-2">
      {/* A denial is the one thing the rescuer must not miss: it is the first thing in the bar */}
      {state.headsUpResponse === 'cannot' && state.headsUpFacilityName && (
        <div role="alert" className="rounded-xl border-2 border-fg bg-surface-muted px-3 py-2 space-y-0.5">
          <p className="text-[14px] font-bold text-fg">{clinic} cannot take the animal now</p>
          {state.headsUpNote && <p className="text-[12px] text-fg">“{state.headsUpNote}”</p>}
          <p className="text-[12px] text-fg-muted">Choose another clinic below.</p>
        </div>
      )}
      <ol aria-label="Your steps" className="flex items-center justify-between gap-1 text-[12px]">
        {steps.map((st, i) => {
          const finished = st.done || skipped.has(st.id);
          const isCurrent = st.id === current.id;
          return (
            <li key={st.id} aria-current={isCurrent ? 'step' : undefined} className={`flex items-center gap-1 ${isCurrent ? 'font-bold text-fg' : 'text-fg-muted'}`}>
              <span
                aria-hidden="true"
                className={`w-5 h-5 shrink-0 rounded-full border flex items-center justify-center text-[12px] tabular-nums ${
                  isCurrent ? 'border-fg bg-fg text-page' : finished ? 'border-border bg-surface-muted' : 'border-border'
                }`}
              >
                {finished && !isCurrent ? <Check className="w-3 h-3" /> : i + 1}
              </span>
              {/* Only the current step is named on a narrow phone; the others are named for screen readers and on wider screens */}
              <span className={isCurrent ? '' : 'sr-only min-[480px]:not-sr-only'}>
                {st.short}
                {finished && <span className="sr-only"> (done)</span>}
              </span>
            </li>
          );
        })}
      </ol>

      {current.id === 'on_my_way' && (
        <div className="space-y-1">
          <button type="button" onClick={() => onCheckin?.('on_my_way')} className={primary}>
            On my way
          </button>
          <p className="text-[12px] text-fg-muted text-center">
            Tap it soon: if you do not, the case opens for others. It then holds for {lockMinutes} minutes, and the person who reported it is told.
          </p>
          <button type="button" onClick={() => onCheckin?.('arrived')} className={`${secondary} border-transparent bg-transparent text-fg-muted font-normal underline underline-offset-4`}>
            I’m already at the animal
          </button>
        </div>
      )}
      {current.id === 'arrived' && (
        <div className="space-y-1">
          <button type="button" onClick={() => onCheckin?.('arrived')} className={primary}>
            I’ve arrived
          </button>
          <p className="text-[12px] text-fg-muted text-center">The person who reported it is told you are there.</p>
        </div>
      )}
      {current.id === 'tell_clinic' && (
        <div className="space-y-1">
          <button type="button" onClick={onTellClinic} disabled={!onTellClinic} className={`${primary} disabled:opacity-50 disabled:cursor-not-allowed`}>
            {state.headsUpResponse === 'cannot' ? 'Choose another clinic' : 'Tell a clinic I’m coming'}
          </button>
          <p className="text-[12px] text-fg-muted text-center">
            {state.headsUpResponse === 'cannot'
              ? 'Pick a clinic that can take it.'
              : 'Required: the clinic gets a heads-up, and confirms when the animal is there.'}
          </p>
        </div>
      )}
      {(current.id === 'clinic_confirms' || current.id === 'admit') && (
        <div className="space-y-2">
          {current.id === 'clinic_confirms' && (
            <div role="status" aria-live="polite" className="text-center space-y-0.5">
              <p className="text-[14px] text-fg">
                {state.headsUpResponse === 'expecting' ? (
                  <>
                    <strong className="font-semibold">{clinic}</strong> is expecting you.
                  </>
                ) : (
                  <>
                    Waiting for <strong className="font-semibold">{clinic}</strong> to answer.
                  </>
                )}
              </p>
              <p className="text-[12px] text-fg-muted">They tap Animal arrived when the animal is there.</p>
            </div>
          )}
          <button
            type="button"
            onClick={onAdmit}
            disabled={!unlocked}
            aria-disabled={!unlocked}
            className={`${primary} disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {unlocked ? <HeartPulse className="w-5 h-5" aria-hidden="true" /> : <Lock className="w-4 h-4" aria-hidden="true" />}
            <span>{unlocked ? `${admitLabel} to ${clinic}` : `${admitLabel} (locked)`}</span>
          </button>
          <p className="text-[12px] text-fg-muted text-center">
            {unlocked ? `${clinic} confirmed the animal is there.` : 'Unlocks when the clinic confirms the animal arrived.'}
          </p>
          {current.id === 'clinic_confirms' && onTellClinic && (
            <button type="button" onClick={onTellClinic} className={secondary}>
              Wrong clinic? Tell a different one
            </button>
          )}
        </div>
      )}

      {current.optional && (
        <button type="button" onClick={skip} className={`${secondary} border-transparent bg-transparent text-fg-muted font-normal underline underline-offset-4`}>
          Skip this step
        </button>
      )}
      {adminOverride && current.id !== 'admit' && !unlocked && (
        <button type="button" onClick={onAdmit} className={`${secondary} border-transparent bg-transparent text-fg-muted font-normal underline underline-offset-4`}>
          Admit without the clinic’s confirmation (admin)
        </button>
      )}
    </div>
  );
}
