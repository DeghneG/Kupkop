'use client';

import React, { useEffect, useState } from 'react';
import { UserRound } from 'lucide-react';
import { appRpc } from '@/lib/demo/rpc';
import { useDemoMode } from '@/lib/demo/demo';
import LiveTrackMap from '@/components/LiveTrackMap';
import {
  ageLabel,
  arrivalLabel,
  describeDistance,
  isLive,
  parseRescuerInfo,
  type RescuerInfo,
  type TrackPoint,
} from '@/lib/sos/rescuer';

interface RescuerCardProps {
  reportId: string;
  /** Where the volunteer is heading: the animal (reporter) or the clinic (clinic staff). Distance and arrival time are measured to here */
  scene: { lat: number; lng: number };
  /** Who is looking: the person who reported the case, or the clinic that said it is expecting the volunteer */
  perspective?: 'reporter' | 'clinic';
}

const TRAIL_LIMIT = 60;

// For the person who reported the case: a live tracker like a ride or delivery app. Who is coming, how long until they arrive,
// and a small map where their marker moves toward the animal. It appears only after the volunteer taps "On my way" (a case that
// was merely claimed shows nothing here), and never for anyone who is not allowed to see it: the database decides.
export default function RescuerCard({ reportId, scene, perspective = 'reporter' }: RescuerCardProps) {
  const forClinic = perspective === 'clinic';
  const place = forClinic ? 'your clinic' : 'the animal';
  const demoOn = useDemoMode();
  const [info, setInfo] = useState<RescuerInfo | null>(null);
  const [trail, setTrail] = useState<TrackPoint[]>([]);
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // The demo volunteer moves smoothly, so it is read often; real positions arrive every few seconds
  const pollMs = demoOn ? 2000 : 6000;

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data } = await appRpc(forClinic ? 'get_incoming_volunteer' : 'get_rescuer_info', { p_report_id: reportId });
      if (!active) return;
      const next = parseRescuerInfo(data);
      setInfo(next);
      setNow(Date.now());
      const loc = next?.location;
      if (loc) {
        const t = new Date(loc.updatedAt).getTime();
        setTrail((prev) => (prev.length && prev[prev.length - 1].t === t ? prev : [...prev, { lat: loc.lat, lng: loc.lng, t }].slice(-TRAIL_LIMIT)));
      } else if (!next) {
        setTrail([]);
      }
    };
    load();
    const timer = setInterval(load, pollMs);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [reportId, pollMs, forClinic]);

  // Keep "updated 20 s ago" honest between polls
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(tick);
  }, []);

  if (!info) return null;

  const loc = info.location;
  const live = loc ? isLive(loc.updatedAt, now) : false;
  const away = loc ? describeDistance({ lat: loc.lat, lng: loc.lng }, scene) : null;
  const since = info.memberSince ? new Date(info.memberSince).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : null;
  const headline = forClinic
    ? info.arrived
      ? 'The volunteer has arrived'
      : 'A volunteer is bringing an animal'
    : info.arrived
      ? 'Your volunteer has arrived'
      : 'A volunteer is on the way';
  const eta = away ? arrivalLabel(away.km, trail, info.arrived) : null;
  const summary = away
    ? `Map: the volunteer is ${away.distance} ${away.compass} of ${place}. ${eta}.`
    : 'Map: waiting for your volunteer’s location.';

  return (
    <section aria-label="Your volunteer" className="rounded-2xl border border-border bg-surface p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 shrink-0 rounded-full bg-surface-muted border border-border flex items-center justify-center">
          <UserRound className="w-5 h-5 text-fg-muted" aria-hidden="true" />
        </div>
        <div className="min-w-0 space-y-0.5" aria-live="polite">
          <p className="text-[16px] font-semibold text-fg">{headline}</p>
          <p className="text-[14px] text-fg truncate">{info.name}</p>
        </div>
      </div>

      {loc && away ? (
        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[20px] font-bold text-fg leading-tight" aria-live="polite">
              {eta}
            </p>
            <p className="text-[14px] text-fg-muted tabular-nums shrink-0">{info.arrived ? (forClinic ? 'At your clinic' : 'At the animal') : `${away.distance} away`}</p>
          </div>
          <LiveTrackMap scene={scene} trail={trail} arrived={info.arrived} summary={summary} />
          <p className={`text-[12px] ${live ? 'text-healing-fg font-semibold' : 'text-fg-muted'}`}>
            {live ? 'Live' : 'Last seen'} · updated {ageLabel(loc.updatedAt, now)}
          </p>
        </div>
      ) : (
        <p className="text-[14px] text-fg-muted">Waiting for their location. It shows up on its own, so you do not need to refresh.</p>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full min-h-[44px] rounded-xl border border-border bg-surface hover:bg-surface-muted text-fg font-semibold text-[14px] cursor-pointer"
      >
        {open ? 'Hide volunteer details' : 'Volunteer details'}
      </button>

      {open && (
        <div className="space-y-2 border-t border-border pt-3">
          <p className="text-[14px] font-semibold text-fg">{info.name}</p>
          <p className="text-[12px] text-fg-muted">
            Volunteer approved by KupKop
            {since ? ` · member since ${since}` : ''}
            {info.animalsHelped > 0 ? ` · helped ${info.animalsHelped} ${info.animalsHelped === 1 ? 'animal' : 'animals'}` : ''}
          </p>
          <p className="text-[12px] text-fg-muted">
            {forClinic
              ? 'Shared only while they are bringing the animal to your clinic. KupKop does not share their phone number or email.'
              : 'Shared only while they are on your case. KupKop does not share their phone number or email. Meet in a public place and stay with the animal.'}
          </p>
        </div>
      )}
    </section>
  );
}
