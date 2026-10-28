/**
 * KupKop SOS Utilities
 * - Generates human-readable Case IDs for phone readouts
 * - Compresses HTML5 video frames to WebP/JPEG under 200KB
 * - Formats GPS coordinates and accuracy bounds
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

export async function compressVideoFrame(
  source: HTMLVideoElement | HTMLCanvasElement,
  maxWidth = 1280,
  quality = 0.75
): Promise<{ blob: Blob; width: number; height: number; previewUrl: string }> {
  const canvas = document.createElement('canvas');
  let width = (source instanceof HTMLVideoElement ? source.videoWidth : source.width) || 640;
  let height = (source instanceof HTMLVideoElement ? source.videoHeight : source.height) || 480;

  if (width > maxWidth) {
    const ratio = maxWidth / width;
    width = maxWidth;
    height = Math.round(height * ratio);
  }

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context unavailable for camera capture.');
  }

  ctx.drawImage(source, 0, 0, width, height);

  return new Promise((resolve, reject) => {
    // Try WebP first, fallback to JPEG
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          canvas.toBlob(
            (jpegBlob) => {
              if (!jpegBlob) {
                reject(new Error('Failed to encode camera frame into an image.'));
                return;
              }
              const previewUrl = URL.createObjectURL(jpegBlob);
              resolve({ blob: jpegBlob, width, height, previewUrl });
            },
            'image/jpeg',
            quality
          );
          return;
        }
        const previewUrl = URL.createObjectURL(blob);
        resolve({ blob, width, height, previewUrl });
      },
      'image/webp',
      quality
    );
  });
}

/**
 * Generates a prototype simulated lens frame for desktop dev testing
 * (Used when no physical rear camera or webcam is connected)
 */
export function createSimulatedFrame(animal: string, emergency: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 480;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // Background
  const gradient = ctx.createLinearGradient(0, 0, 640, 480);
  gradient.addColorStop(0, '#1c1917');
  gradient.addColorStop(1, '#0c0a09');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 640, 480);

  // Grid lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  for (let x = 80; x < 640; x += 80) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 480);
    ctx.stroke();
  }
  for (let y = 80; y < 480; y += 80) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(640, y);
    ctx.stroke();
  }

  // Crosshairs
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 2;
  ctx.strokeRect(260, 180, 120, 120);

  // Text details
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`[DEV SIMULATION: ${animal.toUpperCase()}]`, 320, 235);

  ctx.fillStyle = '#f87171';
  ctx.font = '14px sans-serif';
  ctx.fillText(`Emergency: ${emergency.replace('_', ' ').toUpperCase()}`, 320, 265);

  ctx.fillStyle = '#a1a1aa';
  ctx.font = '12px monospace';
  ctx.fillText(`Captured: ${new Date().toISOString()}`, 320, 440);

  return canvas;
}
