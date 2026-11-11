'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ChevronLeft, MapPin, Navigation, Phone } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { appRpc } from '@/lib/demo/rpc';
import { useProfile } from '@/lib/supabase/useProfile';
import { animalLabel, emergencyLabel, CARE_STATE_LABELS } from '@/lib/sos/labels';
import { calculateFacilityInactivity } from '@/lib/sos/escalation';
import { availabilityNote, effectiveAvailability } from '@/lib/sos/clinics';
import { DEMO_CLINIC_ID, useDemoData, useDemoMode } from '@/lib/demo/demo';
import ScreenHeader from '@/components/ScreenHeader';
import DayWeave from '@/components/DayWeave';

type CareState = keyof typeof CARE_STATE_LABELS;

interface Clinic {
  id: string;
  name: string;
  address: string;
  phone: string;
  latitude: number;
  longitude: number;
  status: string;
  availability: string | null;
  availabilitySetAt: string | null;
  hours: string | null;
  about: string | null;
}

interface ClinicCase {
  id: string;
  shortId: string;
  animal: string;
  animalName: string | null;
  type: string;
  state: CareState;
  /** Newest recovery update, or the last change when there is none */
  lastUpdateAt: string;
}

type CaseRow = {
  id: string;
  short_id: string;
  animal_type: string | null;
  emergency_type: string | null;
  state: CareState;
  updated_at: string;
  animal_name?: string | null;
  recovery_updates: { created_at: string }[] | null;
};

const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

