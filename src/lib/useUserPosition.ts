'use client';

import { useCallback, useEffect, useState } from 'react';
import type { LatLng } from '@/lib/sos/utils';

export type LocationStatus = 'unknown' | 'off' | 'requesting' | 'on' | 'denied' | 'unsupported';

const POSITION_OPTIONS: PositionOptions = { maximumAge: 60_000, timeout: 8_000 };

/**
 * The device position plus a way to ask for it. On mount it only reads GPS when the
 * browser already has location permission (granted on the SOS screen), so opening
 * Home never triggers a permission prompt. `request()` prompts, and must only be
 * called from a user tap.
 */
export function useLocation(): { position: LatLng | null; status: LocationStatus; request: () => void } {
  const [position, setPosition] = useState<LatLng | null>(null);
  const [status, setStatus] = useState<LocationStatus>('unknown');

  useEffect(() => {
    let active = true;

    const permissionState: Promise<PermissionState | 'unsupported'> = !('geolocation' in navigator)
      ? Promise.resolve('unsupported')
      : navigator.permissions
        ? navigator.permissions.query({ name: 'geolocation' }).then((permission) => permission.state)
        : Promise.resolve('prompt');

    permissionState
      .then((state) => {
        if (!active) return;
        if (state === 'unsupported') return setStatus('unsupported');
        if (state === 'denied') return setStatus('denied');
        if (state !== 'granted') return setStatus('off');
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (!active) return;
            setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            setStatus('on');
          },
          () => active && setStatus('off'),
          POSITION_OPTIONS
        );
      })
      .catch(() => active && setStatus('off'));

    return () => {
      active = false;
    };
  }, []);

  const request = useCallback(() => {
    if (!('geolocation' in navigator)) return;
    setStatus('requesting');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setStatus('on');
      },
      (err) => setStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'off'),
      POSITION_OPTIONS
    );
  }, []);

  return { position, status, request };
}

/** The device position, or null when unknown. Never prompts; callers hide distance when null. */
export function useUserPosition(): LatLng | null {
  return useLocation().position;
}
