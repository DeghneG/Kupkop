import { describe, expect, it } from 'vitest';
import { claimLockEndsAt, claimLockMinutes, claimWindowMinutes, isOnLiveFeed, needsRescuer } from './escalation';
import { reporterNoResponderMessage } from './alerts';
import { availabilityNote, clinicAnswerMessage, effectiveAvailability, estimateEtaMinutes, headsUpMessage, rankClinics } from './clinics';
import { canClaimNow, claimPhase, standbyPosition, standbyQueue } from './standby';

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();

describe('claim lock by severity (D-042)', () => {
  it.each([
    ['hit_and_run', 15],
    ['bleeding', 15],
    ['fracture', 30],
    ['trapped_abused', 30],
    ['sick_mange', 60],
    ['other', 60],
    [undefined, 60],
  ])('%s locks for %s minutes', (type, minutes) => expect(claimLockMinutes(type)).toBe(minutes));

  it('a critical claim is open again after 15 minutes, a moderate one is not', () => {
    expect(needsRescuer('claimed', minutesAgo(16), 'hit_and_run')).toBe(true);
    expect(needsRescuer('claimed', minutesAgo(16), 'sick_mange')).toBe(false);
    expect(needsRescuer('claimed', minutesAgo(31), 'fracture')).toBe(true);
  });

  it('reads the feed labels too', () => {
    expect(claimLockMinutes('Hit-and-run · Critical')).toBe(15);
    expect(claimLockMinutes('Fracture / Limping')).toBe(30);
  });

  it('knows when the lock ends', () => {
    const ends = claimLockEndsAt(minutesAgo(5), 'bleeding')!;
    expect(Math.round((ends - Date.now()) / 60_000)).toBe(10);
    expect(claimLockEndsAt(null, 'bleeding')).toBeNull();
  });

  it('the live feed uses the case type for an expired claim', () => {
    const base = { state: 'claimed', createdAt: daysAgo(2), claimedAt: minutesAgo(20) };
    expect(isOnLiveFeed({ ...base, type: 'hit_and_run' })).toBe(false); // lock over, case is 2 days old
    expect(isOnLiveFeed({ ...base, type: 'sick_mange' })).toBe(true); // still locked, so in care
  });
});

describe('clinic availability', () => {
  it('a recent status counts; an old or missing one is unknown', () => {
    expect(effectiveAvailability('full', hoursAgo(1))).toBe('full');
    expect(effectiveAvailability('open', hoursAgo(11))).toBe('open');
    expect(effectiveAvailability('full', hoursAgo(13))).toBe('unknown');
    expect(effectiveAvailability('full', null)).toBe('unknown');
    expect(effectiveAvailability(null, hoursAgo(1))).toBe('unknown');
    expect(effectiveAvailability('nonsense', hoursAgo(1))).toBe('unknown');
  });

  it('describes the status in plain words', () => {
    expect(availabilityNote('full', minutesAgo(40))).toBe('Full, updated 40 min ago');
    expect(availabilityNote('full', hoursAgo(20))).toContain('Status not reported');
    expect(availabilityNote(null, null)).toBe('Status not reported');
  });

  const clinics = [
    { id: 'far', name: 'Far Clinic', latitude: 14.7, longitude: 121.0, availability: 'open', availabilitySetAt: hoursAgo(1) },
    { id: 'near-full', name: 'Near Full', latitude: 14.6201, longitude: 121.0526, availability: 'full', availabilitySetAt: hoursAgo(1) },
    { id: 'mid', name: 'Mid Clinic', latitude: 14.64, longitude: 121.05, availability: null, availabilitySetAt: null },
  ];
  const here = { lat: 14.6198, lng: 121.0526 };

  it('puts the nearest usable clinic first and Full clinics last', () => {
    const ranked = rankClinics(clinics, here);
    expect(ranked.map((r) => r.clinic.id)).toEqual(['mid', 'far', 'near-full']);
    expect(ranked[0].suggested).toBe(true);
    expect(ranked.filter((r) => r.suggested)).toHaveLength(1);
    expect(ranked[2].usable).toBe(false);
  });

  it('suggests nothing when every clinic is full', () => {
    const allFull = clinics.map((c) => ({ ...c, availability: 'full', availabilitySetAt: hoursAgo(1) }));
    expect(rankClinics(allFull, here).some((r) => r.suggested)).toBe(false);
  });

  it('a Full status that expired no longer hides the clinic', () => {
    const stale = [{ ...clinics[1], availabilitySetAt: hoursAgo(14) }];
    expect(rankClinics(stale, here)[0].usable).toBe(true);
  });

  it('estimates a drive time', () => {
    expect(estimateEtaMinutes(5)).toBe(15);
    expect(estimateEtaMinutes(0.1)).toBe(1);
    expect(estimateEtaMinutes(null)).toBeNull();
  });

  it('writes the heads-up for the clinic', () => {
    const msg = headsUpMessage({ animal: 'Dog', type: 'Hit-and-run', etaMinutes: 10, shortId: 'KK-1A2B' });
    expect(msg.title).toContain('KK-1A2B');
    expect(msg.body).toContain('about 10 min away');
    expect(headsUpMessage({ animal: 'Cat', type: 'Bleeding', etaMinutes: null, shortId: 'KK-1' }).body).toContain('on the way');
  });
});

