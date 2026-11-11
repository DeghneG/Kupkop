'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export type ShareStatus = 'off' | 'sharing' | 'denied' | 'unavailable';

const EVERY_MS = 5000;

/**
 * While `active` (the volunteer holds a live claim), sends the device position to the database every few seconds so the
 * person who reported the case can see where help is. Stops the moment `active` turns false or the screen closes.
 * The database accepts it only from the volunteer who holds the claim, and deletes it when the claim ends.
 */
export function useShareRescuerLocation(reportId: string | null, active: boolean): ShareStatus {
  const [status, setStatus] = useState<ShareStatus>('off');

  useEffect(() => {
    if (!active || !reportId || typeof navigator === 'undefined' || !navigator.geolocation) return;
    const supabase = createClient();
    let last = 0;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setStatus('sharing');
        const now = Date.now();
        if (now - last < EVERY_MS) return;
        last = now;
        supabase
          .rpc('share_rescuer_location', {
            p_report_id: reportId,
            p_latitude: pos.coords.latitude,
            p_longitude: pos.coords.longitude,
            p_accuracy_m: Math.round(pos.coords.accuracy),
          })
          .then(({ error }) => error && console.warn('Could not share location:', error.message));
      },
      (err) => setStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable'),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [reportId, active]);

  return active ? status : 'off';
}
