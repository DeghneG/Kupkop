/**
 * KupKop Escalation & Claim Engine
 * Strictly aligned with AGENTS.md constants:
 * - Hit-and-Run / Bleeding: Critical at once, widen at 3m, "no responder" at 10m
 * - Fracture / Trapped-Abused: 5m / 15m
 * - Sick / Mange: 15m / 60m
 * - Claim Lock: by severity, 15 / 30 / 60 minutes (D-042). A check-in ("On my way", "Arrived") restarts it.
 * - Facility Inactivity Clock: 14-day inactivity clock (warning at day 11)
 */

export const ESCALATION_CONFIG = {
  critical: {
    types: ['hit_and_run', 'hit-and-run', 'bleeding'],
    widenMinutes: 3,
    alertMinutes: 10,
    claimLockMinutes: 15,
    label: 'Critical Immediate',
  },
  urgent: {
    types: ['fracture', 'trapped_abused', 'trapped'],
    widenMinutes: 5,
    alertMinutes: 15,
    claimLockMinutes: 30,
    label: 'Urgent Priority',
  },
  moderate: {
    types: ['sick_mange', 'mange', 'sick', 'other'],
    widenMinutes: 15,
    alertMinutes: 60,
    claimLockMinutes: 60,
    label: 'Moderate Priority',
  },
  /** Used when the case type is unknown (sample cases) */
  claimLockDurationMinutes: 60,
  /**
   * Right after claiming, the volunteer has this long to tap "On my way" (or "I'm already here"). If they do not, the claim
   * ends and the case is open to everyone again. Once they check in, the severity lock below applies.
   */
  claimConfirmMinutes: 1,
  /** After a lock ends, the first volunteer on standby has this long to claim before everyone can */
  standbyGraceMinutes: 2,
  /** A volunteer can be on standby for this many cases at once */
  maxStandbyCases: 3,
  /** A clinic's "Full" / "Limited" setting is trusted for this long, then shows as unknown */
  availabilityExpiryHours: 12,
  /** How long a case stays on the live Feed (waiting for a rescuer, or resolved) */
  feedWindowHours: 24,
  facilityInactivityWarningDays: 11,
  facilityInactivityMaxDays: 14,
} as const;

export type EscalationTier = 'critical' | 'urgent' | 'moderate';
export type EscalationStage = 'standard' | 'widened' | 'alert';

export interface EscalationStatus {
  tier: EscalationTier;
  stage: EscalationStage;
  elapsedMinutes: number;
  isWidened: boolean;
  isAlert: boolean;
  badgeLabel: string | null;
}

export interface ClaimTimerStatus {
  isClaimed: boolean;
  isExpired: boolean;
  remainingMinutes: number;
  remainingSeconds: number;
  formatted: string;
  percentRemaining: number;
  /** True while a clinic is expecting the volunteer: the claim has no time limit */
  isUnlimited?: boolean;
}

export interface FacilityClockStatus {
  elapsedDays: number;
  daysRemaining: number;
  status: 'active' | 'warning' | 'alert';
  badgeText: string;
}

/**
 * Matches an incident emergency type string to its escalation tier
 */
export function getEscalationTier(rawType?: string | null): EscalationTier {
  if (!rawType) return 'moderate';
  const normalized = rawType.toLowerCase().replace(/[^a-z0-9_-]/g, '_');

  for (const t of ESCALATION_CONFIG.critical.types) {
    if (normalized.includes(t)) return 'critical';
  }
  for (const t of ESCALATION_CONFIG.urgent.types) {
    if (normalized.includes(t)) return 'urgent';
  }
  return 'moderate';
}

/** Claim lock length for a case: shorter for the cases where minutes matter most. */
export function claimLockMinutes(rawType?: string | null): number {
  if (!rawType) return ESCALATION_CONFIG.claimLockDurationMinutes;
  return ESCALATION_CONFIG[getEscalationTier(rawType)].claimLockMinutes;
}

