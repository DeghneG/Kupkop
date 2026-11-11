import { describe, expect, it } from 'vitest';
import { canAdmit, claimSteps, currentStep } from './steps';

const now = (s: Parameters<typeof claimSteps>[0], skipped: string[] = []) =>
  currentStep(claimSteps(s), new Set(skipped as never[])).id;

const told = { checkinKind: 'arrived', headsUpFacilityName: 'Marikina', headsUpResponse: null } as const;

describe('claim steps', () => {
  it('goes On my way, Arrived, Tell a clinic, Clinic confirms, Admit, one at a time', () => {
    expect(now({})).toBe('on_my_way');
    expect(now({ checkinKind: 'on_my_way' })).toBe('arrived');
    expect(now({ checkinKind: 'arrived' })).toBe('tell_clinic');
    expect(now(told)).toBe('clinic_confirms');
    expect(now({ ...told, headsUpResponse: 'expecting' })).toBe('clinic_confirms');
    expect(now({ ...told, clinicReceivedAt: '2026-11-11T10:00:00Z' })).toBe('admit');
  });

  it('asks for another clinic when the first one cannot take the animal', () => {
    expect(now({ checkinKind: 'arrived', headsUpFacilityName: 'Pasig', headsUpResponse: 'cannot' })).toBe('tell_clinic');
  });

  it('lets only Arrived be skipped: the first check-in is required in time', () => {
    expect(claimSteps({}).map((s) => s.optional)).toEqual([false, true, false, false, false]);
    expect(now({}, ['arrived'])).toBe('on_my_way'); // skipping Arrived changes nothing until On my way is done
    expect(now({ checkinKind: 'on_my_way' }, ['arrived'])).toBe('tell_clinic');
    // Tapping "I'm already here" straight away counts as the first check-in
    expect(now({ checkinKind: 'arrived' })).toBe('tell_clinic');
  });

  it('keeps Admit locked until the clinic that was told confirmed', () => {
    expect(canAdmit({})).toBe(false);
    expect(canAdmit(told)).toBe(false);
    expect(canAdmit({ ...told, headsUpResponse: 'expecting' })).toBe(false);
    expect(canAdmit({ ...told, clinicReceivedAt: '2026-11-11T10:00:00Z' })).toBe(true);
    expect(canAdmit({ ...told, headsUpResponse: 'cannot', clinicReceivedAt: '2026-11-11T10:00:00Z' })).toBe(false);
  });
});
