'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useProfile } from '@/lib/supabase/useProfile';
import { animalLabel, emergencyLabel, FLAG_REASON_LABELS } from '@/lib/sos/labels';
import { calculateEscalation, formatWaited, needsRescuer } from '@/lib/sos/escalation';
import { availabilityNote, rankClinics } from '@/lib/sos/clinics';
import { formatDistance } from '@/lib/sos/geo';
import type { FlagReason } from '@/types/database';
import InlineError from '@/components/InlineError';
import ScreenHeader from '@/components/ScreenHeader';
import { useConfirm } from '@/components/ConfirmSheet';
import { DEMO_USER, useDemoData, useDemoMode } from '@/lib/demo/demo';
import { appRpc } from '@/lib/demo/rpc';

type Tab = 'applications' | 'open' | 'flags' | 'users' | 'clinics' | 'handoffs';

interface Application {
  id: string;
  role: 'volunteer' | 'facility';
  note: string;
  createdAt: string;
  email: string;
  clinicName: string | null;
}

interface FlaggedReport {
  reportId: string;
  shortId: string;
  title: string;
  location: string;
  photoUrl: string | null;
  /** One open flag to act on; reviewing it closes every open flag on the report */
  flagId: string;
  reasons: { reason: FlagReason; note: string | null; email: string }[];
}

