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

/**
 * Metro Manila driving estimate (D-057), mirrored by public.travel_minutes() in SQL. Not live traffic: roads are about 1.4x the
 * straight line, and speed follows the time of day in Manila.
 */
export const TRAFFIC = {
  roadFactor: 1.4,
  /** Weekdays 7-10 am and 5-8 pm */
  rushKmh: 12,
  /** 10 pm to 5 am */
  nightKmh: 30,
  /** Everything else */
  dayKmh: 18,
  minMinutes: 3,
} as const;

/** The hour (0-23) and ISO weekday (1 = Monday ... 7 = Sunday) in Manila, wherever the device is. */
export function manilaClock(at: Date): { hour: number; isoWeekday: number } {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', hourCycle: 'h23', weekday: 'short' }).formatToParts(at);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0) % 24;
  const day = parts.find((p) => p.type === 'weekday')?.value ?? 'Mon';
  const isoWeekday = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(day) + 1;
  return { hour, isoWeekday };
}

/** Driving speed right now in Manila traffic. */
export function trafficSpeedKmh(at: Date = new Date()): number {
  const { hour, isoWeekday } = manilaClock(at);
  if (isoWeekday <= 5 && ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19))) return TRAFFIC.rushKmh;
  if (hour >= 22 || hour < 5) return TRAFFIC.nightKmh;
  return TRAFFIC.dayKmh;
}

/**
 * Expected minutes to drive a straight-line distance at this time of day, like a ride app's estimate (without live traffic).
 * The database computes the same number when a rescuer tells a clinic they are coming.
 */
export function estimateEtaMinutes(km: number | null | undefined, at: Date = new Date()): number | null {
  if (km == null || !Number.isFinite(km)) return null;
  return Math.max(TRAFFIC.minMinutes, Math.ceil(((km * TRAFFIC.roadFactor) / trafficSpeedKmh(at)) * 60));
}

export type ClinicAnswerEvent = 'expecting' | 'cannot' | 'received';

/** What the rescuer reads (as a push) when the clinic they told answers, or confirms the animal is there. */
export function clinicAnswerMessage(r: { event: ClinicAnswerEvent; clinicName: string; shortId: string; note?: string | null }): {
  title: string;
  body: string;
} {
  const code = `#${r.shortId}`;
  switch (r.event) {
    case 'expecting':
      return { title: `${r.clinicName} is expecting you · ${code}`, body: 'Keep going. They will confirm when the animal arrives.' };
    case 'cannot':
      return {
        title: `Choose another clinic · ${code}`,
        body: `${r.clinicName} cannot take the animal now${r.note ? `: ${r.note}` : ''}. Pick another clinic.`,
      };
    case 'received':
      return { title: `Handed over to ${r.clinicName} · ${code}`, body: 'They confirmed the animal arrived and it is in their care now. Thank you for the rescue!' };
  }
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

/** What the rescuer is told about the arrival hold before telling a clinic. */
export const ARRIVAL_HOLD_NOTE = `If the clinic says it is expecting you, the case is held for you for that long plus ${ESCALATION_CONFIG.arrivalBufferMinutes} minutes to hand it over.`;