// One clinic's page: where it is, whether it can take animals, and the animals in its care.
// Public, like the Clinics list: it shows no reporter or rescuer details.
export default function ClinicProfile() {
  const { id } = useParams<{ id: string }>();
  const demoOn = useDemoMode();
  const demo = useDemoData();
  const [fetchedClinic, setClinic] = useState<Clinic | null | undefined>(undefined);
  const [fetchedCases, setCases] = useState<ClinicCase[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [editing, setEditing] = useState(false);
  const { realRole, role, isPreview, facilityId } = useProfile();
  // Display-only; the database function checks again that the signed-in user works at this clinic
  const canEdit = demoOn
    ? role === 'facility' && id === DEMO_CLINIC_ID
    : isPreview
      ? false
      : (realRole === 'facility' && !!facilityId && facilityId === id) || realRole === 'admin';

  useEffect(() => {
    if (!id || demoOn) return;
    let active = true;
    const supabase = createClient();
    (async () => {
      const basic = 'id,name,address,phone,latitude,longitude,status';
      const withStatus = await supabase.from('facilities').select(`${basic},availability,availability_set_at,hours,about`).eq('id', id).maybeSingle();
      const row: Record<string, unknown> | null = withStatus.error
        ? ((await supabase.from('facilities').select(basic).eq('id', id).maybeSingle()).data as Record<string, unknown> | null)
        : (withStatus.data as Record<string, unknown> | null);

      const states = ['admitted', 'healing', 'resolved'];
      const caseBasic = 'id,short_id,animal_type,emergency_type,state,updated_at,recovery_updates(created_at)';
      const withName = await supabase
        .from('sos_reports')
        .select(`${caseBasic},animal_name`)
        .eq('facility_id', id)
        .in('state', states)
        .order('updated_at', { ascending: false })
        .limit(50);
      const rows = (withName.error
        ? (
            await supabase
              .from('sos_reports')
              .select(caseBasic)
              .eq('facility_id', id)
              .in('state', states)
              .order('updated_at', { ascending: false })
              .limit(50)
          ).data
        : withName.data) as unknown as CaseRow[] | null;

      if (!active) return;
      setClinic(
        row
          ? {
              id: row.id as string,
              name: row.name as string,
              address: row.address as string,
              phone: (row.phone as string) ?? '',
              latitude: row.latitude as number,
              longitude: row.longitude as number,
              status: row.status as string,
              availability: (row.availability as string | null | undefined) ?? null,
              availabilitySetAt: (row.availability_set_at as string | null | undefined) ?? null,
              hours: (row.hours as string | null | undefined) ?? null,
              about: (row.about as string | null | undefined) ?? null,
            }
          : null
      );
      setCases(
        (rows ?? []).map((r) => ({
          id: r.id,
          shortId: r.short_id,
          animal: animalLabel(r.animal_type),
          animalName: r.animal_name ?? null,
          type: emergencyLabel(r.emergency_type),
          state: r.state,
          lastUpdateAt: (r.recovery_updates ?? []).map((u) => u.created_at).sort().at(-1) ?? r.updated_at,
        }))
      );
    })();
    return () => {
      active = false;
    };
  }, [id, demoOn, reloadKey]);

  // Demo mode reads the sample clinic and its animals instead of the database
  const demoClinic = demoOn ? demo.clinics.find((c) => c.id === id) : undefined;
  const clinic: Clinic | null | undefined = demoOn
    ? demoClinic
      ? {
          id: demoClinic.id,
          name: demoClinic.name,
          address: demoClinic.address,
          phone: demoClinic.phone,
          latitude: demoClinic.latitude,
          longitude: demoClinic.longitude,
          status: demoClinic.status,
          availability: demoClinic.availability,
          availabilitySetAt: demoClinic.availability_set_at,
          hours: demoClinic.hours ?? null,
          about: demoClinic.about ?? null,
        }
      : null
    : fetchedClinic;
  const cases: ClinicCase[] = demoOn
    ? demo.reports
        .filter((r) => r.facility_id === id && ['admitted', 'healing', 'resolved'].includes(r.state))
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
        .map((r) => ({
          id: r.id,
          shortId: r.short_id,
          animal: animalLabel(r.animal_type),
          animalName: r.animal_name,
          type: emergencyLabel(r.emergency_type),
          state: r.state as CareState,
          lastUpdateAt:
            demo.updates
              .filter((u) => u.report_id === r.id)
              .map((u) => u.created_at)
              .sort()
              .at(-1) ?? r.updated_at,
        }))
    : fetchedCases;

  const back = (
    <Link href="/facilities" className="min-h-[44px] inline-flex items-center gap-1 text-[14px] font-semibold text-link underline underline-offset-4">
      <ChevronLeft className="w-4 h-4" aria-hidden="true" />
      Back to Clinics
    </Link>
  );

  if (clinic === undefined) {
    return (
      <div className="flex flex-col flex-1 px-4 pt-3 pb-8 space-y-4">
        <ScreenHeader title="Clinic" className="-mx-4 -mt-3" />
        <p role="status" className="text-[14px] text-fg-muted">
          Loading…
        </p>
      </div>
    );
  }

  if (clinic === null) {
    return (
      <div className="flex flex-col flex-1 px-4 pt-3 pb-8 space-y-4">
        <ScreenHeader title="Clinic" className="-mx-4 -mt-3" />
        <p className="text-[14px] font-semibold text-fg">We could not find this clinic.</p>
        <p className="text-[12px] text-fg-muted">The link may be wrong, or the clinic is no longer listed.</p>
        {back}
      </div>
    );
  }

  const inCare = cases
    .filter((c) => c.state !== 'resolved')
    .map((c) => ({ c, clock: calculateFacilityInactivity(c.lastUpdateAt) }))
    .sort((a, b) => b.clock.elapsedDays - a.clock.elapsedDays);
  const released = cases.filter((c) => c.state === 'resolved').slice(0, 10);
  const due = inCare.filter(({ clock }) => clock.status !== 'active').length;
  const effective = effectiveAvailability(clinic.availability, clinic.availabilitySetAt);
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${clinic.latitude},${clinic.longitude}`;

  return (
    <div className="flex flex-col flex-1 px-4 pt-3 pb-8 space-y-6">
      {notice && (
        <div role="status" aria-live="polite" className="fixed top-12 left-1/2 -translate-x-1/2 z-50 bg-fg text-page px-4 py-2 rounded-xl text-[12px] font-semibold shadow-lg border border-border">
          {notice}
        </div>
      )}
      <ScreenHeader title={clinic.name} subtitle={clinic.status === 'Listed' ? 'Listed clinic' : `Listing ${clinic.status.toLowerCase()}`} className="-mx-4 -mt-3" />

      <section aria-label="About this clinic" className="space-y-3">
        <p className="flex items-start gap-2 text-[14px] text-fg">
          <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-fg-muted" aria-hidden="true" />
          <span>{clinic.address}</span>
        </p>
        {clinic.phone && <p className="text-[14px] text-fg tabular-nums pl-6">{clinic.phone}</p>}
        {clinic.hours && (
          <p className="text-[14px] text-fg pl-6">
            <span className="text-fg-muted">Hours: </span>
            {clinic.hours}
          </p>
        )}
        {clinic.about && <p className="text-[14px] text-fg pl-6 whitespace-pre-line">{clinic.about}</p>}
        <p className={`text-[14px] pl-6 ${effective === 'full' ? 'font-bold text-fg' : 'text-fg'}`}>
          {availabilityNote(clinic.availability, clinic.availabilitySetAt)}
        </p>
        <p className="text-[12px] text-fg-muted pl-6">Status is set by the clinic and not verified. Listed means KupKop lists it; it does not vouch for it.</p>
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={() => {
              setNotice(`Test mode: calls to ${clinic.name} disabled.`);
              setTimeout(() => setNotice(null), 3000);
            }}
            aria-label={`Call ${clinic.name} (disabled in test mode)`}
            className="min-h-[44px] px-4 rounded-xl border border-border bg-surface hover:bg-surface-muted text-fg font-semibold text-[14px] flex items-center justify-center gap-2 cursor-pointer"
          >
            <Phone className="w-4 h-4 text-fg-muted" aria-hidden="true" />
            <span>Call</span>
          </button>
          <a
            href={mapsHref}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[44px] px-4 rounded-xl border border-border bg-surface hover:bg-surface-muted text-fg font-semibold text-[14px] flex items-center justify-center gap-2"
          >
            <Navigation className="w-4 h-4 text-fg-muted" aria-hidden="true" />
            <span>Directions</span>
          </a>
        </div>

        {canEdit &&
          (editing ? (
            <ClinicDetailsForm
              clinic={clinic}
              onCancel={() => setEditing(false)}
              onSaved={() => {
                setEditing(false);
                setReloadKey((k) => k + 1);
                setNotice('Clinic details saved.');
                setTimeout(() => setNotice(null), 3000);
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="min-h-[44px] px-4 rounded-xl border border-border bg-surface hover:bg-surface-muted text-fg font-semibold text-[14px] cursor-pointer"
            >
              Edit clinic details
            </button>
          ))}
      </section>

      <dl className="grid grid-cols-3 divide-x divide-border border-y border-border">
        <div className="py-3 pr-3 flex flex-col gap-1">
          <dt className="text-[12px] text-fg-muted">In care</dt>
          <dd className="text-[16px] font-semibold tabular-nums text-fg">{inCare.length}</dd>
        </div>
        <div className="py-3 px-3 flex flex-col gap-1">
          <dt className="text-[12px] text-fg-muted">Update due</dt>
          <dd className={`text-[16px] font-semibold tabular-nums ${due > 0 ? 'text-claimed-fg' : 'text-fg'}`}>{due}</dd>
        </div>
        <div className="py-3 pl-3 flex flex-col gap-1">
          <dt className="text-[12px] text-fg-muted">Released</dt>
          <dd className="text-[16px] font-semibold tabular-nums text-fg">{cases.length - inCare.length}</dd>
        </div>
      </dl>

      <section aria-labelledby="clinic-care-heading" className="space-y-2">
        <h2 id="clinic-care-heading" className="text-[16px] font-semibold text-fg">
          Animals in care
        </h2>
        {inCare.length === 0 ? (
          <p className="text-[14px] text-fg-muted">No animals in care right now.</p>
        ) : (
          <ul className="divide-y divide-border border-y border-border">
            {inCare.map(({ c, clock }) => (
              <li key={c.id}>
                <Link href={`/animal/${c.id}`} className="block py-3 space-y-1.5 hover:bg-surface-muted -mx-4 px-4">
                  <p className="text-[14px] font-semibold text-fg">
                    {c.animalName ? `${c.animalName} · ${c.animal}` : c.animal}{' '}
                    <span className="font-mono text-[12px] text-fg-muted">#{c.shortId}</span>
                  </p>
                  <p className="text-[12px] text-fg-muted">
                    {CARE_STATE_LABELS[c.state]} · {c.type} · last update {day(c.lastUpdateAt)}
                  </p>
                  <p className={`text-[12px] font-bold ${clock.status === 'active' ? 'text-healing-fg' : 'text-claimed-fg'}`}>
                    {clock.status === 'alert' ? 'Update overdue' : clock.badgeText}
                  </p>
                  <DayWeave elapsedDays={clock.elapsedDays} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {released.length > 0 && (
        <section aria-labelledby="clinic-released-heading" className="space-y-2">
          <h2 id="clinic-released-heading" className="text-[16px] font-semibold text-fg">
            Recently released
          </h2>
          <ul className="divide-y divide-border border-y border-border">
            {released.map((c) => (
              <li key={c.id}>
                <Link href={`/animal/${c.id}`} className="block py-3 hover:bg-surface-muted -mx-4 px-4">
                  <p className="text-[14px] font-semibold text-fg">
                    {c.animalName ? `${c.animalName} · ${c.animal}` : c.animal}{' '}
                    <span className="font-mono text-[12px] text-fg-muted">#{c.shortId}</span>
                  </p>
                  <p className="text-[12px] text-fg-muted">
                    Released {day(c.lastUpdateAt)} · {c.type}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {back}
    </div>
  );
}

// Staff edit what the public sees. Name, map position and "Listed" stay with the admin.
function ClinicDetailsForm({ clinic, onCancel, onSaved }: { clinic: Clinic; onCancel: () => void; onSaved: () => void }) {
  const [address, setAddress] = useState(clinic.address);
  const [phone, setPhone] = useState(clinic.phone);
  const [hours, setHours] = useState(clinic.hours ?? '');
  const [about, setAbout] = useState(clinic.about ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const field = 'w-full min-h-[44px] px-3 rounded-xl border border-border bg-surface text-fg text-[14px]';

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    const { data, error: rpcError } = await appRpc('update_clinic_details', {
      p_facility_id: clinic.id,
      p_address: address,
      p_phone: phone,
      p_hours: hours,
      p_about: about,
    });
    setSaving(false);
    const result = data as { success?: boolean; error?: string } | null;
    if (rpcError || !result?.success) {
      setError(result?.error ?? 'Could not save. Check your connection and try again.');
      return;
    }
    onSaved();
  }

  return (
    <form onSubmit={save} className="space-y-3 pt-2" aria-label="Edit clinic details">
      <label className="block space-y-1">
        <span className="text-[12px] font-semibold text-fg">Address</span>
        <input value={address} onChange={(e) => setAddress(e.target.value)} maxLength={200} required className={field} />
      </label>
      <label className="block space-y-1">
        <span className="text-[12px] font-semibold text-fg">Phone</span>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} inputMode="tel" className={field} />
      </label>
      <label className="block space-y-1">
        <span className="text-[12px] font-semibold text-fg">Opening hours</span>
        <input value={hours} onChange={(e) => setHours(e.target.value)} maxLength={200} placeholder="Mon to Sat, 8am to 6pm" className={field} />
      </label>
      <label className="block space-y-1">
        <span className="text-[12px] font-semibold text-fg">Note for rescuers</span>
        <textarea
          value={about}
          onChange={(e) => setAbout(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder="What you can treat, what to bring, where to enter"
          className={`${field} py-2`}
        />
      </label>
      {error && (
        <p role="alert" className="text-[12px] font-semibold text-fg">
          {error}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onCancel} className="min-h-[44px] rounded-xl border border-border bg-surface text-fg font-semibold text-[14px] cursor-pointer">
          Cancel
        </button>
        <button type="submit" disabled={saving} className="min-h-[44px] rounded-xl bg-fg text-page font-semibold text-[14px] cursor-pointer disabled:opacity-60">
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
      <p className="text-[12px] text-fg-muted">Photos are not supported yet. To change the clinic’s name or map position, ask the admin.</p>
    </form>
  );
}