function timeAgo(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 60) return `${Math.max(1, minutes)}m ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
}

// True while previewing the Admin role: tabs show made-up rows instead of reading the database
const SampleContext = createContext(false);

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

const sampleApplications = (): Application[] => [
  { id: 'sample-a1', role: 'volunteer', note: 'I rescue strays in my barangay and can respond within 15 minutes.', createdAt: hoursAgo(3), email: 'ana.sample@example.test', clinicName: null },
  { id: 'sample-a2', role: 'facility', note: 'Receptionist at the clinic; our manager can confirm by phone.', createdAt: hoursAgo(26), email: 'ben.sample@example.test', clinicName: 'Test Clinic B (New Manila)' },
];

interface OpenCase {
  id: string;
  shortId: string;
  title: string;
  location: string;
  /** Minutes since the report was filed */
  waited: number;
  /** A claim that ran out: the case is waiting again */
  lockExpired: boolean;
  clinics: { id: string; name: string; phone: string; note: string; distance: string | null }[];
}

interface VolunteerOption {
  id: string;
  label: string;
}

const sampleOpenCases = (): { cases: OpenCase[]; volunteers: VolunteerOption[] } => ({
  cases: [
    {
      id: 'sample-o1',
      shortId: 'KK-S201',
      title: 'Injured Dog · Hit-and-run · Critical',
      location: 'Aurora Blvd near EDSA, Cubao',
      waited: 14,
      lockExpired: false,
      clinics: [
        { id: 'sample-c1', name: 'Test Clinic A (Katipunan)', phone: '0000-000-0001', note: 'Open, updated 20 min ago', distance: '2.1 km' },
        { id: 'sample-c2', name: 'Test Clinic B (New Manila)', phone: '0000-000-0002', note: 'Status not reported', distance: '3.4 km' },
      ],
    },
  ],
  volunteers: [
    { id: 'sample-u1', label: 'Ana (ana.sample@example.test)' },
    { id: 'sample-u2', label: 'Dan (dan.sample@example.test)' },
  ],
});

const sampleFlags = (): FlaggedReport[] => [
  {
    reportId: 'sample-r1',
    shortId: 'KK-S101',
    title: 'Injured Dog · Hit-and-run · Critical',
    location: 'Aurora Blvd near EDSA, Cubao',
    photoUrl: null,
    flagId: 'sample-f1',
    reasons: [
      { reason: 'duplicate', note: 'Same dog as KK-S099', email: 'cara.sample@example.test' },
      { reason: 'fake', note: 'AI check: no animal visible. A photo of a wall.', email: 'AI photo check' },
    ],
  },
];

const sampleUsers = (): UserRow[] => [
  { id: 'sample-u1', email: 'ana.sample@example.test', full_name: 'Ana', role: 'volunteer', facility_id: null },
  { id: 'sample-u2', email: 'ben.sample@example.test', full_name: 'Ben', role: 'facility', facility_id: null },
  { id: 'sample-u3', email: 'cara.sample@example.test', full_name: null, role: 'citizen', facility_id: null },
  { id: 'sample-u4', email: 'dan.sample@example.test', full_name: 'Dan', role: 'admin', facility_id: null },
];

const sampleClinics = (): ClinicRow[] => [
  { id: 'sample-c1', name: 'Test Clinic A (Katipunan)', address: 'Katipunan Ave, Quezon City', status: 'Listed' },
  { id: 'sample-c2', name: 'Test Clinic B (New Manila)', address: 'E. Rodriguez Sr. Ave, New Manila', status: 'Listed' },
  { id: 'sample-c3', name: 'Test Shelter D (Kamias)', address: 'Kamias Rd near Anonas', status: 'Paused', paused_reason: 'No update on case #KK-S004 for 14 days' },
];

const sampleHandoffs = (): HandoffRow[] => [
  {
    id: 'sample-h1',
    note: 'Tricycle driver taking it to Test Clinic A on Katipunan',
    plate_photo_path: 'sample',
    created_at: hoursAgo(5),
    sos_reports: { short_id: 'KK-S102' },
    profiles: { email: 'ana.sample@example.test' },
  },
];

// Admin tools. The page is only a convenience: every action is a database function that checks is_admin().
export default function AdminPage() {
  const { user, realRole, role, isPreview, loading } = useProfile();
  const [tab, setTab] = useState<Tab>('applications');
  const demoOn = useDemoMode();

  if (loading) return <p className="px-4 pt-6 text-[14px] text-fg-muted">Loading…</p>;

  // A preview follows the role being shown; a real visit needs a real admin account
  const showAdmin = isPreview ? role === 'admin' : !!user && realRole === 'admin';
  if (!showAdmin) {
    return (
      <div className="px-4 pt-6 space-y-2">
        <p className="text-[14px] font-semibold text-fg">Admins only</p>
        <Link href="/" className="text-[14px] font-semibold text-link underline underline-offset-4">
          Back to the feed
        </Link>
      </div>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'applications', label: 'Applications' },
    { id: 'open', label: 'No responder' },
    { id: 'flags', label: 'Flags' },
    { id: 'users', label: 'Users' },
    { id: 'clinics', label: 'Clinics' },
    { id: 'handoffs', label: 'Handoffs' },
  ];

  return (
    <div className="flex flex-col flex-1 px-4 pt-3 pb-8 space-y-4">
      <ScreenHeader
        title="Admin"
        subtitle="Review applications and flagged reports, manage roles and Listed clinics, and check handoffs."
        className="-mx-4 -mt-3"
      />

      <div role="tablist" aria-label="Admin sections" className="flex gap-5 border-b border-border overflow-x-auto no-scrollbar">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`relative h-11 shrink-0 whitespace-nowrap text-[14px] cursor-pointer ${tab === t.id ? 'text-fg font-semibold' : 'text-fg-muted hover:text-fg'}`}
          >
            {t.label}
            {tab === t.id && <span aria-hidden="true" className="absolute left-0 right-0 -bottom-px h-0.5 rounded-full bg-fg" />}
          </button>
        ))}
      </div>

      {isPreview && (
        <p className="text-[12px] text-fg-muted rounded-xl border border-dashed border-border p-3">
          Preview with sample data. Buttons are turned off.
        </p>
      )}

      <SampleContext.Provider value={isPreview}>
      {/* In demo mode the No responder tab works on the sample cases; the other tabs stay a read-only preview */}
      <fieldset disabled={isPreview && !(demoOn && tab === 'open')} className="min-w-0 border-0 p-0 m-0">
      <div role="tabpanel">
        {tab === 'applications' && <Applications />}
        {tab === 'open' && <NoResponder />}
        {tab === 'flags' && <Flags />}
        {tab === 'users' && <Users />}
        {tab === 'clinics' && (
          <div className="space-y-8">
            <ClinicList />
            <AddClinic />
          </div>
        )}
        {tab === 'handoffs' && <Handoffs />}
      </div>
      </fieldset>
      </SampleContext.Provider>
    </div>
  );
}

function useLoader<T>(load: () => PromiseLike<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.resolve(load()).then(
      (result) => {
        if (!active) return;
        setError(null);
        setData(result);
      },
      (e: unknown) => {
        console.error('Admin load failed:', e);
        if (active) setError('Could not load. Check your connection, and that the latest database migration has run.');
      }
    );
    return () => {
      active = false;
    };
  }, [load, key]);

  const reload = useCallback(() => setKey((k) => k + 1), []);
  return { data, error, reload };
}

function Applications() {
  const sample = useContext(SampleContext);
  const load = useCallback(async (): Promise<Application[]> => {
    if (sample) return sampleApplications();
    const { data, error } = await createClient()
      .from('role_applications')
      .select('id,requested_role,note,created_at,profiles!role_applications_user_id_fkey(email),facilities(name)')
      .eq('status', 'pending')
      .order('created_at');
    if (error) throw error;
    type Row = {
      id: string;
      requested_role: 'volunteer' | 'facility';
      note: string;
      created_at: string;
      profiles: { email: string } | null;
      facilities: { name: string } | null;
    };
    return ((data ?? []) as unknown as Row[]).map((r) => ({
      id: r.id,
      role: r.requested_role,
      note: r.note,
      createdAt: r.created_at,
      email: r.profiles?.email ?? 'Unknown account',
      clinicName: r.facilities?.name ?? null,
    }));
  }, [sample]);
  const { data, error, reload } = useLoader(load);

  return (
    <ReviewList
      items={data}
      error={error}
      empty="No applications waiting for review."
      render={(a) => (
        <>
          <p className="text-[14px] font-semibold text-fg break-all">{a.email}</p>
          <p className="text-[12px] text-fg-muted">
            {a.role === 'facility' ? `Clinic staff · ${a.clinicName ?? 'clinic not found'}` : 'Volunteer'} · applied{' '}
            {timeAgo(a.createdAt)}
          </p>
          <p className="text-[14px] text-fg">“{a.note}”</p>
        </>
      )}
      actions={(a) => [
        {
          label: 'Approve',
          primary: true,
          confirm: {
            title: `Approve ${a.email}?`,
            message: `They become ${a.role === 'facility' ? 'clinic staff' : 'a volunteer'} right away and can act on real cases.`,
          },
          run: () => rpc('review_role_application', { p_application_id: a.id, p_approve: true }),
        },
        {
          label: 'Reject',
          confirm: { title: `Reject ${a.email}?`, message: 'Their application is closed. They can apply again later.' },
          run: () => rpc('review_role_application', { p_application_id: a.id, p_approve: false }),
        },
      ]}
      onDone={reload}
    />
  );
}

function Flags() {
  const sample = useContext(SampleContext);
  const load = useCallback(async (): Promise<FlaggedReport[]> => {
    if (sample) return sampleFlags();
    const { data, error } = await createClient()
      .from('report_flags')
      .select(
        '*,profiles!report_flags_flagged_by_fkey(email),sos_reports(id,short_id,animal_type,emergency_type,location_name,photo_url)'
      )
      .eq('status', 'open')
      .order('created_at');
    if (error) throw error;
    type Row = {
      id: string;
      reason: FlagReason;
      note: string | null;
      profiles: { email: string } | null;
      sos_reports: {
        id: string;
        short_id: string;
        animal_type: string | null;
        emergency_type: string | null;
        location_name: string | null;
        photo_url: string | null;
      } | null;
    };
    // Group flags by report so each report is reviewed once
    const byReport = new Map<string, FlaggedReport>();
    for (const r of (data ?? []) as unknown as Row[]) {
      const report = r.sos_reports;
      if (!report) continue;
      const entry = byReport.get(report.id) ?? {
        reportId: report.id,
        shortId: report.short_id,
        title: `${animalLabel(report.animal_type)} · ${emergencyLabel(report.emergency_type)}`,
        location: (report.location_name || 'Pinned location').split(' — ')[0],
        photoUrl: report.photo_url,
        flagId: r.id,
        reasons: [],
      };
      entry.reasons.push({
        reason: r.reason,
        note: r.note,
        email: (r as { source?: string }).source === 'ai' ? 'AI photo check' : r.profiles?.email ?? 'Unknown account',
      });
      byReport.set(report.id, entry);
    }
    return [...byReport.values()];
  }, [sample]);
  const { data, error, reload } = useLoader(load);

  return (
    <ReviewList
      items={data}
      error={error}
      empty="No flagged reports."
      render={(f) => (
        <div className="flex gap-3">
          {f.photoUrl && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={f.photoUrl} alt="" className="w-16 h-16 rounded-xl object-cover blur-md shrink-0" />
          )}
          <div className="min-w-0 space-y-1">
            <p className="text-[14px] font-semibold text-fg">
              {f.title} <span className="font-mono text-[12px] text-fg-muted">#{f.shortId}</span>
            </p>
            <p className="text-[12px] text-fg-muted">{f.location}</p>
            <ul className="space-y-1">
              {f.reasons.map((r, i) => (
                <li key={i} className="text-[12px] text-fg">
                  <span className="font-semibold">{FLAG_REASON_LABELS[r.reason]}</span>
                  {r.note ? `: ${r.note}` : ''} <span className="text-fg-muted break-all">({r.email})</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      actions={(f) => [
        {
          label: 'Hide report',
          primary: true,
          confirm: { title: `Hide case #${f.shortId}?`, message: 'It leaves the Feed for everyone except the reporter and admins.' },
          run: () => rpc('review_report_flag', { p_flag_id: f.flagId, p_hide_report: true }),
        },
        {
          label: 'Keep, dismiss flag',
          confirm: { title: `Keep case #${f.shortId}?`, message: 'The report stays on the Feed and the flags on it are closed.' },
          run: () => rpc('review_report_flag', { p_flag_id: f.flagId, p_hide_report: false }),
        },
      ]}
      onDone={reload}
    />
  );
}