describe('standby queue', () => {
  const standby = [
    { volunteerId: 'second', joinedAt: minutesAgo(3) },
    { volunteerId: 'first', joinedAt: minutesAgo(8) },
  ];

  it('is first come first served', () => {
    expect(standbyQueue(standby).map((e) => e.volunteerId)).toEqual(['first', 'second']);
    expect(standbyPosition(standby, 'second')).toBe(2);
    expect(standbyPosition(standby, 'nobody')).toBeNull();
    expect(standbyPosition(standby, null)).toBeNull();
  });

  it('a running lock cannot be claimed by anyone', () => {
    const phase = claimPhase({ state: 'claimed', claimedAt: minutesAgo(5), type: 'hit_and_run', standby });
    expect(phase.phase).toBe('locked');
    expect(canClaimNow(phase, 'first')).toBe(false);
  });

  it('right after the lock ends, only the first in line may claim', () => {
    const phase = claimPhase({ state: 'claimed', claimedAt: minutesAgo(16), type: 'hit_and_run', standby });
    expect(phase.phase).toBe('reserved');
    expect(canClaimNow(phase, 'first')).toBe(true);
    expect(canClaimNow(phase, 'second')).toBe(false);
    expect(canClaimNow(phase, 'stranger')).toBe(false);
  });

  it('after the grace window everyone may claim', () => {
    const phase = claimPhase({ state: 'claimed', claimedAt: minutesAgo(19), type: 'hit_and_run', standby });
    expect(phase.phase).toBe('open');
    expect(canClaimNow(phase, 'stranger')).toBe(true);
  });

  it('with nobody on standby the case opens at once', () => {
    expect(claimPhase({ state: 'claimed', claimedAt: minutesAgo(16), type: 'hit_and_run', standby: [] }).phase).toBe('open');
  });

  it('a released case keeps the head start for the first in line', () => {
    expect(claimPhase({ state: 'reported', releasedAt: minutesAgo(1), standby }).phase).toBe('reserved');
    expect(claimPhase({ state: 'reported', releasedAt: minutesAgo(5), standby }).phase).toBe('open');
    expect(claimPhase({ state: 'reported', releasedAt: null, standby }).phase).toBe('open'); // never claimed
  });

  it('a case past the claim stage is not reserved', () => {
    expect(claimPhase({ state: 'admitted', standby }).phase).toBe('open');
  });
});

describe('no responder: the reporter is told too', () => {
  it('names the nearest open clinic and points to Rafa', () => {
    const msg = reporterNoResponderMessage({ shortId: 'KK-9', clinicName: 'Test Clinic A', clinicPhone: '0000-000-0001' });
    expect(msg.title).toContain('KK-9');
    expect(msg.body).toContain('Test Clinic A (0000-000-0001)');
    expect(msg.body).toContain('Rafa');
  });

  it('still helps when no clinic is open', () => {
    const msg = reporterNoResponderMessage({ shortId: 'KK-9', clinicName: null, clinicPhone: null });
    expect(msg.body).not.toContain('nearest clinic');
    expect(msg.body).toContain('Rafa');
  });
});

