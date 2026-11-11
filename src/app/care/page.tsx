'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import InlineError from '@/components/InlineError';
import DayWeave from '@/components/DayWeave';
import StageWeave from '@/components/StageWeave';
import { useProfile } from '@/lib/supabase/useProfile';
import { calculateFacilityInactivity, type FacilityClockStatus } from '@/lib/sos/escalation';
import { animalLabel, emergencyLabel, formatWhen, CARE_STATE_LABELS } from '@/lib/sos/labels';
import { availabilityNote, CLINIC_STATUS_LABELS, effectiveAvailability, type ClinicStatus } from '@/lib/sos/clinics';
import { useConfirm, type ConfirmOptions } from '@/components/ConfirmSheet';
import { DEMO_CLINIC_ID, isDemoOn, useDemoData, useDemoMode } from '@/lib/demo/demo';
import { appRpc } from '@/lib/demo/rpc';
import { prepareRecoveryPhoto } from '@/lib/recoveryPhoto';
import RescuerCard from '@/components/RescuerCard';
import { detailsError, requiredDocsError } from '@/lib/sos/recovery';
import LiveCameraCapture from '@/components/LiveCameraCapture';
import ScreenHeader from '@/components/ScreenHeader';

type CareState = keyof typeof CARE_STATE_LABELS;
type Ask = (options: ConfirmOptions) => void;

/** A rescuer who has told this clinic they are bringing an animal */
interface Incoming {
  id: string;
  shortId: string;
  animal: string;
  type: string;
  etaMinutes: number | null;
  headsUpAt: string | null;
  response: 'expecting' | 'cannot' | null;
  clinicName: string;
  /** When this clinic confirmed the animal is there; the volunteer's Admit unlocks then */
  receivedAt: string | null;
  /** Where the clinic is: the volunteer's tracker measures the distance to here */
  clinicLat: number | null;
  clinicLng: number | null;
}

interface CareUpdate {
  notes: string;
  state: CareState;
  createdAt: string;
}

interface CareCase {
  id: string;
  shortId: string;
  animal: string;
  type: string;
  state: CareState;
  clinicName: string;
  /** Named by the clinic, the rescuer or an admin; missing before the D-042 migration */
  animalName: string | null;
  /** Brought in by a rescuer, not yet confirmed by the clinic */
  awaitingIntake: boolean;
  /** Newest first */
  updates: CareUpdate[];
}

type Row = {
  id: string;
  short_id: string;
  animal_type: string | null;
  animal_other?: string | null;
  emergency_type: string | null;
  state: CareState;
  updated_at: string;
  /** Missing before the intake migration runs */
  intake_confirmed_at?: string | null;
  animal_name?: string | null;
  facilities: { name: string } | null;
  recovery_updates: { notes: string; state: CareState; created_at: string }[] | null;
};

const lastUpdateAt = (c: CareCase) => c.updates[0]?.createdAt ?? null;
const STATUS_RANK = { alert: 0, warning: 1, active: 2 } as const;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const ago = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();
const SAMPLE_CLINIC = 'Test Clinic A (Katipunan)';

// Shown only while previewing the Clinic staff or Admin role: made-up cases that show each state of the page
function sampleCases(): CareCase[] {
  const base = { clinicName: SAMPLE_CLINIC, animalName: null };
  return [
    {
      ...base,
      id: 'sample-1',
      shortId: 'KK-S001',
      animal: 'Injured Dog',
      type: 'Hit-and-run · Critical',
      state: 'admitted',
      awaitingIntake: true,
      updates: [{ notes: 'Brought to the clinic. Waiting for the clinic to confirm.', state: 'admitted', createdAt: ago(1) }],
    },
    {
      ...base,
      id: 'sample-2',
      shortId: 'KK-S002',
      animal: 'Injured Cat',
      type: 'Fracture / Limping',
      state: 'healing',
      awaitingIntake: false,
      updates: [{ notes: 'Splint on, eating well.', state: 'healing', createdAt: ago(48) }],
    },
    {
      ...base,
      id: 'sample-3',
      shortId: 'KK-S003',
      animal: 'Injured Dog',
      type: 'Sick / Severe Mange',
      state: 'admitted',
      awaitingIntake: false,
      updates: [{ notes: 'Started treatment, needs rechecking.', state: 'admitted', createdAt: ago(12 * 24) }],
    },
    {
      ...base,
      id: 'sample-4',
      shortId: 'KK-S004',
      animal: 'Injured Cat',
      type: 'Bleeding · Critical',
      state: 'healing',
      awaitingIntake: false,
      updates: [{ notes: 'Wound closed, weak but stable.', state: 'healing', createdAt: ago(16 * 24) }],
    },
    {
      ...base,
      id: 'sample-5',
      shortId: 'KK-S005',
      animal: 'Injured Dog',
      type: 'Fracture / Limping',
      state: 'resolved',
      awaitingIntake: false,
      updates: [{ notes: 'Recovered and returned to the street.', state: 'resolved', createdAt: ago(5 * 24) }],
    },
  ];
}

