import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';

export type Coords = { lat: number; lng: number; accuracy: number };
export type LocationStatus = 'idle' | 'requesting' | 'locked' | 'denied' | 'off' | 'searching';

type Options = {
  /** Ask for permission on mount (SOS). The feed waits for a tap instead. */
  autoStart?: boolean;
  /** Keep refining with GPS while the screen is open (SOS) */
  watch?: boolean;
};

// Quick pin from the phone's last fix (under a minute old), then GPS refines it.
// Same approach as the web SOS fix, which failed indoors when it insisted on a fresh precise fix.
export function useDeviceLocation({ autoStart = false, watch = false }: Options = {}) {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [status, setStatus] = useState<LocationStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const subRef = useRef<Location.LocationSubscription | null>(null);
  const hasFix = useRef(false);

  const accept = useCallback((pos: Location.LocationObject) => {
    const acc = Math.round(pos.coords.accuracy ?? 9999);
    hasFix.current = true;
    // Keep the sharper fix if a rougher one arrives late
    setCoords((prev) =>
      prev && acc > prev.accuracy * 2 ? prev : { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: acc }
    );
    setStatus('locked');
    setError(null);
  }, []);

  const start = useCallback(async () => {
    if (!hasFix.current) setStatus('requesting');
    setError(null);

    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') {
      setStatus('denied');
      setError('Location permission is off for KupKop. Turn it on in your phone settings.');
      return;
    }
    if (!(await Location.hasServicesEnabledAsync())) {
      setStatus('off');
      setError('Your phone location is off. Turn on Location, then try again.');
      return;
    }

    if (!hasFix.current) setStatus('searching');

    const last = await Location.getLastKnownPositionAsync({ maxAge: 60_000 }).catch(() => null);
    if (last) accept(last);

    if (watch) {
      subRef.current?.remove();
      subRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 5 },
        accept,
        () => {
          if (!hasFix.current) setError('Still searching for GPS. Open sky or a window helps.');
        }
      );
    } else {
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
        .then(accept)
        .catch(() => {
          if (!hasFix.current) {
            setStatus('searching');
            setError('Could not get a location fix yet.');
          }
        });
    }
  }, [accept, watch]);

  useEffect(() => {
    // Deferred so the permission prompt never runs during the first render
    if (autoStart) {
      const t = setTimeout(start, 0);
      return () => clearTimeout(t);
    }
  }, [autoStart, start]);

  useEffect(() => () => subRef.current?.remove(), []);

  return { coords, status, error, start };
}
