/**
 * Clinic availability and which clinic a rescuer should be sent to. Pure: no DOM, no React Native.
 *
 * A clinic sets its own status: open, limited (emergencies only) or full. The status is trusted for
 * ESCALATION_CONFIG.availabilityExpiryHours; after that it shows as unknown, so a clinic that forgot to switch
 * back is never blocked for long. Availability is reported by the clinic, never verified.
 */
import { ESCALATION_CONFIG } from './escalation';
import { distanceKm, type LatLng } from './geo';

export type ClinicStatus = 'open' | 'limited' | 'full';
export type EffectiveAvailability = ClinicStatus | 'unknown';

export const CLINIC_STATUS_LABELS: Record<EffectiveAvailability, string> = {
  open: 'Open',
  limited: 'Emergencies only',
  full: 'Full',
  unknown: 'Status not reported',
};

/** The status that counts right now: a stale or missing one is "unknown". */
export function effectiveAvailability(
  status: string | null | undefined,
  setAt: string | Date | number | null | undefined,
  now: number = Date.now()
): EffectiveAvailability {
  if (status !== 'open' && status !== 'limited' && status !== 'full') return 'unknown';
  if (!setAt) return 'unknown';
  const ageMs = now - new Date(setAt).getTime();
  return ageMs < ESCALATION_CONFIG.availabilityExpiryHours * 3_600_000 ? status : 'unknown';
}

/** "Full, updated 40 min ago" style text; empty when nothing was ever reported. */
export function availabilityNote(
  status: string | null | undefined,
  setAt: string | Date | number | null | undefined,
  now: number = Date.now()
): string {
  const effective = effectiveAvailability(status, setAt, now);
  if (!setAt) return CLINIC_STATUS_LABELS.unknown;
  const minutes = Math.max(0, Math.floor((now - new Date(setAt).getTime()) / 60_000));
  const ago = minutes < 60 ? `${minutes} min ago` : minutes < 1440 ? `${Math.floor(minutes / 60)} h ago` : `${Math.floor(minutes / 1440)} d ago`;
  if (effective === 'unknown') return `Status not reported (last set ${ago})`;
  return `${CLINIC_STATUS_LABELS[effective]}, updated ${ago}`;
}

export interface ClinicForRouting {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  availability?: string | null;
  availabilitySetAt?: string | null;
}

export interface RankedClinic<T extends ClinicForRouting> {
  clinic: T;
  availability: EffectiveAvailability;
  distanceKm: number | null;
  /** False only for a clinic that reported Full */
  usable: boolean;
  /** The nearest usable clinic: where the app sends the rescuer by default */
  suggested: boolean;
}

/**
 * Nearest usable clinic first, Full clinics last (still listed, greyed out). With no position, order is by name.
 * Only one clinic is "suggested". Paused clinics are never passed in: the caller lists Listed clinics only.
 */
export function rankClinics<T extends ClinicForRouting>(
  clinics: T[],
  near: LatLng | null | undefined,
  now: number = Date.now()
): RankedClinic<T>[] {
  const ranked = clinics.map((clinic) => {
    const availability = effectiveAvailability(clinic.availability, clinic.availabilitySetAt, now);
    return {
      clinic,
      availability,
      distanceKm: near ? distanceKm(near, { lat: clinic.latitude, lng: clinic.longitude }) : null,
      usable: availability !== 'full',
      suggested: false,
    };
  });
  ranked.sort(
    (a, b) =>
      Number(b.usable) - Number(a.usable) ||
      (a.distanceKm ?? 0) - (b.distanceKm ?? 0) ||
      a.clinic.name.localeCompare(b.clinic.name)
  );
  if (ranked[0]?.usable) ranked[0].suggested = true;
  return ranked;
}

/** Rough minutes to drive a given distance in city traffic (about 20 km/h), at least 1. */
export function estimateEtaMinutes(km: number | null | undefined): number | null {
  if (km == null || !Number.isFinite(km)) return null;
  return Math.max(1, Math.round((km / 20) * 60));
}

/** What a clinic reads when a rescuer is bringing an animal. */
export function headsUpMessage(r: { animal: string; type: string; etaMinutes: number | null; shortId: string }): {
  title: string;
  body: string;
} {
  const eta = r.etaMinutes ? `about ${r.etaMinutes} min away` : 'on the way';
  return {
    title: `Animal coming in · #${r.shortId}`,
    body: `A rescuer is bringing a ${r.animal.toLowerCase()}. ${r.type}, ${eta}. Tap to say you are expecting it, or that you cannot take it now.`,
  };
}