describe('the one-minute confirm window after claiming', () => {
  it('holds the claim for one minute until the volunteer checks in, then the severity lock applies', () => {
    expect(claimWindowMinutes('hit_and_run', null)).toBe(1);
    expect(claimWindowMinutes('sick_mange', null)).toBe(1);
    expect(claimWindowMinutes('hit_and_run', 'on_my_way')).toBe(15);
    expect(claimWindowMinutes('fracture', 'arrived')).toBe(30);
    // A caller that does not know gets the severity lock
    expect(claimWindowMinutes('hit_and_run')).toBe(15);
  });

  it('opens the case again when nobody tapped On my way in time', () => {
    const thirtySecondsAgo = new Date(Date.now() - 30_000).toISOString();
    expect(needsRescuer('claimed', thirtySecondsAgo, 'hit_and_run', null)).toBe(false);
    expect(needsRescuer('claimed', minutesAgo(2), 'hit_and_run', null)).toBe(true);
    // The same claim two minutes on, but checked in: still locked
    expect(needsRescuer('claimed', minutesAgo(2), 'hit_and_run', 'on_my_way')).toBe(false);
  });

  it('the lock end and the standby phase follow the window', () => {
    const claimedAt = minutesAgo(0.5);
    const ends = claimLockEndsAt(claimedAt, 'bleeding', null)!;
    expect(ends - Date.now()).toBeGreaterThan(25_000);
    expect(ends - Date.now()).toBeLessThan(35_000);
    const standby = [{ volunteerId: 'ana', joinedAt: minutesAgo(5) }];
    expect(claimPhase({ state: 'claimed', claimedAt, type: 'bleeding', checkinKind: null, standby }).phase).toBe('locked');
    // After the minute with no check-in, the first volunteer on standby gets the head start
    expect(claimPhase({ state: 'claimed', claimedAt: minutesAgo(1.5), type: 'bleeding', checkinKind: null, standby }).phase).toBe('reserved');
    expect(claimPhase({ state: 'claimed', claimedAt: minutesAgo(1.5), type: 'bleeding', checkinKind: 'on_my_way', standby }).phase).toBe('locked');
  });
});

describe('what the rescuer is told when the clinic answers', () => {
  it('says expecting, cannot (with the reason) and received', () => {
    const base = { clinicName: 'Marikina', shortId: 'KK-12' };
    expect(clinicAnswerMessage({ ...base, event: 'expecting' }).title).toBe('Marikina is expecting you · #KK-12');
    const no = clinicAnswerMessage({ ...base, event: 'cannot', note: 'No space in the ward' });
    expect(no.title).toBe('Choose another clinic · #KK-12');
    expect(no.body).toContain('Marikina cannot take the animal now: No space in the ward');
    expect(clinicAnswerMessage({ ...base, event: 'cannot' }).body).toBe('Marikina cannot take the animal now. Pick another clinic.');
    expect(clinicAnswerMessage({ ...base, event: 'received' }).body).toContain('mark it admitted');
  });
});

describe('no lock while a clinic is expecting the volunteer', () => {
  it('the claim has no time limit once the clinic said it is expecting them', () => {
    expect(claimWindowMinutes('hit_and_run', 'on_my_way', true)).toBe(Number.POSITIVE_INFINITY);
    expect(claimWindowMinutes('hit_and_run', 'on_my_way', false)).toBe(15);
    // It cannot be used to skip the one-minute confirm window: no check-in still means one minute
    expect(claimWindowMinutes('hit_and_run', null, true)).toBe(1);
  });

  it('a case does not reopen however long the volunteer takes while a clinic expects them', () => {
    expect(needsRescuer('claimed', minutesAgo(40), 'hit_and_run', 'on_my_way', false)).toBe(true);
    expect(needsRescuer('claimed', minutesAgo(40), 'hit_and_run', 'on_my_way', true)).toBe(false);
    expect(needsRescuer('claimed', minutesAgo(600), 'sick_mange', 'arrived', true)).toBe(false);
    expect(claimLockEndsAt(minutesAgo(40), 'hit_and_run', 'on_my_way', true)).toBe(Number.POSITIVE_INFINITY);
    const standby = [{ volunteerId: 'ana', joinedAt: minutesAgo(5) }];
    expect(claimPhase({ state: 'claimed', claimedAt: minutesAgo(40), type: 'hit_and_run', checkinKind: 'on_my_way', clinicExpecting: true, standby }).phase).toBe('locked');
  });
});