// Listed clinic staff log how each admitted animal is doing. Every update restarts that case's
// 14-day clock; the database checks that the clinic is the one caring for the animal.
export default function CarePage() {
  const { user, realRole, role, isPreview, facilityId, loading } = useProfile();
  const [cases, setCases] = useState<CareCase[] | null>(null);
  const [clinicName, setClinicName] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const { ask, sheet: confirmSheet } = useConfirm();
  // The clinic's own status and the animals on their way here (both arrive with the D-042 migration)
  const [availability, setAvailability] = useState<{ status: string | null; setAt: string | null }>({ status: null, setAt: null });
  const [incoming, setIncoming] = useState<Incoming[]>([]);
  // An admin can set the status of any Listed clinic (clinic staff only see their own)
  const [adminClinics, setAdminClinics] = useState<{ id: string; name: string; status: string | null; setAt: string | null }[]>([]);
  const [adminClinicId, setAdminClinicId] = useState('');

  // A role preview shows sample cases, read-only; the real clinic data stays behind the real role
  // Demo mode lets the previewed role act on the sample data; a plain preview stays read-only
  const demoOn = useDemoMode();
  const demo = useDemoData();
  const sample = isPreview && !demoOn;
  const isAdmin = isPreview ? role === 'admin' : realRole === 'admin';
  const isStaff = isPreview ? role === 'facility' : realRole === 'facility' && !!facilityId;
  const myFacilityId = demoOn ? DEMO_CLINIC_ID : facilityId;
  const canView = isAdmin || isStaff;
  const previewCases = useMemo(() => (sample && canView ? sampleCases() : null), [sample, canView]);

  useEffect(() => {
    if (!canView || sample || demoOn) return;
    let active = true;
    const supabase = createClient();

    let query = supabase
      .from('sos_reports')
      .select(
        '*,facilities(name),recovery_updates(notes,state,created_at)'
      )
      .in('state', ['admitted', 'healing', 'resolved'])
      .not('facility_id', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(100);
    if (!isAdmin && facilityId) query = query.eq('facility_id', facilityId);

    query.then(({ data, error }) => {
      if (!active) return;
      if (error) {
        console.error('Failed to load clinic cases:', error.code, error.message);
        setLoadError('Could not load cases. Check your connection and try again.');
        return;
      }
      setLoadError(null);
      const rows = (data ?? []) as unknown as Row[];
      setCases(
        rows.map((r) => ({
          id: r.id,
          shortId: r.short_id,
          animal: animalLabel(r.animal_type, r.animal_other),
          type: emergencyLabel(r.emergency_type),
          state: r.state,
          clinicName: r.facilities?.name ?? 'Listed clinic',
          animalName: r.animal_name ?? null,
          awaitingIntake: r.state === 'admitted' && 'intake_confirmed_at' in r && !r.intake_confirmed_at,
          updates: (r.recovery_updates ?? [])
            .map((u) => ({ notes: u.notes, state: u.state, createdAt: u.created_at }))
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        }))
      );
    });

    if (!isAdmin && facilityId) {
      supabase
        .from('facilities')
        .select('name')
        .eq('id', facilityId)
        .maybeSingle()
        .then(({ data }) => active && setClinicName(data?.name ?? null));
      // Missing columns (before the migration) just leave the status unset
      supabase
        .from('facilities')
        .select('availability,availability_set_at')
        .eq('id', facilityId)
        .maybeSingle()
        .then(({ data }) => {
          if (active && data) setAvailability({ status: data.availability ?? null, setAt: data.availability_set_at ?? null });
        });
    }

    if (isAdmin) {
      const basic = 'id,name';
      supabase
        .from('facilities')
        .select(`${basic},availability,availability_set_at`)
        .eq('status', 'Listed')
        .order('name')
        .then(async (withStatus) => {
          const rows: Record<string, unknown>[] = withStatus.error
            ? ((await supabase.from('facilities').select(basic).eq('status', 'Listed').order('name')).data ?? [])
            : (withStatus.data ?? []);
          if (!active) return;
          setAdminClinics(
            rows.map((f) => ({
              id: f.id as string,
              name: f.name as string,
              status: (f.availability as string | null | undefined) ?? null,
              setAt: (f.availability_set_at as string | null | undefined) ?? null,
            }))
          );
        });
    }

    // Rescuers who told a clinic they are coming, waiting for an answer or already answered "expecting"
    const incomingBase = 'id,short_id,animal_type,animal_other,emergency_type,heads_up_facility_id,heads_up_eta_minutes,heads_up_at,heads_up_response';
    const loadIncoming = async (columns: string) => {
      let q = supabase.from('sos_reports').select(columns).eq('state', 'claimed').not('heads_up_facility_id', 'is', null).order('heads_up_at', { ascending: false });
      if (!isAdmin && facilityId) q = q.eq('heads_up_facility_id', facilityId);
      return q;
    };
    // The newer columns arrive with later migrations; fall back to the plain list before they exist
    const incomingWithAll = async () => {
      const full = await loadIncoming(`${incomingBase},clinic_received_at`);
      if (!full.error) return full;
      const withOther = await loadIncoming(incomingBase);
      if (!withOther.error) return withOther;
      return loadIncoming('id,short_id,animal_type,emergency_type,heads_up_facility_id,heads_up_eta_minutes,heads_up_at,heads_up_response');
    };
    Promise.all([incomingWithAll(), supabase.from('facilities').select('id,name,latitude,longitude')]).then(([cases, names]) => {
      if (!active || cases.error) return;
      const nameById = new Map((names.data ?? []).map((f) => [f.id as string, f.name as string]));
      const spotById = new Map((names.data ?? []).map((f) => [f.id as string, { lat: f.latitude as number | null, lng: f.longitude as number | null }]));
      setIncoming(
        ((cases.data ?? []) as unknown as Record<string, string | number | null>[])
          .filter((r) => r.heads_up_response !== 'cannot')
          .map((r) => ({
            id: r.id as string,
            shortId: r.short_id as string,
            animal: animalLabel(r.animal_type as string | null, r.animal_other as string | null | undefined),
            type: emergencyLabel(r.emergency_type as string | null),
            etaMinutes: (r.heads_up_eta_minutes as number | null) ?? null,
            headsUpAt: (r.heads_up_at as string | null) ?? null,
            response: (r.heads_up_response as Incoming['response']) ?? null,
            clinicName: nameById.get(r.heads_up_facility_id as string) ?? 'Listed clinic',
            receivedAt: (r.clinic_received_at as string | null | undefined) ?? null,
            clinicLat: spotById.get(r.heads_up_facility_id as string)?.lat ?? null,
            clinicLng: spotById.get(r.heads_up_facility_id as string)?.lng ?? null,
          }))
      );
    });

    return () => {
      active = false;
    };
  }, [canView, sample, demoOn, isAdmin, facilityId, reloadKey]);

  // A rescuer's heads-up should show up without reloading the page
  useEffect(() => {
    if (!canView || sample) return;
    const timer = setInterval(() => setReloadKey((k) => k + 1), 30_000);
    return () => clearInterval(timer);
  }, [canView, sample]);

  const reload = useCallback(() => {
    setOpenId(null);
    setReloadKey((k) => k + 1);
  }, []);

  // Demo mode: the sample cases, heads-ups and clinics, read from the local demo instead of the database
  const demoClinicName = demo.clinics.find((c) => c.id === DEMO_CLINIC_ID)?.name ?? null;
  const demoCases: CareCase[] | null = demoOn
    ? demo.reports
        .filter((r) => (r.state === 'admitted' || r.state === 'healing' || r.state === 'resolved') && r.facility_id && (isAdmin || r.facility_id === DEMO_CLINIC_ID))
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
        .map((r) => ({
          id: r.id,
          shortId: r.short_id,
          animal: animalLabel(r.animal_type, r.animal_other),
          type: emergencyLabel(r.emergency_type),
          state: r.state as CareState,
          clinicName: demo.clinics.find((c) => c.id === r.facility_id)?.name ?? 'Listed clinic',
          animalName: r.animal_name,
          awaitingIntake: r.state === 'admitted' && !r.intake_confirmed_at,
          updates: demo.updates
            .filter((u) => u.report_id === r.id)
            .map((u) => ({ notes: u.notes, state: u.state as CareState, createdAt: u.created_at }))
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        }))
    : null;
  const demoIncoming: Incoming[] = demoOn
    ? demo.reports
        .filter((r) => r.state === 'claimed' && r.heads_up_facility_id && r.heads_up_response !== 'cannot' && (isAdmin || r.heads_up_facility_id === DEMO_CLINIC_ID))
        .map((r) => ({
          id: r.id,
          shortId: r.short_id,
          animal: animalLabel(r.animal_type),
          type: emergencyLabel(r.emergency_type),
          etaMinutes: r.heads_up_eta_minutes,
          headsUpAt: r.heads_up_at,
          response: r.heads_up_response,
          clinicName: demo.clinics.find((c) => c.id === r.heads_up_facility_id)?.name ?? 'Listed clinic',
          receivedAt: r.clinic_received_at ?? null,
          clinicLat: demo.clinics.find((c) => c.id === r.heads_up_facility_id)?.latitude ?? null,
          clinicLng: demo.clinics.find((c) => c.id === r.heads_up_facility_id)?.longitude ?? null,
        }))
    : [];
  const demoMine = demo.clinics.find((c) => c.id === DEMO_CLINIC_ID);
  const availabilityShown = demoOn ? { status: demoMine?.availability ?? null, setAt: demoMine?.availability_set_at ?? null } : availability;
  const incomingShown = demoOn ? demoIncoming : incoming;
  const adminClinicsShown = demoOn
    ? demo.clinics.map((c) => ({ id: c.id, name: c.name, status: c.availability, setAt: c.availability_set_at }))
    : adminClinics;

  const shown = previewCases ?? (demoOn ? demoCases : cases);
  const shownClinic = sample && !isAdmin ? SAMPLE_CLINIC : demoOn && !isAdmin ? demoClinicName : clinicName;
  const awaiting = (shown ?? []).filter((c) => c.awaitingIntake);
  const inCare = (shown ?? [])
    .filter((c) => c.state !== 'resolved' && !c.awaitingIntake)
    .map((c) => ({ c, clock: calculateFacilityInactivity(lastUpdateAt(c)) }))
    // Most overdue first
    .sort((a, b) => STATUS_RANK[a.clock.status] - STATUS_RANK[b.clock.status] || b.clock.elapsedDays - a.clock.elapsedDays);
  // Every completed case, newest first: the clinic's record of the animals it has seen through to the end
  const released = (shown ?? [])
    .filter((c) => c.state === 'resolved')
    .sort((a, b) => (lastUpdateAt(b) ?? '').localeCompare(lastUpdateAt(a) ?? ''));
  const overdue = inCare.filter(({ clock }) => clock.status !== 'active').length;

  return (
    <div className="flex flex-col flex-1 px-4 pt-3 pb-8 space-y-6">
      <ScreenHeader
        title="Clinic care"
        subtitle={
          isAdmin
            ? 'Every animal in care at Listed clinics. Admins can post updates for any case.'
            : shownClinic
              ? `${shownClinic} · Listed. Log how each animal is doing at least every 14 days.`
              : 'Log how each animal is doing at least every 14 days.'
        }
        className="-mx-4 -mt-3"
      />

      {sample && canView && (
        <p className="text-[12px] text-fg-muted rounded-xl border border-dashed border-border p-3">
          Preview with sample cases. Buttons are turned off.
        </p>
      )}

      <fieldset disabled={sample} className="min-w-0 border-0 p-0 m-0 space-y-6">
      {loading ? (
        <p className="text-[14px] text-fg-muted">Loading…</p>
      ) : !user && !sample && !demoOn ? (
        <Notice title="Sign in to see your clinic's cases">
          <Link href="/settings" className="text-[14px] font-semibold text-link underline underline-offset-4">
            Go to Settings to sign in
          </Link>
        </Notice>
      ) : !canView ? (
        <Notice title="This page is for Listed clinic staff">
          <p className="text-[14px] text-fg-muted">
            {realRole === 'facility'
              ? 'Your account is not linked to a clinic yet. Ask an admin to link it.'
              : 'Work at a Listed clinic? Apply as clinic staff in Settings and an admin will review it.'}
          </p>
          {realRole !== 'facility' && (
            <Link href="/settings#volunteer" className="text-[14px] font-semibold text-link underline underline-offset-4">
              Apply in Settings
            </Link>
          )}
        </Notice>
      ) : loadError ? (
        <Notice title="Could not load cases">
          <p className="text-[14px] text-fg-muted">{loadError}</p>
          <button
            type="button"
            onClick={reload}
            className="min-h-[44px] px-4 rounded-xl border border-border bg-surface hover:bg-surface-muted text-fg font-semibold text-[14px] cursor-pointer"
          >
            Try again
          </button>
        </Notice>
      ) : shown == null ? (
        <p role="status" className="text-[14px] text-fg-muted">
          Loading cases…
        </p>
      ) : (
        <>
          <dl className="grid grid-cols-2 divide-x divide-border border-y border-border">
            <div className="py-3 pr-3 flex flex-col gap-1">
              <dt className="text-[12px] text-fg-muted">In care</dt>
              <dd className="text-[16px] font-semibold tabular-nums text-fg">{inCare.length}</dd>
            </div>
            <div className="py-3 pl-3 flex flex-col gap-1">
              <dt className="text-[12px] text-fg-muted">Update due or overdue</dt>
              <dd className={`text-[16px] font-semibold tabular-nums ${overdue > 0 ? 'text-claimed-fg' : 'text-fg'}`}>
                {overdue}
              </dd>
            </div>
          </dl>

          {isStaff && !sample && myFacilityId && (
            <AvailabilitySwitch
              facilityId={myFacilityId}
              clinicName={shownClinic ?? 'Your clinic'}
              current={availabilityShown}
              onChanged={setAvailability}
              ask={ask}
            />
          )}

          {isAdmin && !sample && adminClinicsShown.length > 0 && (() => {
            const picked = adminClinicsShown.find((c) => c.id === adminClinicId) ?? adminClinicsShown[0];
            return (
              <div className="space-y-2">
                <label className="block space-y-1">
                  <span className="text-[12px] font-semibold text-fg">Clinic status (admin)</span>
                  <select
                    value={picked.id}
                    onChange={(e) => setAdminClinicId(e.target.value)}
                    className="w-full min-h-[44px] rounded-xl border border-border bg-surface text-fg text-[14px] px-3 focus:outline-none focus:ring-2 focus:ring-action"
                  >
                    {adminClinicsShown.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <AvailabilitySwitch
                  key={picked.id}
                  facilityId={picked.id}
                  clinicName={picked.name}
                  current={{ status: picked.status, setAt: picked.setAt }}
                  onChanged={(next) =>
                    setAdminClinics((list) => list.map((c) => (c.id === picked.id ? { ...c, status: next.status, setAt: next.setAt } : c)))
                  }
                  ask={ask}
                />
              </div>
            );
          })()}

          {incomingShown.length > 0 && (
            <section aria-labelledby="incoming-heading" className="space-y-2">
              <h2 id="incoming-heading" className="text-[16px] font-semibold text-fg">
                On their way to you
              </h2>
              <p className="text-[12px] text-fg-muted">
                A rescuer told {isAdmin ? 'a clinic' : 'your clinic'} they are bringing an animal. Answer so they know whether to come, then tap Animal arrived when it is there: that unlocks the rescuer&apos;s Admit button.
              </p>
              <ul className="divide-y divide-border border-y border-border">
                {incomingShown.map((i) => (
                  <li key={i.id} className="py-3">
                    <IncomingCard item={i} showClinic={isAdmin} onDone={reload} ask={ask} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {awaiting.length > 0 && (
            <section aria-labelledby="intake-heading" className="space-y-2">
              <h2 id="intake-heading" className="text-[16px] font-semibold text-fg">
                Waiting for intake
              </h2>
              <p className="text-[12px] text-fg-muted">
                A rescuer brought these here. Confirm the animal arrived, or say you can&apos;t take it so the rescuer
                can choose another clinic.
              </p>
              <ul className="divide-y divide-border border-y border-border">
                {awaiting.map((c) => (
                  <li key={c.id} className="py-3 space-y-2">
                    <p className="text-[14px] font-semibold text-fg">
                      {c.animal} <span className="font-mono text-[12px] text-fg-muted">#{c.shortId}</span>
                    </p>
                    <p className="text-[12px] text-fg-muted">
                      {c.type}
                      {isAdmin ? ` · ${c.clinicName}` : ''}
                      {c.updates[0] ? ` · brought ${formatDate(c.updates[0].createdAt)}` : ''}
                    </p>
                    <IntakeActions c={c} onDone={reload} ask={ask} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="in-care-heading" className="space-y-2">
            <h2 id="in-care-heading" className="text-[16px] font-semibold text-fg">
              In care
            </h2>
            {inCare.length === 0 ? (
              <div className="space-y-3">
              <StageWeave blank className="w-32" />
              <p className="text-[14px] text-fg-muted">
                No animals in care right now. Cases appear here when a rescuer admits one to{' '}
                {isAdmin ? 'a Listed clinic' : 'your clinic'}.
              </p>
              </div>
            ) : (
              <ul className="divide-y divide-border border-y border-border">
                {inCare.map(({ c, clock }) => (
                  <li key={c.id} className="py-3 space-y-2">
                    <CaseSummary c={c} clock={clock} showClinic={isAdmin} />
                    <AnimalLinks c={c} onSaved={reload} />
                    {openId === c.id ? (
                      <UpdateForm c={c} onCancel={() => setOpenId(null)} onPosted={reload} />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setOpenId(c.id)}
                        className="w-full min-h-[44px] rounded-xl border border-border bg-surface hover:bg-surface-muted text-fg font-semibold text-[14px] cursor-pointer"
                      >
                        Post recovery update
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {released.length > 0 && (
            <section aria-labelledby="released-heading" className="space-y-2">
              <h2 id="released-heading" className="text-[16px] font-semibold text-fg">
                Past cases ({released.length})
              </h2>
              <p className="text-[12px] text-fg-muted">Animals that finished their recovery here, newest first. Open one to read its whole story.</p>
              <ul className="divide-y divide-border border-y border-border">
                {released.map((c) => (
                  <li key={c.id} className="py-3 space-y-1">
                    <p className="text-[14px] font-semibold text-fg">
                      {c.animalName ? `${c.animalName} · ${c.animal}` : c.animal}{' '}
                      <span className="font-mono text-[12px] text-fg-muted">#{c.shortId}</span>
                    </p>
                    <p className="text-[12px] text-fg-muted">
                      {c.type}
                      {isAdmin ? ` · ${c.clinicName}` : ''}
                      {lastUpdateAt(c) ? ` · released ${formatWhen(lastUpdateAt(c)!)}` : ' · released'}
                    </p>
                    {c.updates[0] && <p className="text-[12px] text-fg-muted">{c.updates[0].notes}</p>}
                    {!c.id.startsWith('sample-') && (
                      <Link href={`/animal/${c.id}`} className="min-h-[44px] inline-flex items-center text-[14px] font-semibold text-link underline underline-offset-4">
                        Read the story
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
      </fieldset>
      {confirmSheet}
    </div>
  );
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-5 border border-border space-y-2">
      <p className="text-[14px] font-semibold text-fg">{title}</p>
      {children}
    </div>
  );
}

function CaseSummary({ c, clock, showClinic }: { c: CareCase; clock: FacilityClockStatus; showClinic: boolean }) {
  const latest = c.updates[0];
  return (
    <div className="space-y-1.5">
      <div className="min-w-0">
        <p className="text-[14px] font-semibold text-fg">
          {c.animalName ? `${c.animalName} · ${c.animal}` : c.animal}{' '}
          <span className="font-mono text-[12px] text-fg-muted">#{c.shortId}</span>
        </p>
        <p className="text-[12px] text-fg-muted">
          {CARE_STATE_LABELS[c.state]} · {c.type}
          {showClinic ? ` · ${c.clinicName}` : ''}
        </p>
      </div>
      <p className={`text-[12px] font-bold ${clock.status === 'active' ? 'text-healing-fg' : 'text-claimed-fg'}`}>
        {clock.status === 'alert' ? 'Update overdue · welfare check' : clock.badgeText}
      </p>
      <DayWeave elapsedDays={clock.elapsedDays} />
      {latest && (
        <p className="text-[12px] text-fg-muted">
          <span className="font-semibold text-fg">Last update {formatWhen(latest.createdAt)}:</span> {latest.notes}
        </p>
      )}
    </div>
  );
}

// The clinic sets Open / Emergencies only / Full. Rescuers see it when choosing where to go; it expires after
// 12 hours so a forgotten "Full" never blocks the clinic for long. Self-reported, never verified.
function AvailabilitySwitch({
  facilityId,
  clinicName,
  current,
  onChanged,
  ask,
}: {
  facilityId: string;
  clinicName: string;
  current: { status: string | null; setAt: string | null };
  onChanged: (next: { status: string | null; setAt: string | null }) => void;
  ask: Ask;
}) {
  const [error, setError] = useState<string | null>(null);
  const effective = effectiveAvailability(current.status, current.setAt);
  const options: { value: ClinicStatus; label: string; effect: string }[] = [
    { value: 'open', label: 'Open', effect: 'Rescuers see your clinic as open and may bring animals here.' },
    { value: 'limited', label: 'Emergencies only', effect: 'Rescuers see your clinic as taking emergencies only.' },
    {
      value: 'full',
      label: 'Full',
      effect:
        'Rescuers are sent to other clinics for the next 12 hours, or until you change it. An animal already on its way can still be admitted.',
    },
  ];

  const choose = (option: (typeof options)[number]) =>
    ask({
      title: `Set ${clinicName} to “${option.label}”?`,
      message: option.effect,
      confirmLabel: `Yes, set to ${option.label}`,
      onConfirm: async () => {
        setError(null);
        const { data, error: rpcError } = await appRpc('set_clinic_availability', {
          p_facility_id: facilityId,
          p_status: option.value,
        });
        if (rpcError || !data?.success) {
          setError(data?.error || rpcError?.message || 'Could not change the status. Please try again.');
          return;
        }
        onChanged({ status: option.value, setAt: new Date().toISOString() });
      },
    });

  return (
    <section aria-labelledby="availability-heading" className="space-y-2">
      <h2 id="availability-heading" className="text-[16px] font-semibold text-fg">
        Can you take animals right now?
      </h2>
      <div role="radiogroup" aria-labelledby="availability-heading" className="grid grid-cols-3 gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={effective === o.value}
            onClick={() => effective !== o.value && choose(o)}
            className={`min-h-[48px] px-2 rounded-xl border text-[14px] cursor-pointer ${
              effective === o.value ? 'border-fg bg-surface-muted font-semibold text-fg' : 'border-border bg-surface text-fg-muted'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      <p className="text-[12px] text-fg-muted">
        {availabilityNote(current.status, current.setAt)}. A status expires after 12 hours; confirm it again if it still applies.
        Shown to rescuers as reported by you, not verified. Currently: {CLINIC_STATUS_LABELS[effective].toLowerCase()}.
      </p>
      {error && <InlineError>{error}</InlineError>}
    </section>
  );
}

// Tell the rescuer at once (a push) that the clinic answered or confirmed the animal arrived. The server checks that it is true.
// The demo shows it on screen instead.
function tellRescuer(reportId: string) {
  if (isDemoOn()) return;
  fetch('/api/push/clinic-answer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reportId }) }).catch(() => {});
}

// A rescuer says they are bringing an animal. The clinic answers; the rescuer is told right away.
function IncomingCard({ item, showClinic, onDone, ask }: { item: Incoming; showClinic: boolean; onDone: () => void; ask: Ask }) {
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const respond = (response: 'expecting' | 'cannot') =>
    ask({
      title: response === 'expecting' ? `Expecting ${item.animal.toLowerCase()} #${item.shortId}?` : `Can’t take #${item.shortId} now?`,
      message:
        response === 'expecting'
          ? 'The rescuer is told your clinic is expecting them, and keeps coming.'
          : 'The rescuer is told right away and picks another clinic. Use this only if you truly cannot take the animal.',
      confirmLabel: response === 'expecting' ? 'Yes, we are expecting it' : 'Yes, we cannot take it',
      onConfirm: async () => {
        setError(null);
        const { data, error: rpcError } = await appRpc('respond_to_heads_up', {
          p_report_id: item.id,
          p_response: response,
          p_note: response === 'cannot' ? note.trim() || null : null,
        });
        if (rpcError || !data?.success) {
          setError(data?.error || rpcError?.message || 'Something went wrong. Please try again.');
          return;
        }
        tellRescuer(item.id);
        onDone();
      },
    });

  // The clinic says the animal is physically here. This is what unlocks the rescuer's Admit button.
  const confirmArrived = () =>
    ask({
      title: `Confirm that #${item.shortId} is at ${showClinic ? item.clinicName : 'your clinic'}?`,
      message: 'Only confirm once the animal is really here. The rescuer can then mark it admitted, and its 14-day care clock starts.',
      confirmLabel: 'Yes, the animal is here',
      onConfirm: async () => {
        setError(null);
        const { data, error: rpcError } = await appRpc('clinic_confirm_received', { p_report_id: item.id });
        if (rpcError || !data?.success) {
          setError(data?.error || rpcError?.message || 'Something went wrong. Please try again.');
          return;
        }
        tellRescuer(item.id);
        onDone();
      },
    });

  const secondary =
    'min-h-[44px] px-4 rounded-xl border border-border bg-surface hover:bg-surface-muted text-fg font-semibold text-[14px] cursor-pointer';

  return (
    <div className="space-y-2">
      <p className="text-[14px] font-semibold text-fg">
        {item.animal} <span className="font-mono text-[12px] text-fg-muted">#{item.shortId}</span>
      </p>
      <p className="text-[12px] text-fg-muted">
        {item.type}
        {showClinic ? ` · ${item.clinicName}` : ''}
        {item.etaMinutes ? ` · about ${item.etaMinutes} min away` : ''}
        {item.headsUpAt ? ` · told ${formatDate(item.headsUpAt)}` : ''}
      </p>
      {/* Once the clinic said it is expecting the volunteer, it can follow them here until it confirms the animal arrived */}
      {item.response === 'expecting' && !item.receivedAt && item.clinicLat != null && item.clinicLng != null && (
        <RescuerCard perspective="clinic" reportId={item.id} scene={{ lat: item.clinicLat, lng: item.clinicLng }} />
      )}
      {item.receivedAt ? (
        <p role="status" className="text-[12px] font-semibold text-healing-fg">
          You confirmed the animal arrived. Waiting for the rescuer to mark it admitted.
        </p>
      ) : (
        <div className="space-y-2">
        {item.response === 'expecting' ? (
          <p className="text-[12px] font-semibold text-healing-fg">You told the rescuer you are expecting it.</p>
        ) : (
          <div className="space-y-2">
            <label className="block space-y-1">
              <span className="text-[12px] text-fg-muted">If you cannot take it, say why (optional, shown to the rescuer)</span>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={300}
                className="w-full min-h-[44px] rounded-xl border border-border bg-surface text-fg text-[14px] px-3 focus:outline-none focus:ring-2 focus:ring-action"
              />
            </label>
            <div className="flex gap-2">
              <button type="button" onClick={() => respond('expecting')} className={`flex-1 ${secondary}`}>
                Expecting it
              </button>
              <button type="button" onClick={() => respond('cannot')} className={secondary}>
                Can&apos;t take it now
              </button>
            </div>
          </div>
        )}
          <button
            type="button"
            onClick={confirmArrived}
            className="w-full min-h-[48px] rounded-xl bg-action text-action-fg font-semibold text-[14px] cursor-pointer"
          >
            Animal arrived
          </button>
        </div>
      )}
      {error && <InlineError>{error}</InlineError>}
    </div>
  );
}

// Open the animal's own page, and give it a name ("Bob") once the clinic knows it
function AnimalLinks({ c, onSaved }: { c: CareCase; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(c.animalName ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { data, error: rpcError } = await appRpc('set_animal_name', { p_report_id: c.id, p_name: name.trim() });
    setBusy(false);
    if (rpcError || !data?.success) {
      setError(data?.error || rpcError?.message || 'Could not save the name. Please try again.');
      return;
    }
    setEditing(false);
    onSaved();
  };

  const link =
    'min-h-[44px] px-4 inline-flex items-center rounded-xl border border-border bg-surface hover:bg-surface-muted text-fg font-semibold text-[14px] cursor-pointer';

  return (
    <div className="space-y-2">
      {editing ? (
        <form onSubmit={save} className="flex gap-2 items-end">
          <label className="flex-1 space-y-1">
            <span className="text-[12px] font-semibold text-fg">Animal&apos;s name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              className="w-full min-h-[44px] rounded-xl border border-border bg-surface text-fg text-[14px] px-3 focus:outline-none focus:ring-2 focus:ring-action"
            />
          </label>
          <button type="button" onClick={() => setEditing(false)} className={link}>
            Cancel
          </button>
          <button type="submit" disabled={busy} className={`${link} disabled:opacity-50`}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          {/* Sample cases in a role preview have no page to open */}
          {!c.id.startsWith('sample-') && (
            <Link href={`/animal/${c.id}`} className={link}>
              Open {c.animalName ? `${c.animalName}’s` : 'the animal’s'} page
            </Link>
          )}
          <button type="button" onClick={() => setEditing(true)} className={link}>
            {c.animalName ? 'Change name' : 'Give it a name'}
          </button>
        </div>
      )}
      {error && <InlineError>{error}</InlineError>}
    </div>
  );
}

function IntakeActions({ c, onDone, ask }: { c: CareCase; onDone: () => void; ask: Ask }) {
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: 'confirm_intake' | 'decline_admission') => {
    setBusy(true);
    setError(null);
    const args = fn === 'confirm_intake' ? { p_report_id: c.id } : { p_report_id: c.id, p_reason: reason.trim() };
    const { data, error: rpcError } = await appRpc(fn, args);
    setBusy(false);
    if (rpcError || !data?.success) {
      setError(data?.error || rpcError?.message || 'Something went wrong. Please try again.');
      return;
    }
    onDone();
  };

  const secondary =
    'min-h-[44px] px-4 rounded-xl border border-border bg-surface hover:bg-surface-muted text-fg font-semibold text-[14px] cursor-pointer disabled:opacity-50';

  return (
    <div className="space-y-2">
      {declining ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask({
              title: `Send #${c.shortId} back to the rescuer?`,
              message: 'The rescuer is told right away and picks another clinic. Use this only if the clinic truly cannot take the animal.',
              confirmLabel: 'Yes, send it back',
              onConfirm: () => run('decline_admission'),
            });
          }}
          className="space-y-2 rounded-xl bg-surface-muted p-3"
        >
          <label className="block space-y-1">
            <span className="text-[12px] font-semibold text-fg">Why can&apos;t the clinic take it? (shown to the rescuer)</span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={300}
              rows={2}
              required
              className="w-full rounded-xl border border-border bg-surface text-fg text-[14px] p-3 focus:outline-none focus:ring-2 focus:ring-action"
            />
          </label>
          <div className="flex gap-2">
            <button type="button" onClick={() => setDeclining(false)} className={secondary}>
              Back
            </button>
            <button type="submit" disabled={busy || reason.trim().length < 3} className={`flex-1 ${secondary}`}>
              {busy ? 'Sending…' : 'Send back to the rescuer'}
            </button>
          </div>
        </form>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() =>
              ask({
                title: `Confirm that #${c.shortId} arrived?`,
                message: 'The case moves into your care. The recovery timeline starts and you owe an update within 14 days.',
                confirmLabel: 'Yes, it arrived',
                onConfirm: () => run('confirm_intake'),
              })
            }
            disabled={busy}
            className="flex-1 min-h-[48px] rounded-xl bg-action text-action-fg font-semibold text-[14px] cursor-pointer disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Animal arrived'}
          </button>
          <button type="button" onClick={() => setDeclining(true)} disabled={busy} className={secondary}>
            Can&apos;t accept
          </button>
        </div>
      )}
      {error && <InlineError>{error}</InlineError>}
    </div>
  );
}

function UpdateForm({ c, onCancel, onPosted }: { c: CareCase; onCancel: () => void; onPosted: () => void }) {
  // Healing never goes back to admitted; the database enforces the same rule
  const options: CareState[] = c.state === 'healing' ? ['healing', 'resolved'] : ['admitted', 'healing', 'resolved'];
  const [state, setState] = useState<CareState>(c.state);
  const [notes, setNotes] = useState('');
  const [treatment, setTreatment] = useState('');
  const [medication, setMedication] = useState('');
  const [weight, setWeight] = useState('');
  const [nextCheckup, setNextCheckup] = useState('');
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const field = 'w-full min-h-[44px] rounded-xl border border-border bg-surface text-fg text-[14px] px-3 focus:outline-none focus:ring-2 focus:ring-action';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Every update is documented: a camera photo, treatment, medication ("None" is fine) and weight. The database checks too.
    const details = { treatment, medication, weight_kg: weight, next_checkup_on: nextCheckup || null };
    const problem = requiredDocsError(details, !!photo) ?? detailsError(details);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    let photoPath: string;
    try {
      photoPath = await prepareRecoveryPhoto(c.id, photo as Blob);
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : 'Could not prepare the photo.');
      return;
    }
    const { data, error: rpcError } = await appRpc('post_recovery_update', {
      p_report_id: c.id,
      p_notes: notes.trim(),
      p_state: state,
      p_photo_path: photoPath,
      p_treatment: treatment.trim(),
      p_medication: medication.trim(),
      p_weight_kg: Number(weight),
      p_next_checkup_on: nextCheckup || null,
    });
    setBusy(false);
    if (rpcError || !data?.success) {
      setError(data?.error || rpcError?.message || 'Could not post the update. Please try again.');
      return;
    }
    onPosted();
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-3 rounded-xl bg-surface-muted p-3">
      <fieldset className="space-y-2">
        <legend className="text-[12px] font-semibold text-fg">Status</legend>
        <div className="flex flex-wrap gap-2">
          {options.map((s) => (
            <label
              key={s}
              className={`min-h-[44px] px-3 inline-flex items-center gap-2 rounded-xl border text-[14px] cursor-pointer ${
                state === s ? 'border-fg text-fg font-semibold bg-surface' : 'border-border text-fg-muted bg-surface'
              }`}
            >
              <input
                type="radio"
                name={`state-${c.id}`}
                value={s}
                checked={state === s}
                onChange={() => setState(s)}
                className="accent-[var(--action)]"
              />
              {s === c.state ? `Still ${CARE_STATE_LABELS[s].toLowerCase()}` : CARE_STATE_LABELS[s]}
            </label>
          ))}
        </div>
      </fieldset>

      <LiveCameraCapture onChange={setPhoto} disabled={busy} />

      <label className="block space-y-1">
        <span className="text-[12px] font-semibold text-fg">How is the animal doing? (5–500 characters, required)</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          minLength={5}
          maxLength={500}
          required
          rows={3}
          className="w-full rounded-xl border border-border bg-surface text-fg text-[14px] p-3 focus:outline-none focus:ring-2 focus:ring-action"
        />
      </label>
      <label className="block space-y-1">
        <span className="text-[12px] font-semibold text-fg">Treatment given (required)</span>
        <input value={treatment} onChange={(e) => setTreatment(e.target.value)} maxLength={200} required placeholder="Cast on left front leg" className={field} />
      </label>
      <label className="block space-y-1">
        <span className="text-[12px] font-semibold text-fg">Medication (required, write “None” if there was none)</span>
        <input value={medication} onChange={(e) => setMedication(e.target.value)} maxLength={200} required placeholder="Amoxicillin, twice a day" className={field} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block space-y-1">
          <span className="text-[12px] font-semibold text-fg">Weight in kg (required)</span>
          <input value={weight} onChange={(e) => setWeight(e.target.value)} inputMode="decimal" required placeholder="7.5" className={field} />
        </label>
        <label className="block space-y-1">
          <span className="text-[12px] font-semibold text-fg">Next check-up (optional)</span>
          <input type="date" value={nextCheckup} onChange={(e) => setNextCheckup(e.target.value)} className={field} />
        </label>
      </div>
      <p className="text-[12px] text-fg-muted">Shown on the animal’s public story. Do not include names or phone numbers of people. Posted updates cannot be edited.</p>
      {state === 'resolved' && (
        <p className="text-[12px] text-fg-muted">Marks the case resolved: released, adopted, or returned. This closes it.</p>
      )}
      {error && (
        <p role="alert" className="text-[12px] font-semibold text-fg">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="min-h-[44px] px-4 rounded-xl border border-border bg-surface hover:bg-surface-muted text-fg font-semibold text-[14px] cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy || notes.trim().length < 5}
          className="flex-1 min-h-[48px] rounded-xl bg-action text-action-fg font-semibold text-[14px] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? 'Posting…' : 'Post update'}
        </button>
      </div>
    </form>
  );
}