async function rpc(fn: string, args: Record<string, unknown>): Promise<string | null> {
  const { data, error } = await appRpc(fn, args);
  if (error || !data?.success) return data?.error || error?.message || 'Something went wrong. Please try again.';
  return null;
}

interface Action {
  label: string;
  primary?: boolean;
  /** Asks "Are you sure?" first, naming what will happen */
  confirm?: { title: string; message: string };
  /** Resolves to an error message, or null on success */
  run: () => Promise<string | null>;
}

function ReviewList<T extends { id?: string; reportId?: string }>({
  items,
  error,
  empty,
  render,
  actions,
  onDone,
}: {
  items: T[] | null;
  error: string | null;
  empty: string;
  render: (item: T) => React.ReactNode;
  actions: (item: T) => Action[];
  onDone: () => void;
}) {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{ key: string; message: string } | null>(null);
  const { ask, sheet } = useConfirm();

  if (error) return <p role="alert" className="text-[14px] font-semibold text-fg">{error}</p>;
  if (items == null) return <p role="status" className="text-[14px] text-fg-muted">Loading…</p>;
  if (items.length === 0) return <p className="text-[14px] text-fg-muted">{empty}</p>;

  return (
    <>
    <ul className="divide-y divide-border border-y border-border">
      {items.map((item) => {
        const key = item.id ?? item.reportId ?? '';
        return (
          <li key={key} className="py-3 space-y-3">
            <div className="space-y-1">{render(item)}</div>
            {actionError?.key === key && (
              <p role="alert" className="text-[12px] font-semibold text-fg">
                {actionError.message}
              </p>
            )}
            <div className="flex gap-2">
              {actions(item).map((a) => (
                <button
                  key={a.label}
                  type="button"
                  disabled={busyKey === key}
                  onClick={() => {
                    const execute = async () => {
                      setBusyKey(key);
                      setActionError(null);
                      const message = await a.run();
                      setBusyKey(null);
                      if (message) setActionError({ key, message });
                      else onDone();
                    };
                    if (a.confirm) ask({ ...a.confirm, confirmLabel: `Yes, ${a.label.toLowerCase()}`, onConfirm: execute });
                    else void execute();
                  }}
                  className={
                    a.primary
                      ? 'flex-1 min-h-[44px] rounded-xl bg-fg text-page font-semibold text-[14px] cursor-pointer disabled:opacity-50'
                      : 'flex-1 min-h-[44px] rounded-xl border border-border bg-surface hover:bg-surface-muted text-fg font-semibold text-[14px] cursor-pointer disabled:opacity-50'
                  }
                >
                  {a.label}
                </button>
              ))}
            </div>
          </li>
        );
      })}
    </ul>
    {sheet}
    </>
  );
}

