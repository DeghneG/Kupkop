import { describe, expect, it } from 'vitest';
import { ageLabel, arrivalLabel, arrivalMinutes, describeDistance, isLive, parseRescuerInfo, projectToBox, speedKmh } from './rescuer';

describe('rescuer info', () => {
  it('reads the RPC answer, with or without a position', () => {
    const base = { success: true, claimed: true, name: ' Ana ', role: 'volunteer', member_since: '2026-01-01T00:00:00Z', animals_helped: 3 };
    const without = parseRescuerInfo({ ...base, location: null });
    expect(without).toMatchObject({ name: 'Ana', animalsHelped: 3, location: null, arrived: false });
    expect(parseRescuerInfo({ ...base, arrived: true, location: null })?.arrived).toBe(true);
    const withLoc = parseRescuerInfo({ ...base, location: { latitude: 14.6, longitude: 121.1, accuracy_m: 12, updated_at: '2026-11-11T10:00:00Z' } });
    expect(withLoc?.location).toEqual({ lat: 14.6, lng: 121.1, accuracyM: 12, updatedAt: '2026-11-11T10:00:00Z' });
  });

  it('shows nothing when the case is not claimed or the caller is refused', () => {
    expect(parseRescuerInfo(null)).toBeNull();
    expect(parseRescuerInfo({ success: true, claimed: false })).toBeNull();
    expect(parseRescuerInfo({ success: false, error: 'no' })).toBeNull();
  });

  it('falls back to a neutral name', () => {
    expect(parseRescuerInfo({ success: true, claimed: true, name: '  ' })?.name).toBe('A KupKop volunteer');
  });

  it('says how fresh the position is', () => {
    const now = new Date('2026-11-11T10:00:30Z').getTime();
    expect(ageLabel('2026-11-11T10:00:25Z', now)).toBe('just now');
    expect(ageLabel('2026-11-11T10:00:10Z', now)).toBe('20 s ago');
    expect(ageLabel('2026-11-11T09:57:30Z', now)).toBe('3 min ago');
    expect(isLive('2026-11-11T10:00:00Z', now)).toBe(true);
    expect(isLive('2026-11-11T09:58:00Z', now)).toBe(false);
  });

  it('gives a distance, a direction and a map link', () => {
    const scene = { lat: 14.6335, lng: 121.1015 };
    const volunteer = { lat: 14.6335, lng: 121.1175 }; // about 1.7 km east
    const d = describeDistance(volunteer, scene);
    expect(d.km).toBeGreaterThan(1.5);
    expect(d.km).toBeLessThan(2);
    expect(d.arrow).toBe('→');
    expect(d.compass).toBe('east');
    expect(d.distance).toBe('1.7 km');
  });
});

import { reporterStatus } from './rescuer';

describe('what the reporter is told at each step', () => {
  it('follows the volunteer step by step, newest step first', () => {
    expect(reporterStatus({ state: 'reported' })).toBe('Waiting for a volunteer to take it.');
    expect(reporterStatus({ state: 'claimed' })).toContain('took it');
    expect(reporterStatus({ state: 'claimed', checkinKind: 'on_my_way' })).toBe('Your volunteer is on the way.');
    expect(reporterStatus({ state: 'claimed', checkinKind: 'arrived' })).toBe('Your volunteer has arrived and is with the animal.');
    expect(reporterStatus({ state: 'claimed', checkinKind: 'arrived', headsUpClinicName: 'Marikina' })).toBe('Your volunteer is taking it to Marikina.');
    expect(reporterStatus({ state: 'claimed', headsUpClinicName: 'Marikina', headsUpResponse: 'expecting' })).toContain('they are expecting it');
    expect(reporterStatus({ state: 'claimed', headsUpClinicName: 'Marikina', clinicReceived: true })).toContain('has the animal');
    expect(reporterStatus({ state: 'admitted', clinicName: 'Marikina' })).toBe('Admitted to Marikina.');
  });

  it('ignores a clinic that said it cannot take the animal', () => {
    expect(reporterStatus({ state: 'claimed', checkinKind: 'arrived', headsUpClinicName: 'Pasig', headsUpResponse: 'cannot' })).toBe(
      'Your volunteer has arrived and is with the animal.'
    );
  });
});

describe('live tracking view', () => {
  const scene = { lat: 14.6335, lng: 121.1015 };

  it('fits the volunteer and the animal into the map box, north up, with padding', () => {
    const volunteer = { lat: 14.6215, lng: 121.0875 }; // south-west of the animal
    const { xy } = projectToBox([volunteer, scene], 320, 180);
    const [v, s] = xy;
    expect(v.x).toBeLessThan(s.x); // west is left
    expect(v.y).toBeGreaterThan(s.y); // south is down
    for (const p of xy) {
      expect(p.x).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(320);
      expect(p.y).toBeGreaterThan(0);
      expect(p.y).toBeLessThan(180);
    }
  });

  it('still gives a map when the volunteer is on top of the animal', () => {
    const { xy } = projectToBox([scene, scene], 320, 180);
    expect(xy[0]).toEqual(xy[1]);
    expect(Number.isFinite(xy[0].x)).toBe(true);
  });

  it('reads speed from the trail and gives an arrival time that shrinks as they get close', () => {
    const t0 = Date.now();
    // 0.01 degrees of latitude is about 1.1 km, covered in one minute: about 66 km/h
    const trail = [
      { lat: 14.62, lng: 121.1, t: t0 },
      { lat: 14.63, lng: 121.1, t: t0 + 60_000 },
    ];
    const v = speedKmh(trail)!;
    expect(v).toBeGreaterThan(60);
    expect(v).toBeLessThan(72);
    expect(arrivalMinutes(2, trail)).toBeLessThanOrEqual(2);
    expect(arrivalMinutes(0.2, trail)).toBe(1);
  });

  it('falls back to a city-traffic guess when the speed cannot be told', () => {
    expect(speedKmh([])).toBeNull();
    expect(arrivalMinutes(10, [])).toBe(30); // 10 km at 20 km/h
    // A stopped or absurd reading is ignored
    const t0 = Date.now();
    expect(arrivalMinutes(10, [{ ...scene, t: t0 }, { ...scene, t: t0 + 60_000 }])).toBe(30);
  });

  it('says it in words', () => {
    expect(arrivalLabel(10, [], false)).toBe('Arriving in about 30 min');
    expect(arrivalLabel(0.1, [], false)).toBe('Arriving in about 1 min');
    expect(arrivalLabel(0.01, [], false)).toBe('Your volunteer is here');
    expect(arrivalLabel(3, [], true)).toBe('Your volunteer is here');
  });
});
