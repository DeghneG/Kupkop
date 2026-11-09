import { describe, expect, it } from 'vitest';
import {
  calculateClaimTimer,
  calculateEscalation,
  calculateFacilityInactivity,
  getEscalationTier,
  needsRescuer,
} from './escalation';
import { alertRecipients, currentAlertStage, planAlertStages, usersInArea } from './alerts';
import { distanceKm, generateCaseId } from './geo';
import { emergencyLabel } from './labels';

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();

describe('escalation tiers (AGENTS.md)', () => {
  it.each([
    ['hit_and_run', 'critical'],
    ['bleeding', 'critical'],
    ['fracture', 'urgent'],
    ['trapped_abused', 'urgent'],
    ['sick_mange', 'moderate'],
    ['other', 'moderate'],
  ])('%s is %s', (type, tier) => expect(getEscalationTier(type)).toBe(tier));

  it.each([
    ['hit_and_run', 0, 'standard'],
    ['hit_and_run', 3, 'widened'],
    ['bleeding', 10, 'alert'],
    ['fracture', 4, 'standard'],
    ['fracture', 5, 'widened'],
    ['trapped_abused', 15, 'alert'],
    ['sick_mange', 14, 'standard'],
    ['sick_mange', 15, 'widened'],
    ['sick_mange', 60, 'alert'],
  ])('%s after %i min is %s', (type, minutes, stage) =>
    expect(calculateEscalation(minutesAgo(minutes), type).stage).toBe(stage)
  );

  it('reads the feed labels too', () => {
    expect(getEscalationTier(emergencyLabel('bleeding'))).toBe('critical');
    expect(getEscalationTier(emergencyLabel('trapped_abused'))).toBe('urgent');
  });
});

describe('claim lock', () => {
  it('runs 60 minutes', () => {
    expect(calculateClaimTimer(minutesAgo(10)).isExpired).toBe(false);
    expect(calculateClaimTimer(minutesAgo(61)).isExpired).toBe(true);
  });

  it('an expired claim needs a rescuer again', () => {
    expect(needsRescuer('reported', null)).toBe(true);
    expect(needsRescuer('claimed', minutesAgo(10))).toBe(false);
    expect(needsRescuer('claimed', minutesAgo(61))).toBe(true);
    expect(needsRescuer('admitted', minutesAgo(90))).toBe(false);
  });
});

describe('14-day care clock', () => {
  it.each([
    [0, 'active'],
    [10, 'active'],
    [11, 'warning'],
    [14, 'alert'],
  ])('day %i is %s', (days, status) => expect(calculateFacilityInactivity(daysAgo(days)).status).toBe(status));
});

describe('alert stages', () => {
  it('follows the tier timings', () => {
    expect(currentAlertStage(minutesAgo(1), 'hit_and_run')).toBe('initial');
    expect(currentAlertStage(minutesAgo(3), 'hit_and_run')).toBe('widened');
    expect(currentAlertStage(minutesAgo(10), 'hit_and_run')).toBe('no_responder');
    expect(currentAlertStage(minutesAgo(14), 'sick_mange')).toBe('initial');
  });

  it('a late scheduler sends only the newest stage', () => {
    expect(planAlertStages('no_responder', [])).toEqual({ send: 'no_responder', skip: ['initial', 'widened'] });
    expect(planAlertStages('widened', ['initial'])).toEqual({ send: 'widened', skip: [] });
    expect(planAlertStages('widened', ['initial', 'widened'])).toEqual({ send: null, skip: [] });
  });
});

describe('alert recipients', () => {
  const report = { lat: 14.6198, lng: 121.0526 };
  const targets = {
    volunteerIds: ['near', 'far', 'noArea', 'reporter'],
    adminIds: ['admin'],
    areas: [
      { userId: 'near', latitude: 14.62, longitude: 121.053, radiusKm: 3 },
      { userId: 'far', latitude: 14.4, longitude: 121.0, radiusKm: 3 },
      { userId: 'reporter', latitude: 14.62, longitude: 121.053, radiusKm: 3 },
      { userId: 'citizen', latitude: 14.62, longitude: 121.053, radiusKm: 3 },
    ],
    reporterId: 'reporter',
  };

  it('initial: responders whose area covers the report, never the reporter or a non-responder', () => {
    expect(alertRecipients('initial', report, targets)).toEqual(['near']);
  });

  it('widened: every other responder', () => {
    expect(alertRecipients('widened', report, targets).sort()).toEqual(['admin', 'far', 'noArea']);
  });

  it('no responder: admins', () => {
    expect(alertRecipients('no_responder', report, targets)).toEqual(['admin']);
  });

  it('area check uses the radius', () => {
    expect(usersInArea(report, [{ userId: 'x', latitude: 14.6198, longitude: 121.07, radiusKm: 1 }])).toEqual([]);
    expect(usersInArea(report, [{ userId: 'x', latitude: 14.6198, longitude: 121.07, radiusKm: 3 }])).toEqual(['x']);
  });
});

describe('geo', () => {
  it('measures distance in km', () => {
    expect(distanceKm({ lat: 0, lng: 0 }, { lat: 0, lng: 1 })).toBeCloseTo(111.2, 0);
  });

  it('case IDs are short and readable aloud', () => {
    for (let i = 0; i < 50; i++) expect(generateCaseId()).toMatch(/^KK-[A-Z0-9]{4}$/);
  });
});