// Cases nobody has taken (or whose claim ran out): the admin can assign a volunteer, phone a clinic that is not full,
// or close a false report. Each action asks once more, and the volunteer is notified when assigned.
function NoResponder() {
  const sample = useContext(SampleContext);
  const demoOn = useDemoMode();
  const demo = useDemoData();
  const load = useCallback(async (): Promise<{ cases: OpenCase[]; volunteers: VolunteerOption[] }> => {
    if (demoOn) {
      const demoClinics = demo.clinics.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        latitude: c.latitude,
        longitude: c.longitude,
        availability: c.availability,
        availabilitySetAt: c.availability_set_at,
      }));
      return {
        cases: demo.reports
          .filter(
            (r) =>
              !r.hidden_at &&
              needsRescuer(r.state, r.claimed_at, r.emergency_type, r.checkin_kind ?? null, r.heads_up_response !== 'cannot', r.heads_up_eta_minutes ?? null) &&
              (r.state === 'claimed' || calculateEscalation(r.created_at, r.emergency_type).isAlert)
          )
          .map((r) => ({
            id: r.id,
            shortId: r.short_id,
            title: `${animalLabel(r.animal_type)} · ${emergencyLabel(r.emergency_type)}`,
            location: r.location_name,
            waited: Math.max(0, Math.floor((Date.now() - new Date(r.created_at).getTime()) / 60_000)),
            lockExpired: r.state === 'claimed',
            clinics: rankClinics(demoClinics, { lat: r.latitude, lng: r.longitude })
              .filter((c) => c.usable)
              .slice(0, 3)
              .map((c) => ({
                id: c.clinic.id,
                name: c.clinic.name,
                phone: c.clinic.phone,
                note: availabilityNote(c.clinic.availability, c.clinic.availabilitySetAt),
                distance: c.distanceKm != null ? formatDistance(c.distanceKm) : null,
              })),
          })),
        volunteers: [{ id: DEMO_USER, label: 'You (demo volunteer)' }],
      };
    }
    if (sample) return sampleOpenCases();
    const supabase = createClient();
    const since = new Date(Date.now() - 24 * 3_600_000).toISOString();
    const basic = 'id,name,phone,latitude,longitude';
    const [reports, people, withStatus] = await Promise.all([
      supabase
        .from('sos_reports')
        .select('id,short_id,animal_type,emergency_type,state,claimed_at,checkin_kind,heads_up_response,heads_up_eta_minutes,created_at,location_name,latitude,longitude')
        .in('state', ['reported', 'claimed'])
        .is('hidden_at', null)
        .gte('created_at', since)
        .order('created_at'),
      supabase.from('profiles').select('id,email,full_name').eq('role', 'volunteer').order('email'),
      // The status columns arrive with the D-042 migration; read the plain list before it
      supabase.from('facilities').select(`${basic},availability,availability_set_at`).eq('status', 'Listed'),
    ]);
    if (reports.error) throw reports.error;
    const clinicRows: Record<string, unknown>[] = withStatus.error
      ? ((await supabase.from('facilities').select(basic).eq('status', 'Listed')).data ?? [])
      : (withStatus.data ?? []);
    const clinics = clinicRows.map((f) => ({
      id: f.id as string,
      name: f.name as string,
      phone: ((f.phone as string | null) ?? '') as string,
      latitude: f.latitude as number,
      longitude: f.longitude as number,
      availability: (f.availability as string | null | undefined) ?? null,
      availabilitySetAt: (f.availability_set_at as string | null | undefined) ?? null,
    }));

    const cases: OpenCase[] = (reports.data ?? [])
      .filter(
        (r) =>
          needsRescuer(r.state, r.claimed_at, r.emergency_type, r.checkin_kind ?? null, r.heads_up_response !== 'cannot', r.heads_up_eta_minutes ?? null) &&
          (r.state === 'claimed' || calculateEscalation(r.created_at, r.emergency_type).isAlert)
      )
      .map((r) => ({
        id: r.id,
        shortId: r.short_id,
        title: `${animalLabel(r.animal_type)} · ${emergencyLabel(r.emergency_type)}`,
        location: (r.location_name || 'Pinned location').split(' — ')[0],
        waited: Math.max(0, Math.floor((Date.now() - new Date(r.created_at).getTime()) / 60_000)),
        lockExpired: r.state === 'claimed',
        clinics: rankClinics(clinics, { lat: r.latitude, lng: r.longitude })
          .filter((c) => c.usable)
          .slice(0, 3)
          .map((c) => ({
            id: c.clinic.id,
            name: c.clinic.name,
            phone: c.clinic.phone,
            note: availabilityNote(c.clinic.availability, c.clinic.availabilitySetAt),
            distance: c.distanceKm != null ? formatDistance(c.distanceKm) : null,
          })),
      }));

    const volunteers = (people.data ?? []).map((p) => ({
      id: p.id as string,
      label: p.full_name ? `${p.full_name} (${p.email})` : (p.email as string),
    }));
    return { cases, volunteers };
  }, [sample, demoOn, demo]);
  const { data, error, reload } = useLoader(load);

  if (error) return <p role="alert" className="text-[14px] font-semibold text-fg">{error}</p>;
  if (data == null) return <p role="status" className="text-[14px] text-fg-muted">Loading…</p>;
  if (data.cases.length === 0) return <p className="text-[14px] text-fg-muted">Every case from the last 24 hours has a rescuer.</p>;

  return (
    <ul className="divide-y divide-border border-y border-border">
      {data.cases.map((c) => (
        <li key={c.id} className="py-3">
          <OpenCaseRow c={c} volunteers={data.volunteers} onDone={reload} />
        </li>
      ))}
    </ul>
  );
}