/**
 * How long a claim holds right now. Before the volunteer checks in (checkinKind === null) it is the short confirm window; after
 * "On my way" or "Arrived" it is the severity lock; once a clinic is expecting the volunteer it has no limit (Infinity).
 * A caller that does not know (undefined) gets the severity lock.
 */
export function claimWindowMinutes(
  rawType?: string | null,
  checkinKind?: 'on_my_way' | 'arrived' | null,
  clinicExpecting?: boolean
): number {
  if (checkinKind === null) return ESCALATION_CONFIG.claimConfirmMinutes;
  // A clinic that said it is expecting the volunteer: the volunteer is committed and on the way there, so there is no timer
  if (clinicExpecting) return Number.POSITIVE_INFINITY;
  return claimLockMinutes(rawType);
}

/**
 * Calculates real-time escalation status and dispatch radius broadening
 */
export function calculateEscalation(
  createdAt?: string | Date | number | null,
  rawType?: string | null
): EscalationStatus {
  const tier = getEscalationTier(rawType);
  const config = ESCALATION_CONFIG[tier];

  if (!createdAt) {
    return {
      tier,
      stage: 'standard',
      elapsedMinutes: 0,
      isWidened: false,
      isAlert: false,
      badgeLabel: null,
    };
  }

  const createdMs = new Date(createdAt).getTime();
  const nowMs = Date.now();
  const elapsedMinutes = Math.max(0, Math.floor((nowMs - createdMs) / (1000 * 60)));

  if (elapsedMinutes >= config.alertMinutes) {
    return {
      tier,
      stage: 'alert',
      elapsedMinutes,
      isWidened: true,
      isAlert: true,
      badgeLabel: 'No responder yet',
    };
  }

  if (elapsedMinutes >= config.widenMinutes) {
    return {
      tier,
      stage: 'widened',
      elapsedMinutes,
      isWidened: true,
      isAlert: false,
      badgeLabel: 'Waiting for a rescuer',
    };
  }

  return {
    tier,
    stage: 'standard',
    elapsedMinutes,
    isWidened: false,
    isAlert: false,
    badgeLabel: null,
  };
}

/**
 * Calculates remaining time on a 60-minute volunteer claim lock
 */
export function calculateClaimTimer(
  claimedAt?: string | Date | number | null,
  lockDurationMinutes: number = ESCALATION_CONFIG.claimLockDurationMinutes
): ClaimTimerStatus {
  if (!claimedAt) {
    return {
      isClaimed: false,
      isExpired: false,
      remainingMinutes: 0,
      remainingSeconds: 0,
      formatted: 'Unclaimed',
      percentRemaining: 0,
    };
  }

  // No limit: a clinic is expecting the volunteer
  if (!Number.isFinite(lockDurationMinutes)) {
    return {
      isClaimed: true,
      isExpired: false,
      remainingMinutes: 0,
      remainingSeconds: 0,
      formatted: 'No time limit',
      percentRemaining: 100,
      isUnlimited: true,
    };
  }

  const claimedMs = new Date(claimedAt).getTime();
  const nowMs = Date.now();
  const totalDurationMs = lockDurationMinutes * 60 * 1000;
  const elapsedMs = Math.max(0, nowMs - claimedMs);
  const remainingMs = totalDurationMs - elapsedMs;

  if (remainingMs <= 0) {
    return {
      isClaimed: true,
      isExpired: true,
      remainingMinutes: 0,
      remainingSeconds: 0,
      formatted: 'Claim expired',
      percentRemaining: 0,
    };
  }

  const remainingSecondsTotal = Math.floor(remainingMs / 1000);
  const remainingMinutes = Math.floor(remainingSecondsTotal / 60);
  const remainingSeconds = remainingSecondsTotal % 60;
  const percentRemaining = Math.max(0, Math.min(100, (remainingMs / totalDurationMs) * 100));

  const formatted =
    remainingMinutes > 0
      ? `${remainingMinutes}m ${remainingSeconds}s`
      : `${remainingSeconds}s`;

  return {
    isClaimed: true,
    isExpired: false,
    remainingMinutes,
    remainingSeconds,
    formatted,
    percentRemaining,
  };
}

