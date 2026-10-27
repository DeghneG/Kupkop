/**
 * KupKop Escalation & Claim Engine
 * Strictly aligned with AGENTS.md constants:
 * - Hit-and-Run / Bleeding: Critical at once, widen at 3m, "no responder" at 10m
 * - Fracture / Trapped-Abused: 5m / 15m
 * - Sick / Mange: 15m / 60m
 * - Claim Lock: 60 minutes
 * - Facility Inactivity Clock: 14-day inactivity clock (warning at day 11)
 */

export const ESCALATION_CONFIG = {
  critical: {
    types: ['hit_and_run', 'hit-and-run', 'bleeding'],
    widenMinutes: 3,
    alertMinutes: 10,
    label: 'Critical Immediate',
  },
  urgent: {
    types: ['fracture', 'trapped_abused', 'trapped'],
    widenMinutes: 5,
    alertMinutes: 15,
    label: 'Urgent Priority',
  },
  moderate: {
    types: ['sick_mange', 'mange', 'sick', 'other'],
    widenMinutes: 15,
    alertMinutes: 60,
    label: 'Moderate Priority',
  },
  claimLockDurationMinutes: 60,
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
      badgeLabel: `No responder · +${elapsedMinutes}m`,
    };
  }

  if (elapsedMinutes >= config.widenMinutes) {
    return {
      tier,
      stage: 'widened',
      elapsedMinutes,
      isWidened: true,
      isAlert: false,
      badgeLabel: `Widened radius · +${elapsedMinutes}m`,
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
