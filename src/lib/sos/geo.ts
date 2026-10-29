/**
 * Pure SOS helpers shared by the web app and the mobile app (no DOM or React Native imports).
 * Case IDs for phone readouts, coordinate formatting, distance and bearing.
 */

const CASE_ID_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Excludes 0, 1, I, O, L to prevent confusion

export function generateCaseId(): string {
  let result = 'KK-';
  for (let i = 0; i < 4; i++) {
    const randomIndex = Math.floor(Math.random() * CASE_ID_ALPHABET.length);
    result += CASE_ID_ALPHABET[randomIndex];
  }
  return result;
}

export function formatCoordinates(lat: number, lng: number): string {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lngDir = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}° ${latDir}, ${Math.abs(lng).toFixed(4)}° ${lngDir}`;
}

export interface LatLng {
  lat: number;
  lng: number;
}

/** Great-circle distance in kilometres. */
export function distanceKm(a: LatLng, b: LatLng): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export function formatDistance(km: number): string {
  if (km < 0.1) return 'Here';
  if (km < 1) return `${Math.round(km * 10) * 100} m`;
  return `${km.toFixed(1)} km`;
}

/** Eight-way arrow pointing from `from` toward `to`. */
export function getDirectionalBearing(from: LatLng, to: LatLng): string {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const y = Math.sin(rad(to.lng - from.lng)) * Math.cos(rad(to.lat));
  const x =
    Math.cos(rad(from.lat)) * Math.sin(rad(to.lat)) -
    Math.sin(rad(from.lat)) * Math.cos(rad(to.lat)) * Math.cos(rad(to.lng - from.lng));
  const degrees = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  const arrows = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];
  return arrows[Math.round(degrees / 45) % 8];
}
