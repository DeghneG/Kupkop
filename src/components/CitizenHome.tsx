'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Camera } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { DEMO_CITIZEN, useDemoData, useDemoMode } from '@/lib/demo/demo';
import { animalLabel, emergencyLabel, formatWhen } from '@/lib/sos/labels';
import { reporterStatus } from '@/lib/sos/rescuer';
import { needsRescuer } from '@/lib/sos/escalation';
import AccountButton from '@/components/AccountButton';
import RescuerCard from '@/components/RescuerCard';
import StageWeave from '@/components/StageWeave';
import Wordmark from '@/components/Wordmark';
import { KupkopMark } from '@/components/icons/TriageGlyph';

type CaseState = 'reported' | 'claimed' | 'admitted' | 'healing' | 'resolved';

interface MyReport {
  id: string;
  shortId: string;
  animal: string;
  type: string;
  state: CaseState;
  location: string;
  latitude: number;
  longitude: number;
  createdAt: string;
  animalName: string | null;
  /** One plain sentence about the latest step */
  status: string;
}

type Row = {
  id: string;
  short_id: string;
  animal_type: string | null;
  animal_other?: string | null;
  emergency_type: string | null;
  state: CaseState;
  location_name: string | null;
  latitude: number;
  longitude: number;
  created_at: string;
  animal_name?: string | null;
  hidden_at?: string | null;
  facilities?: { name: string } | null;
  claimed_at?: string | null;
  checkin_kind?: 'on_my_way' | 'arrived' | null;
  heads_up_facility_id?: string | null;
  heads_up_response?: 'expecting' | 'cannot' | null;
  heads_up_eta_minutes?: number | null;
  clinic_received_at?: string | null;
  facility_id?: string | null;
};

const POLL_MS = 20_000;

function timeAgo(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  return hr < 24 ? `${hr}h ago` : `${Math.floor(hr / 24)}d ago`;
}

// The citizen's own dashboard: what they reported and where each case stands. The rescuer's Feed is a different job
// (find a case, claim it), so a citizen starts here instead and can still look at nearby cases.
export default function CitizenHome({ userId, onSeeNearby }: { userId: string | null; onSeeNearby: () => void }) {
  const demoOn = useDemoMode();
  const demo = useDemoData();
  const [fetched, setFetched] = useState<MyReport[] | null>(null);
  const [failed, setFailed] = useState(false);
  // A claim the volunteer never confirmed lapses by itself after a minute: re-check the clock every few seconds
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((n) => n + 1), 10_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (demoOn || !userId) return;
    let active = true;
    const load = async () => {
      const { data, error } = await createClient()
        .from('sos_reports')
        .select('*,facilities(name)')
        .eq('reporter_id', userId)
        .order('created_at', { ascending: false })
        .limit(30);
      if (!active) return;
      if (error) {
        setFailed(true);
        return;
      }
      setFailed(false);
      const rows = ((data ?? []) as unknown as Row[]).filter((r) => !r.hidden_at);
      // The clinic a volunteer told is a plain column, so its name is read apart (clinic names are public)
      const ids = [...new Set(rows.map((r) => r.heads_up_facility_id).filter((id): id is string => !!id))];
      const names = new Map<string, string>();
      if (ids.length > 0) {
        const { data: clinics } = await createClient().from('facilities').select('id,name').in('id', ids);
        for (const c of (clinics ?? []) as { id: string; name: string }[]) names.set(c.id, c.name);
      }
      if (!active) return;
      setFetched(rows.map((r) => toReport(r, r.facilities?.name ?? null, r.heads_up_facility_id ? (names.get(r.heads_up_facility_id) ?? null) : null)));
    };
    load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [demoOn, userId]);

  const reports: MyReport[] | null = demoOn
    ? demo.reports
        .filter((r) => r.reporter_id === DEMO_CITIZEN && !r.hidden_at)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map((r) =>
          toReport(
            r as unknown as Row,
            demo.clinics.find((c) => c.id === r.facility_id)?.name ?? null,
            demo.clinics.find((c) => c.id === r.heads_up_facility_id)?.name ?? null
          )
        )
    : fetched;

  const open = (reports ?? []).filter((r) => r.state !== 'resolved');
  const done = (reports ?? []).filter((r) => r.state === 'resolved');

  return (
    <div className="flex flex-col flex-1 pb-6">
      <div className="bg-shell text-shell-fg">
        <header className="flex items-center justify-between gap-3 px-4 pt-3 pb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-shell-fg flex items-center justify-center shrink-0">
              <KupkopMark size={26} />
            </div>
            <div className="min-w-0">
              <h1 className="leading-none">
                <Wordmark onShell className="text-[22px]" />
              </h1>
              <p className="text-[12px] text-shell-muted mt-1 truncate">Your reports</p>
            </div>
          </div>
          <AccountButton />
        </header>
      </div>

      <div className="px-4 pt-4 space-y-5">
        <Link
          href="/sos"
          className="w-full min-h-[56px] rounded-2xl bg-accent text-accent-fg font-semibold text-[16px] flex items-center justify-center gap-2 shadow-sm active:scale-[0.99] transition-transform"
        >
          <Camera className="w-5 h-5" aria-hidden="true" />
          <span>Report an animal in trouble</span>
        </Link>

        {reports == null ? (
          <p role="status" className="text-[14px] text-fg-muted">
            {failed ? 'Could not load your reports. Check your connection.' : 'Loading your reports…'}
          </p>
        ) : reports.length === 0 ? (
          <section className="space-y-2" aria-labelledby="mine-heading">
            <h2 id="mine-heading" className="text-[16px] font-semibold text-fg">
              You have not reported anything yet
            </h2>
            <p className="text-[14px] text-fg-muted">
              When you report an animal, you follow it here: who took the case, where the volunteer is, and when it reaches a clinic.
            </p>
          </section>
        ) : (
          <>
            {open.length > 0 && (
              <section className="space-y-3" aria-labelledby="open-heading">
                <h2 id="open-heading" className="text-[16px] font-semibold text-fg">
                  Following now
                </h2>
                <ul className="space-y-3">
                  {open.map((r) => (
                    <ReportCard key={r.id} r={r} />
                  ))}
                </ul>
              </section>
            )}
            {done.length > 0 && (
              <section className="space-y-3" aria-labelledby="done-heading">
                <h2 id="done-heading" className="text-[16px] font-semibold text-fg">
                  Finished
                </h2>
                <ul className="space-y-3">
                  {done.map((r) => (
                    <ReportCard key={r.id} r={r} />
                  ))}
                </ul>
              </section>
            )}
          </>
        )}

        <div className="flex flex-col gap-2 pt-1">
          <Link
            href="/rafa"
            className="min-h-[44px] rounded-xl border border-border bg-surface hover:bg-surface-muted text-fg font-semibold text-[14px] flex items-center justify-center"
          >
            Ask Rafa for first-aid help
          </Link>
          <button
            type="button"
            onClick={onSeeNearby}
            className="min-h-[44px] rounded-xl border border-border bg-surface hover:bg-surface-muted text-fg font-semibold text-[14px] cursor-pointer"
          >
            See cases near you
          </button>
        </div>
      </div>
    </div>
  );
}