function OpenCaseRow({ c, volunteers, onDone }: { c: OpenCase; volunteers: VolunteerOption[]; onDone: () => void }) {
  const { ask, sheet } = useConfirm();
  const [volunteerId, setVolunteerId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const chosen = volunteers.find((v) => v.id === volunteerId);

  const finish = (message: string | null) => (message ? setError(message) : onDone());

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="text-[14px] font-semibold text-fg">
          {c.title} <span className="font-mono text-[12px] text-fg-muted">#{c.shortId}</span>
        </p>
        <p className="text-[12px] text-fg-muted">{c.location}</p>
        <p className="text-[12px] font-bold text-reported-fg">
          {c.lockExpired ? 'The rescuer’s claim ran out. ' : 'No one has taken it. '}Waiting {formatWaited(c.waited)}.
        </p>
      </div>

      <div className="space-y-1">
        <p className="text-[12px] font-semibold text-fg">Clinics near it that are not full (call to ask)</p>
        {c.clinics.length === 0 ? (
          <p className="text-[12px] text-fg-muted">No clinic is listed as available. Every Listed clinic reported it is full.</p>
        ) : (
          <ul className="space-y-0.5">
            {c.clinics.map((cl) => (
              <li key={cl.id} className="text-[12px] text-fg">
                <span className="font-semibold">{cl.name}</span>
                {cl.phone ? ` · ${cl.phone}` : ''}
                {cl.distance ? ` · ${cl.distance}` : ''} <span className="text-fg-muted">({cl.note})</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2">
        <label className="block space-y-1">
          <span className="text-[12px] font-semibold text-fg">Assign a volunteer</span>
          <select
            value={volunteerId}
            onChange={(e) => setVolunteerId(e.target.value)}
            className="w-full min-h-[44px] rounded-xl border border-border bg-surface text-fg text-[14px] px-3 focus:outline-none focus:ring-2 focus:ring-action"
          >
            <option value="">Choose a volunteer…</option>
            {volunteers.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
        </label>
        {error && <InlineError>{error}</InlineError>}
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!chosen}
            onClick={() =>
              chosen &&
              ask({
                title: `Assign ${chosen.label} to #${c.shortId}?`,
                message: 'The case is locked to them and they get a notification right away.',
                confirmLabel: 'Yes, assign',
                onConfirm: async () => finish(await rpc('admin_assign_claim', { p_report_id: c.id, p_volunteer_id: chosen.id })),
              })
            }
            className="flex-1 min-h-[44px] rounded-xl bg-fg text-page font-semibold text-[14px] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Assign
          </button>
          <button
            type="button"
            onClick={() =>
              ask({
                title: `Close #${c.shortId} as a false report?`,
                message: 'It leaves the Feed for everyone except the reporter and admins. Use this only for a fake or duplicate report.',
                confirmLabel: 'Yes, close it',
                onConfirm: async () => finish(await rpc('admin_hide_report', { p_report_id: c.id })),
              })
            }
            className="flex-1 min-h-[44px] rounded-xl border border-border bg-surface hover:bg-surface-muted text-fg font-semibold text-[14px] cursor-pointer"
          >
            Close as false report
          </button>
        </div>
      </div>
      {sheet}
    </div>
  );
}

function AddClinic() {
  const [form, setForm] = useState({ name: '', address: '', phone: '', latitude: '', longitude: '' });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [locating, setLocating] = useState(false);

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const useHere = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setForm((f) => ({ ...f, latitude: pos.coords.latitude.toFixed(6), longitude: pos.coords.longitude.toFixed(6) }));
      },
      () => {
        setLocating(false);
        setMessage({ ok: false, text: 'Could not get your location. Type the coordinates instead.' });
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const lat = Number(form.latitude);
  const lng = Number(form.longitude);
  const valid =
    form.name.trim().length >= 3 &&
    form.address.trim().length >= 5 &&
    form.phone.trim().length >= 7 &&
    form.latitude !== '' &&
    form.longitude !== '' &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    setMessage(null);
    const { error } = await createClient()
      .from('facilities')
      .insert({
        name: form.name.trim(),
        address: form.address.trim(),
        phone: form.phone.trim(),
        latitude: lat,
        longitude: lng,
        status: 'Listed',
      });
    setBusy(false);
    if (error) {
      setMessage({ ok: false, text: error.message });
      return;
    }
    setMessage({ ok: true, text: `${form.name.trim()} is now Listed.` });
    setForm({ name: '', address: '', phone: '', latitude: '', longitude: '' });
  };

  const field = 'w-full min-h-[44px] rounded-xl border border-border bg-surface-muted text-fg text-[14px] px-3 focus:outline-none focus:ring-2 focus:ring-action';

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-[12px] text-fg-muted">Prototype rule: clinics are shown as “Listed”, never “Verified”.</p>
      {(
        [
          ['name', 'Clinic name', 'text'],
          ['address', 'Address', 'text'],
          ['phone', 'Phone', 'tel'],
        ] as const
      ).map(([key, label, type]) => (
        <label key={key} className="block space-y-1">
          <span className="text-[12px] font-semibold text-fg">{label}</span>
          <input type={type} value={form[key]} onChange={set(key)} required className={field} />
        </label>
      ))}
      <div className="grid grid-cols-2 gap-2">
        <label className="block space-y-1">
          <span className="text-[12px] font-semibold text-fg">Latitude</span>
          <input inputMode="decimal" value={form.latitude} onChange={set('latitude')} required className={field} />
        </label>
        <label className="block space-y-1">
          <span className="text-[12px] font-semibold text-fg">Longitude</span>
          <input inputMode="decimal" value={form.longitude} onChange={set('longitude')} required className={field} />
        </label>
      </div>
      <button
        type="button"
        onClick={useHere}
        disabled={locating}
        className="w-full min-h-[44px] rounded-xl border border-border bg-surface hover:bg-surface-muted text-fg font-semibold text-[14px] cursor-pointer disabled:cursor-wait"
      >
        {locating ? 'Locating…' : "I'm at the clinic: use my location"}
      </button>
      {message && (
        <p role={message.ok ? 'status' : 'alert'} className={`text-[14px] ${message.ok ? 'text-healing-fg' : 'font-semibold text-fg'}`}>
          {message.text}
        </p>
      )}
      <button
        type="submit"
        disabled={!valid || busy}
        className="w-full min-h-[48px] rounded-xl bg-action text-action-fg font-semibold text-[14px] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {busy ? 'Saving…' : 'Add Listed clinic'}
      </button>
    </form>
  );
}

const ROLES = ['citizen', 'volunteer', 'facility', 'admin'] as const;
type Role = (typeof ROLES)[number];
type UserRow = { id: string; email: string; full_name: string | null; role: Role; facility_id: string | null };

function useListedClinics() {
  const [clinics, setClinics] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    let active = true;
    createClient()
      .from('facilities')
      .select('id,name')
      .order('name')
      .then(({ data }) => active && setClinics(data ?? []));
    return () => {
      active = false;
    };
  }, []);
  return clinics;
}

// Change anyone's role (not your own). Removing a volunteer releases any rescue they still hold.
function Users() {
  const sample = useContext(SampleContext);
  const load = useCallback(async (): Promise<UserRow[]> => {
    if (sample) return sampleUsers();
    const { data, error } = await createClient()
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw error;
    return (data ?? []) as UserRow[];
  }, [sample]);
  const { data, error, reload } = useLoader(load);
  const clinics = useListedClinics();
  const [query, setQuery] = useState('');

  if (error) return <InlineError>{error}</InlineError>;
  if (data == null) return <p role="status" className="text-[14px] text-fg-muted">Loading…</p>;

  const q = query.trim().toLowerCase();
  const shown = q ? data.filter((u) => u.email.toLowerCase().includes(q) || (u.full_name ?? '').toLowerCase().includes(q)) : data;

  return (
    <div className="space-y-3">
      <label className="block space-y-1">
        <span className="text-[12px] font-semibold text-fg">Find a user</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Email or name"
          className="w-full min-h-[44px] rounded-xl border border-border bg-surface-muted text-fg text-[14px] px-3 focus:outline-none focus:ring-2 focus:ring-action"
        />
      </label>
      <ul className="divide-y divide-border border-y border-border">
        {shown.map((u) => (
          <UserRole key={u.id} user={u} clinics={clinics} onSaved={reload} />
        ))}
      </ul>
    </div>
  );
}

function UserRole({ user, clinics, onSaved }: { user: UserRow; clinics: { id: string; name: string }[]; onSaved: () => void }) {
  const [role, setRole] = useState<Role>(user.role);
  const [clinicId, setClinicId] = useState(user.facility_id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { ask, sheet } = useConfirm();
  const changed = role !== user.role || (role === 'facility' && clinicId !== (user.facility_id ?? ''));
  const field = 'min-h-[44px] rounded-xl border border-border bg-surface-muted text-fg text-[14px] px-3';
  const roleWord = role === 'facility' ? 'clinic staff' : role;

  return (
    <li className="py-3 space-y-2">
      <div>
        <p className="text-[14px] font-semibold text-fg break-all">{user.email}</p>
        <p className="text-[12px] text-fg-muted">{user.full_name || 'No name set'}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <select aria-label={`Role for ${user.email}`} value={role} onChange={(e) => setRole(e.target.value as Role)} className={field}>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r === 'facility' ? 'clinic staff' : r}
            </option>
          ))}
        </select>
        {role === 'facility' && (
          <select aria-label="Clinic" value={clinicId} onChange={(e) => setClinicId(e.target.value)} className={`flex-1 min-w-0 ${field}`}>
            <option value="">Choose a clinic</option>
            {clinics.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
        {changed && (
          <button
            type="button"
            disabled={busy || (role === 'facility' && !clinicId)}
            onClick={() =>
              ask({
                title: `Make ${user.email} ${roleWord}?`,
                message: 'The change applies right away. A volunteer who loses the role gives up any rescue they still hold.',
                confirmLabel: 'Yes, change the role',
                onConfirm: async () => {
                  setBusy(true);
                  setError(null);
                  const message = await rpc('admin_set_role', {
                    p_user_id: user.id,
                    p_role: role,
                    p_facility_id: role === 'facility' ? clinicId : null,
                  });
                  setBusy(false);
                  if (message) setError(message);
                  else onSaved();
                },
              })
            }
            className="min-h-[44px] px-4 rounded-xl bg-fg text-page font-semibold text-[14px] cursor-pointer disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
        )}
      </div>
      {error && <InlineError>{error}</InlineError>}
      {sheet}
    </li>
  );
}

type ClinicRow = { id: string; name: string; address: string; status: string; paused_reason?: string | null };

// Paused clinics are hidden from the clinic picker and the Clinics page until listed again
function ClinicList() {
  const sample = useContext(SampleContext);
  const load = useCallback(async (): Promise<ClinicRow[]> => {
    if (sample) return sampleClinics();
    const { data, error } = await createClient().from('facilities').select('*').order('name');
    if (error) throw error;
    return (data ?? []) as ClinicRow[];
  }, [sample]);
  const { data, error, reload } = useLoader(load);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const { ask, sheet } = useConfirm();

  const setStatus = async (c: ClinicRow, status: 'Listed' | 'Paused') => {
    setBusyId(c.id);
    setActionError(null);
    const patch =
      status === 'Listed'
        ? { status, paused_reason: null, paused_at: null, last_active_at: new Date().toISOString() }
        : { status, paused_reason: 'Paused by an admin', paused_at: new Date().toISOString() };
    const { error: updateError } = await createClient().from('facilities').update(patch).eq('id', c.id);
    setBusyId(null);
    if (updateError) setActionError(updateError.message);
    else reload();
  };

  if (error) return <InlineError>{error}</InlineError>;
  if (data == null) return <p role="status" className="text-[14px] text-fg-muted">Loading…</p>;

  return (
    <section aria-labelledby="clinic-list-heading" className="space-y-2">
      <h2 id="clinic-list-heading" className="text-[16px] font-semibold text-fg">
        Clinics
      </h2>
      {actionError && <InlineError>{actionError}</InlineError>}
      <ul className="divide-y divide-border border-y border-border">
        {data.map((c) => (
          <li key={c.id} className="py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-semibold text-fg">{c.name}</p>
              <p className="text-[12px] text-fg-muted">
                {c.status}
                {c.status === 'Paused' && c.paused_reason ? ` · ${c.paused_reason}` : ` · ${c.address}`}
              </p>
            </div>
            <button
              type="button"
              disabled={busyId === c.id}
              onClick={() => {
                const next = c.status === 'Listed' ? 'Paused' : 'Listed';
                ask({
                  title: next === 'Paused' ? `Pause ${c.name}?` : `List ${c.name} again?`,
                  message:
                    next === 'Paused'
                      ? 'It disappears from the clinic list and rescuers can no longer bring animals here until you list it again.'
                      : 'It appears in the clinic list again and rescuers can bring animals here.',
                  confirmLabel: next === 'Paused' ? 'Yes, pause it' : 'Yes, list it',
                  onConfirm: () => setStatus(c, next),
                });
              }}
              className="shrink-0 min-h-[44px] px-4 rounded-xl border border-border bg-surface hover:bg-surface-muted text-fg font-semibold text-[14px] cursor-pointer disabled:opacity-50"
            >
              {c.status === 'Listed' ? 'Pause' : 'List again'}
            </button>
          </li>
        ))}
      </ul>
      {sheet}
    </section>
  );
}

type HandoffRow = {
  id: string;
  note: string;
  plate_photo_path: string;
  created_at: string;
  sos_reports: { short_id: string } | null;
  profiles: { email: string } | null;
};

function Handoffs() {
  const sample = useContext(SampleContext);
  const load = useCallback(async (): Promise<HandoffRow[]> => {
    if (sample) return sampleHandoffs();
    const { data, error } = await createClient()
      .from('handoffs')
      .select('id,note,plate_photo_path,created_at,sos_reports(short_id),profiles(email)')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    return (data ?? []) as unknown as HandoffRow[];
  }, [sample]);
  const { data, error } = useLoader(load);

  const view = async (path: string) => {
    const { data: signed } = await createClient().storage.from('plate-photos').createSignedUrl(path, 120);
    if (signed?.signedUrl) window.open(signed.signedUrl, '_blank', 'noopener');
  };

  if (error) return <InlineError>{error}</InlineError>;
  if (data == null) return <p role="status" className="text-[14px] text-fg-muted">Loading…</p>;
  if (data.length === 0) return <p className="text-[14px] text-fg-muted">No handoffs yet.</p>;

  return (
    <ul className="divide-y divide-border border-y border-border">
      {data.map((h) => (
        <li key={h.id} className="py-3 space-y-1">
          <p className="text-[14px] font-semibold text-fg">
            Case <span className="font-mono">#{h.sos_reports?.short_id ?? '?'}</span> · {timeAgo(h.created_at)}
          </p>
          <p className="text-[14px] text-fg">{h.note}</p>
          <p className="text-[12px] text-fg-muted break-all">By {h.profiles?.email ?? 'unknown account'}</p>
          <button
            type="button"
            onClick={() => view(h.plate_photo_path)}
            className="min-h-[44px] text-[14px] font-semibold text-link underline underline-offset-4 cursor-pointer"
          >
            View plate photo
          </button>
        </li>
      ))}
    </ul>
  );
}
