'use client';

import React, { useEffect, useState } from 'react';
import { BellRing, MapPin } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import InlineError from '@/components/InlineError';

const VAPID_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const RADII = [1, 3, 5, 10];

type PushState = 'loading' | 'unsupported' | 'unconfigured' | 'denied' | 'off' | 'on';

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

const isIOS = () => typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent);
const isStandalone = () => typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches;

// Alerts on this device for new SOS reports (responders) and clinic events (clinic staff).
// Volunteers and admins also pick an area: reports inside it alert them at once, the rest only
// once the case has waited past its widen time.
export default function AlertSettings({ userId, showArea }: { userId: string; showArea: boolean }) {
  const [push, setPush] = useState<PushState>('loading');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [area, setArea] = useState<{ latitude: number; longitude: number; radius_km: number } | null>(null);
  const [radius, setRadius] = useState(3);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        if (active) setPush('unsupported');
        return;
      }
      if (!VAPID_KEY) {
        if (active) setPush('unconfigured');
        return;
      }
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
      const sub = await reg.pushManager.getSubscription();
      if (!active) return;
      setPush(Notification.permission === 'denied' ? 'denied' : sub ? 'on' : 'off');
    })().catch(() => active && setPush('unsupported'));

    if (showArea) {
      createClient()
        .from('responder_alert_prefs')
        .select('latitude,longitude,radius_km')
        .eq('user_id', userId)
        .maybeSingle()
        .then(({ data }) => {
          if (!active || !data) return;
          setArea({ ...data, radius_km: Number(data.radius_km) });
          setRadius(Number(data.radius_km));
        });
    }
    return () => {
      active = false;
    };
  }, [userId, showArea]);

  const turnOn = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setPush(permission === 'denied' ? 'denied' : 'off');
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_KEY!),
      });
      const json = sub.toJSON();
      const { data, error } = await createClient().rpc('save_web_push_subscription', {
        p_endpoint: sub.endpoint,
        p_p256dh: json.keys?.p256dh,
        p_auth: json.keys?.auth,
      });
      if (error || !data?.success) throw new Error(data?.error || error?.message);
      setPush('on');
      setMessage({ ok: true, text: 'Alerts are on for this device.' });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error && e.message ? e.message : 'Could not turn on alerts.' });
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async () => {
    setBusy(true);
    setMessage(null);
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await createClient().from('web_push_subscriptions').delete().eq('endpoint', sub.endpoint);
      await sub.unsubscribe();
    }
    setPush('off');
    setBusy(false);
  };

  const sendTest = async () => {
    setBusy(true);
    setMessage(null);
    const res = await fetch('/api/push/test', { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    setMessage(
      res.ok
        ? { ok: data.delivered > 0, text: data.delivered > 0 ? 'Test alert sent. It should appear in a few seconds.' : 'No device received it. Turn alerts off and on again.' }
        : { ok: false, text: data.error || 'Could not send a test alert.' }
    );
  };

  const saveArea = () => {
    if (!navigator.geolocation) {
      setMessage({ ok: false, text: "This browser can't share location." });
      return;
    }
    setBusy(true);
    setMessage(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const row = { user_id: userId, latitude: pos.coords.latitude, longitude: pos.coords.longitude, radius_km: radius, updated_at: new Date().toISOString() };
        const { error } = await createClient().from('responder_alert_prefs').upsert(row);
        setBusy(false);
        if (error) {
          setMessage({ ok: false, text: 'Could not save your area. Please try again.' });
          return;
        }
        setArea(row);
        setMessage({ ok: true, text: `Area saved: ${radius} km around where you are now.` });
      },
      () => {
        setBusy(false);
        setMessage({ ok: false, text: 'Location is off. Allow it for this site, then try again.' });
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
    );
  };

  const button =
    'min-h-[44px] px-4 rounded-xl border border-border bg-surface hover:bg-surface-muted text-fg font-semibold text-[14px] cursor-pointer disabled:opacity-50';

  return (
    <section aria-labelledby="settings-alerts-heading" className="bg-surface -mx-4 px-4 py-4 border-y border-border space-y-3">
      <div className="flex items-center gap-2">
        <BellRing className="w-4 h-4 text-fg-muted shrink-0" aria-hidden="true" />
        <h2 id="settings-alerts-heading" className="text-[12px] font-semibold text-fg-muted">
          Alerts on this device
        </h2>
      </div>

      {push === 'loading' ? (
        <p className="text-[14px] text-fg-muted">Checking…</p>
      ) : push === 'unsupported' ? (
        <p className="text-[14px] text-fg-muted">
          {isIOS() && !isStandalone()
            ? 'On iPhone, alerts work after you add KupKop to your Home Screen: tap Share, then "Add to Home Screen", and open it from there.'
            : 'This browser cannot show alerts. Use Chrome on Android, or KupKop added to the Home Screen on iPhone.'}
        </p>
      ) : push === 'unconfigured' ? (
        <p className="text-[14px] text-fg-muted">Alerts are not set up on this site yet.</p>
      ) : push === 'denied' ? (
        <p className="text-[14px] text-fg-muted">
          Notifications are blocked for this site. Allow them in your browser&apos;s site settings, then reload.
        </p>
      ) : (
        <div className="space-y-2">
          <p className="text-[14px] text-fg-muted">
            {push === 'on'
              ? 'On. You get alerts even when KupKop is closed.'
              : 'Get an alert when someone near you needs a rescuer, even when KupKop is closed.'}
          </p>
          <div className="flex flex-wrap gap-2">
            {push === 'on' ? (
              <>
                <button type="button" onClick={sendTest} disabled={busy} className={button}>
                  Send me a test alert
                </button>
                <button type="button" onClick={turnOff} disabled={busy} className={button}>
                  Turn off
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={turnOn}
                disabled={busy}
                className="w-full min-h-[48px] rounded-xl bg-action text-action-fg font-semibold text-[14px] cursor-pointer disabled:opacity-50"
              >
                {busy ? 'Turning on…' : 'Turn on alerts'}
              </button>
            )}
          </div>
        </div>
      )}

      {showArea && (
        <div className="pt-3 border-t border-border space-y-2">
          <p className="text-[14px] font-semibold text-fg flex items-center gap-2">
            <MapPin className="w-4 h-4 text-fg-muted" aria-hidden="true" />
            Your rescue area
          </p>
          <p className="text-[12px] text-fg-muted">
            {area
              ? `${area.radius_km} km around the spot you saved. Reports inside it alert you at once; others only if no one has claimed them in time.`
              : 'Not set. You only get alerts for cases that have waited past their widen time.'}
          </p>
          <div role="radiogroup" aria-label="Area size" className="grid grid-cols-4 gap-2">
            {RADII.map((km) => (
              <button
                key={km}
                type="button"
                role="radio"
                aria-checked={radius === km}
                onClick={() => setRadius(km)}
                className={`min-h-[44px] rounded-xl border text-[14px] font-semibold cursor-pointer ${
                  radius === km ? 'border-fg text-fg bg-surface-muted' : 'border-border text-fg-muted bg-surface'
                }`}
              >
                {km} km
              </button>
            ))}
          </div>
          <button type="button" onClick={saveArea} disabled={busy} className={`w-full ${button}`}>
            {area ? 'Update to where I am now' : 'Use where I am now'}
          </button>
        </div>
      )}

      {message &&
        (message.ok ? (
          <p role="status" className="text-[14px] text-healing-fg">
            {message.text}
          </p>
        ) : (
          <InlineError>{message.text}</InlineError>
        ))}
    </section>
  );
}