function toReport(r: Row, clinicName: string | null, headsUpClinicName: string | null): MyReport {
  // A claim the volunteer never confirmed (no "On my way" in time) is open again, whatever the row still says
  const state: CaseState = r.state === 'claimed' && needsRescuer(r.state, r.claimed_at, r.emergency_type, r.checkin_kind ?? null, r.heads_up_response !== 'cannot', r.heads_up_eta_minutes ?? null) ? 'reported' : r.state;
  return {
    id: r.id,
    shortId: r.short_id,
    animal: animalLabel(r.animal_type, r.animal_other),
    type: emergencyLabel(r.emergency_type),
    state,
    location: (r.location_name || 'Pinned location').split(' — ')[0],
    latitude: r.latitude,
    longitude: r.longitude,
    createdAt: r.created_at,
    animalName: r.animal_name ?? null,
    status: reporterStatus({
      state,
      checkinKind: r.checkin_kind ?? null,
      headsUpClinicName,
      headsUpResponse: r.heads_up_response ?? null,
      clinicReceived: !!r.clinic_received_at,
      clinicName,
    }),
  };
}

function ReportCard({ r }: { r: MyReport }) {
  return (
    <li className="space-y-3">
      {/* The live tracker comes first: it is what the person is waiting to see */}
      {r.state === 'claimed' && <RescuerCard reportId={r.id} scene={{ lat: r.latitude, lng: r.longitude }} />}
      <article className="rounded-2xl border border-border bg-surface p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[16px] font-semibold text-fg truncate">{r.animalName ? `${r.animalName} · ${r.animal}` : r.animal}</p>
            <p className="text-[14px] text-fg-muted truncate">{r.type}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="font-mono text-[12px] text-fg-muted">#{r.shortId}</p>
            <p className="text-[12px] text-fg-muted">{timeAgo(r.createdAt)}</p>
            <p className="text-[12px] text-fg-muted">{formatWhen(r.createdAt, false)}</p>
          </div>
        </div>
        <StageWeave state={r.state} showLabels />
        <p className="text-[14px] text-fg" aria-live="polite">
          {r.status}
        </p>
        <p className="text-[12px] text-fg-muted truncate">{r.location}</p>
        <Link
          href={`/animal/${r.id}`}
          className="min-h-[44px] rounded-xl border border-border bg-surface hover:bg-surface-muted text-fg font-semibold text-[14px] flex items-center justify-center"
        >
          Open the whole story
        </Link>
      </article>
    </li>
  );
}
