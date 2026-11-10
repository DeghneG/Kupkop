/**
 * Standby: volunteers who say "I'm available" on a case someone else has claimed. Pure.
 * When the claim lock ends (or the rescuer releases), the first volunteer in line gets a short head start
 * (ESCALATION_CONFIG.standbyGraceMinutes) before every volunteer can claim. The database enforces the same rule.
 */
import { claimLockEndsAt, ESCALATION_CONFIG } from './escalation';

export interface StandbyEntry {
  volunteerId: string;
  joinedAt: string | Date | number;
}

/** Everyone on standby, first come first served. */
export function standbyQueue(entries: StandbyEntry[]): StandbyEntry[] {
  return [...entries].sort((a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime());
}

export type ClaimPhase =
  | { phase: 'locked'; endsAt: number }
  | { phase: 'reserved'; firstInLine: string; endsAt: number }
  | { phase: 'open' };

/**
 * Who may claim right now.
 * - locked: someone holds the claim and the lock is running.
 * - reserved: the case is open again, but the first volunteer on standby still has the grace window.
 * - open: any volunteer may claim.
 * `openedAt` is when the case became open (lock end, or the release time); `claimedAt` is for an active claim.
 */
export function claimPhase(args: {
  state: string;
  claimedAt?: string | Date | number | null;
  type?: string | null;
  /** When a released case went back to open (its updated_at) */
  releasedAt?: string | Date | number | null;
  standby: StandbyEntry[];
  now?: number;
}): ClaimPhase {
  const now = args.now ?? Date.now();
  let openedAt: number;
  if (args.state === 'claimed') {
    const endsAt = claimLockEndsAt(args.claimedAt, args.type);
    if (endsAt != null && now < endsAt) return { phase: 'locked', endsAt };
    openedAt = endsAt ?? now;
  } else if (args.state === 'reported') {
    openedAt = args.releasedAt ? new Date(args.releasedAt).getTime() : 0;
  } else {
    return { phase: 'open' };
  }
  const first = standbyQueue(args.standby)[0];
  const graceEnds = openedAt + ESCALATION_CONFIG.standbyGraceMinutes * 60_000;
  if (first && now < graceEnds) return { phase: 'reserved', firstInLine: first.volunteerId, endsAt: graceEnds };
  return { phase: 'open' };
}

/** Whether this volunteer may press Claim right now. */
export function canClaimNow(phase: ClaimPhase, volunteerId: string | null | undefined): boolean {
  if (phase.phase === 'locked') return false;
  if (phase.phase === 'reserved') return !!volunteerId && phase.firstInLine === volunteerId;
  return true;
}

/** A volunteer's place in line (1 = first), or null when not on standby. */
export function standbyPosition(entries: StandbyEntry[], volunteerId: string | null | undefined): number | null {
  if (!volunteerId) return null;
  const index = standbyQueue(entries).findIndex((e) => e.volunteerId === volunteerId);
  return index === -1 ? null : index + 1;
}
