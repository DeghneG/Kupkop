/**
 * The rescuer's steps on a case they claimed, in order: On my way, I've arrived, Tell a clinic, wait for the clinic to
 * confirm the animal arrived, then Mark as admitted. Pure logic, shared by the case sheet and the Active Case bar, so both
 * show the same single next step.
 */

export type ClaimStepId = 'on_my_way' | 'arrived' | 'tell_clinic' | 'clinic_confirms' | 'admit';

export interface ClaimStepState {
  checkinKind?: 'on_my_way' | 'arrived' | null;
  headsUpFacilityName?: string | null;
  headsUpResponse?: 'expecting' | 'cannot' | null;
  /** The clinic's reason when it could not take the animal */
  headsUpNote?: string | null;
  /** When the clinic that was told confirmed the animal is there; Admit stays locked until then */
  clinicReceivedAt?: string | null;
}

export interface ClaimStep {
  id: ClaimStepId;
  /** Short name for the progress line */
  short: string;
  done: boolean;
  /** Only "Arrived" can be skipped. The first check-in is required within the confirm window (a rescuer already at the scene taps "I'm already here"). */
  optional: boolean;
}

export function claimSteps(s: ClaimStepState): ClaimStep[] {
  const onTheWay = s.checkinKind === 'on_my_way' || s.checkinKind === 'arrived';
  // A clinic that said it cannot take the animal does not count: the rescuer must choose another
  const clinicTold = !!s.headsUpFacilityName && s.headsUpResponse !== 'cannot';
  return [
    { id: 'on_my_way', short: 'On my way', done: onTheWay, optional: false },
    { id: 'arrived', short: 'Arrived', done: s.checkinKind === 'arrived', optional: true },
    { id: 'tell_clinic', short: 'Clinic told', done: clinicTold, optional: false },
    { id: 'clinic_confirms', short: 'Clinic confirms', done: !!s.clinicReceivedAt, optional: false },
    { id: 'admit', short: 'Admitted', done: false, optional: false },
  ];
}

/** The one step to offer now: the first not done and not skipped. Admit is always the last. */
export function currentStep(steps: ClaimStep[], skipped: ReadonlySet<ClaimStepId> = new Set()): ClaimStep {
  return steps.find((st) => !st.done && !skipped.has(st.id)) ?? steps[steps.length - 1];
}

/** Admit unlocks only once the clinic that was told has confirmed the animal is there. */
export function canAdmit(s: ClaimStepState): boolean {
  return !!s.clinicReceivedAt && !!s.headsUpFacilityName && s.headsUpResponse !== 'cannot';
}
