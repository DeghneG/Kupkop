import { describe, expect, it } from 'vitest';
import { isOnLiveFeed, needsRescuer } from './escalation';

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

// QA review (D-056): the Feed filter must read a claim the same way every other screen does
describe('live Feed uses the real claim window', () => {
  it('a case a clinic is expecting stays on the Feed while the rescuer is due, however old the report', () => {
    const report = { state: 'claimed', createdAt: hoursAgo(30), claimedAt: minutesAgo(40), type: 'hit_and_run', checkinKind: 'on_my_way' as const };
    // Expected drive 30 min + 15: still due. Before the fix the 15-minute lock was assumed and this rescue vanished
    expect(isOnLiveFeed({ ...report, clinicExpecting: true, etaMinutes: 30 })).toBe(true);
    // Expected drive 10 min + 15 is over: the rescuer went silent, and the report is older than 24 hours
    expect(isOnLiveFeed({ ...report, clinicExpecting: true, etaMinutes: 10 })).toBe(false);
    // Without a clinic expecting, the lock really has run out
    expect(isOnLiveFeed({ ...report, clinicExpecting: false })).toBe(false);
  });

  it('a claim with no check-in lapses after the one-minute window', () => {
    expect(needsRescuer('claimed', minutesAgo(2), 'sick_mange', null)).toBe(true);
    expect(isOnLiveFeed({ state: 'claimed', createdAt: hoursAgo(30), claimedAt: minutesAgo(2), type: 'sick_mange', checkinKind: null })).toBe(false);
  });
});