/**
 * Evaluates the 14-day facility inactivity clock
 */
export function calculateFacilityInactivity(
  lastActiveAt?: string | Date | number | null
): FacilityClockStatus {
  if (!lastActiveAt) {
    return {
      elapsedDays: 0,
      daysRemaining: ESCALATION_CONFIG.facilityInactivityMaxDays,
      status: 'active',
      badgeText: 'Active recently',
    };
  }

  const lastMs = new Date(lastActiveAt).getTime();
  const nowMs = Date.now();
  const elapsedDays = Math.max(0, Math.floor((nowMs - lastMs) / (1000 * 60 * 60 * 24)));
  const daysRemaining = Math.max(0, ESCALATION_CONFIG.facilityInactivityMaxDays - elapsedDays);

  if (elapsedDays >= ESCALATION_CONFIG.facilityInactivityMaxDays) {
    return {
      elapsedDays,
      daysRemaining: 0,
      status: 'alert',
      badgeText: 'Inactivity alert · Welfare check needed',
    };
  }

  if (elapsedDays >= ESCALATION_CONFIG.facilityInactivityWarningDays) {
    return {
      elapsedDays,
      daysRemaining,
      status: 'warning',
      badgeText: `Update due in ${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'}`,
    };
  }

  return {
    elapsedDays,
    daysRemaining,
    status: 'active',
    badgeText: `Day ${elapsedDays + 1} of 14 · Active Care`,
  };
}

/**
 * True when a case is waiting for a rescuer: never claimed, or the 60-minute claim lock ran out.
 * The database keeps an expired claim as 'claimed' until someone claims it again, so screens use this.
 */
export function needsRescuer(
  state: string,
  claimedAt?: string | Date | number | null,
  rawType?: string | null,
  checkinKind?: 'on_my_way' | 'arrived' | null,
  clinicExpecting?: boolean
): boolean {
  return (
    state === 'reported' ||
    (state === 'claimed' && calculateClaimTimer(claimedAt, claimWindowMinutes(rawType, checkinKind, clinicExpecting)).isExpired)
  );
}

/** The moment a claim lock ends, or null when there is no claim. */
export function claimLockEndsAt(
  claimedAt?: string | Date | number | null,
  rawType?: string | null,
  checkinKind?: 'on_my_way' | 'arrived' | null,
  clinicExpecting?: boolean
): number | null {
  if (!claimedAt) return null;
  return new Date(claimedAt).getTime() + claimWindowMinutes(rawType, checkinKind, clinicExpecting) * 60_000;
}

/** How long a case has waited, short enough for a feed row: "7m", "3h", "15d". */
export function formatWaited(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
  return `${Math.floor(minutes / 1440)}d`;
}

/**
 * Whether a case still belongs on the live Feed.
 * - Waiting for a rescuer (never claimed, or the claim lock ran out): 24 hours from the report.
 * - Resolved: 24 hours from when it was resolved.
 * - In care (claimed, admitted, healing): stays while the animal is being looked after, because the
 *   14-day recovery clock and the recovery updates depend on it being seen.
 */
export function isOnLiveFeed(
  report: {
    state: string;
    createdAt?: string | Date | number | null;
    claimedAt?: string | Date | number | null;
    updatedAt?: string | Date | number | null;
    /** Emergency type, so the claim lock is the right length for the case */
    type?: string | null;
  },
  now: number = Date.now()
): boolean {
  const windowMs = ESCALATION_CONFIG.feedWindowHours * 60 * 60 * 1000;
  const within = (time?: string | Date | number | null) => !time || now - new Date(time).getTime() < windowMs;
  if (report.state === 'resolved') return within(report.updatedAt ?? report.createdAt);
  if (needsRescuer(report.state, report.claimedAt, report.type)) return within(report.createdAt);
  return true;
}
