/**
 * What the reporter sees of the volunteer who claimed their case. Pure logic, shared by the web app, the demo and tests.
 * The data comes from get_rescuer_info() in SQL: a name, how many animals they have helped, and a recent position.
 */
import { distanceKm, formatDistance, getDirectionalBearing, type LatLng } from './geo';

export interface RescuerInfo {
  /** True once the volunteer tapped "I've arrived"; false while they are on the way */
  arrived: boolean;
  name: string;
  /** 'volunteer' or 'admin' */
  role: string;
  memberSince: string | null;
  animalsHelped: number;
  location: { lat: number; lng: number; accuracyM: number | null; updatedAt: string } | null;
}

/** The RPC answer as a RescuerInfo, or null when the case is not claimed or the caller may not see it. */
export function parseRescuerInfo(data: Record<string, unknown> | null | undefined): RescuerInfo | null {
  if (!data || data.success !== true || data.claimed !== true) return null;
  const loc = data.location as { latitude?: number; longitude?: number; accuracy_m?: number | null; updated_at?: string } | null | undefined;
  const hasLoc = !!loc && Number.isFinite(loc.latitude) && Number.isFinite(loc.longitude) && !!loc.updated_at;
  return {
    arrived: data.arrived === true,
    name: typeof data.name === 'string' && data.name.trim() ? data.name.trim() : 'A KupKop volunteer',
    role: typeof data.role === 'string' ? data.role : 'volunteer',
    memberSince: typeof data.member_since === 'string' ? data.member_since : null,
    animalsHelped: Number(data.animals_helped) || 0,
    location: hasLoc ? { lat: loc!.latitude as number, lng: loc!.longitude as number, accuracyM: loc!.accuracy_m ?? null, updatedAt: loc!.updated_at as string } : null,
  };
}

/** "just now", "20 s ago", "3 min ago" */
export function ageLabel(iso: string, now: number = Date.now()): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 10) return 'just now';
  if (s < 60) return `${s} s ago`;
  return `${Math.round(s / 60)} min ago`;
}

/** After this long without an update the position is shown as "last seen", not as live */
export const LIVE_WITHIN_SECONDS = 60;

export function isLive(updatedAt: string, now: number = Date.now()): boolean {
  return (now - new Date(updatedAt).getTime()) / 1000 <= LIVE_WITHIN_SECONDS;
}

const COMPASS: Record<string, string> = { '↑': 'north', '↗': 'northeast', '→': 'east', '↘': 'southeast', '↓': 'south', '↙': 'southwest', '←': 'west', '↖': 'northwest' };

/** How far the volunteer is from a place (the animal, or the reporter) and in which direction, in words. */
export function describeDistance(volunteer: LatLng, place: LatLng): { distance: string; arrow: string; compass: string; km: number } {
  const km = distanceKm(volunteer, place);
  const arrow = getDirectionalBearing(place, volunteer);
  return { km, distance: formatDistance(km), arrow, compass: COMPASS[arrow] ?? '' };
}

export interface ReporterStatusInput {
  state: 'reported' | 'claimed' | 'admitted' | 'healing' | 'resolved';
  checkinKind?: 'on_my_way' | 'arrived' | null;
  /** The clinic the volunteer told, while the case is still with the volunteer */
  headsUpClinicName?: string | null;
  headsUpResponse?: 'expecting' | 'cannot' | null;
  clinicReceived?: boolean;
  /** The clinic caring for the animal once it is admitted */
  clinicName?: string | null;
}

/**
 * One plain sentence for the person who reported the case: the latest step, newest first.
 * The steps are the same ones they are notified about: on the way, arrived, told a clinic, admitted.
 */
export function reporterStatus(c: ReporterStatusInput): string {
  const clinic = c.clinicName ?? 'a clinic';
  switch (c.state) {
    case 'reported':
      return 'Waiting for a volunteer to take it.';
    case 'admitted':
      return `Admitted to ${clinic}.`;
    case 'healing':
      return `Healing in ${clinic}’s care.`;
    case 'resolved':
      return 'Recovered. Thank you for reporting it.';
    case 'claimed': {
      const told = c.headsUpClinicName && c.headsUpResponse !== 'cannot' ? c.headsUpClinicName : null;
      if (told && c.clinicReceived) return `${told} has the animal. Your volunteer is finishing the handover.`;
      if (told) return `Your volunteer is taking it to ${told}${c.headsUpResponse === 'expecting' ? ', and they are expecting it' : ''}.`;
      if (c.checkinKind === 'arrived') return 'Your volunteer has arrived and is with the animal.';
      if (c.checkinKind === 'on_my_way') return 'Your volunteer is on the way.';
      return 'A volunteer took it and will head to the animal.';
    }
  }
}

// ---- Live tracking view (like a ride or delivery app): a small map, a moving marker, an arrival time ---------------------

export interface TrackPoint extends LatLng {
  /** When this position was reported, in milliseconds */
  t: number;
}

/**
 * Fits points into a width x height box (equirectangular, so distances keep their shape at city scale) with padding.
 * Returns each point's x/y, and the same for any extra points that were not used to size the box.
 */
export function projectToBox(
  points: LatLng[],
  width: number,
  height: number,
  padFraction = 0.2
): { xy: { x: number; y: number }[]; project: (p: LatLng) => { x: number; y: number } } {
  const minSpan = 0.002; // about 200 m, so one dot or two close dots still get a sensible map
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const k = Math.cos((midLat * Math.PI) / 180);
  const spanLat = Math.max(minSpan, Math.max(...lats) - Math.min(...lats));
  const spanLng = Math.max(minSpan, (Math.max(...lngs) - Math.min(...lngs)) * k);
  const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
  const scale = Math.min((width * (1 - padFraction * 2)) / spanLng, (height * (1 - padFraction * 2)) / spanLat);
  const project = (p: LatLng) => ({
    x: width / 2 + (p.lng - centerLng) * k * scale,
    y: height / 2 - (p.lat - centerLat) * scale,
  });
  return { xy: points.map(project), project };
}

/** How fast the volunteer is really moving, from their recent positions; null when there is not enough to tell. */
export function speedKmh(trail: TrackPoint[]): number | null {
  const recent = trail.slice(-6);
  if (recent.length < 2) return null;
  const first = recent[0];
  const last = recent[recent.length - 1];
  const hours = (last.t - first.t) / 3_600_000;
  if (hours <= 0) return null;
  const v = distanceKm(first, last) / hours;
  return Number.isFinite(v) ? v : null;
}

/**
 * Minutes until arrival. Uses the observed speed when it is believable (so the time shrinks as they get close, like a ride
 * app), otherwise a city-traffic guess of 20 km/h. At least 1 minute while they are still on the way.
 */
export function arrivalMinutes(remainingKm: number, trail: TrackPoint[]): number {
  const seen = speedKmh(trail);
  const v = seen != null && seen >= 5 && seen <= 80 ? seen : 20;
  return Math.max(1, Math.round((remainingKm / v) * 60));
}

/** The words for the big line of the tracker. */
export function arrivalLabel(remainingKm: number, trail: TrackPoint[], arrived: boolean): string {
  if (arrived || remainingKm < 0.05) return 'Your volunteer is here';
  const m = arrivalMinutes(remainingKm, trail);
  return m <= 1 ? 'Arriving in about 1 min' : `Arriving in about ${m} min`;
}
