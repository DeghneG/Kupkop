import { describe, expect, it } from 'vitest';
import {
  calculateClaimTimer,
  calculateEscalation,
  calculateFacilityInactivity,
  getEscalationTier,
  needsRescuer,
  formatWaited,
  isOnLiveFeed,
} from './escalation';
import { alertRecipients, currentAlertStage, planAlertStages, usersInArea } from './alerts';
import { distanceKm, generateCaseId } from './geo';
import { animalLabel, emergencyLabel } from './labels';

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

describe('waiting time labels', () => {
  it.each([
    [7, '7m'],
    [59, '59m'],
    [60, '1h'],
    [200, '3h'],
    [1440, '1d'],
    [21874, '15d'],
  ])('%i minutes reads %s', (minutes, label) => expect(formatWaited(minutes)).toBe(label));
});

describe('live feed window (24 hours)', () => {
  const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

  it('a case waiting for a rescuer leaves after 24 hours', () => {
    expect(isOnLiveFeed({ state: 'reported', createdAt: hoursAgo(23) })).toBe(true);
    expect(isOnLiveFeed({ state: 'reported', createdAt: hoursAgo(25) })).toBe(false);
  });

  it('an expired claim counts as waiting, so it leaves too', () => {
    expect(isOnLiveFeed({ state: 'claimed', createdAt: hoursAgo(30), claimedAt: hoursAgo(29) })).toBe(false);
    expect(isOnLiveFeed({ state: 'claimed', createdAt: hoursAgo(30), claimedAt: hoursAgo(0.2) })).toBe(true);
  });

  it('a case in care stays however old it is', () => {
    expect(isOnLiveFeed({ state: 'admitted', createdAt: hoursAgo(24 * 20) })).toBe(true);
    expect(isOnLiveFeed({ state: 'healing', createdAt: hoursAgo(24 * 20) })).toBe(true);
  });

  it('a resolved case leaves 24 hours after it was resolved, not after it was reported', () => {
    expect(isOnLiveFeed({ state: 'resolved', createdAt: hoursAgo(24 * 6), updatedAt: hoursAgo(5) })).toBe(true);
    expect(isOnLiveFeed({ state: 'resolved', createdAt: hoursAgo(24 * 6), updatedAt: hoursAgo(30) })).toBe(false);
  });
});

describe('naming an "other" animal', () => {
  it('labels it by the typed name, tidied up', () => {
    expect(animalLabel('other', 'guinea pig')).toBe('Injured Guinea Pig');
    expect(animalLabel('other', '  rabbit ')).toBe('Injured Rabbit');
    expect(animalLabel('other', 'ibon')).toBe('Injured Ibon');
  });
  it('falls back to Injured Animal when empty, too short, too long, or marked up', () => {
    expect(animalLabel('other')).toBe('Injured Animal');
    expect(animalLabel('other', 'a')).toBe('Injured Animal');
    expect(animalLabel('other', 'x'.repeat(31))).toBe('Injured Animal');
    expect(animalLabel('other', '<b>hi</b>')).toBe('Injured Animal');
  });
  it('ignores the typed name for a dog or a cat', () => {
    expect(animalLabel('dog', 'rabbit')).toBe('Injured Dog');
    expect(animalLabel('cat', 'rabbit')).toBe('Injured Cat');
  });
});
