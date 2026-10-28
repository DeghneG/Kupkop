'use client';

import { useEffect, useState } from 'react';
import type { LatLng } from '@/lib/sos/utils';

/**
 * The device position, or null when unknown. It only reads GPS when the browser
 * already has location permission (granted on the SOS screen), so opening Home
 * never triggers a permission prompt. Callers hide distance when this is null.
 */
export function useUserPosition(): LatLng | null {
  const [position, setPosition] = useState<LatLng | null>(null);

  useEffect(() => {
    if (!('geolocation' in navigator) || !navigator.permissions) return;
    let active = true;

    navigator.permissions
      .query({ name: 'geolocation' })
      .then((status) => {
        if (!active || status.state !== 'granted') return;
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (active) setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          },
          () => {},
          { maximumAge: 60_000, timeout: 8_000 }
        );
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  return position;
}
