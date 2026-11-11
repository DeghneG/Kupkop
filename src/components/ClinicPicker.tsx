'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { calculateFacilityInactivity } from '@/lib/sos/escalation';
import { availabilityNote, ARRIVAL_HOLD_NOTE, estimateEtaMinutes, rankClinics } from '@/lib/sos/clinics';
import { distanceKm, formatDistance, type LatLng } from '@/lib/sos/geo';
import { useFocusTrap } from '@/lib/useFocusTrap';
import { useConfirm } from '@/components/ConfirmSheet';
import { useDemoData, useDemoMode } from '@/lib/demo/demo';
import { appRpc } from '@/lib/demo/rpc';

type Clinic = {
  id: string;
  name: string;
  address: string;
  phone: string;
  latitude: number;
  longitude: number;
  lastActiveAt: string;
  availability: string | null;
  availabilitySetAt: string | null;
};


interface ClinicPickerProps {
  open: boolean;
  /** 'headsup': tell a clinic you are coming (while on the way). 'admit': an admin admits without the clinic's confirmation
   *  (a volunteer never sees this: they can only admit to the clinic that confirmed). */
  mode?: 'admit' | 'headsup';
  /** The clinic the rescuer already told: it is the starting choice */
  defaultFacilityId?: string | null;
  /** The real case, so the heads-up can be sent; sample cases only admit */
  reportId?: string;
  caseLabel?: string;
  near?: LatLng | null;
  /** Where the animal is: the expected drive to a clinic is measured from here (the database does the same) */
  caseLocation?: LatLng | null;
  busy?: boolean;
  error?: string | null;
  onPick: (facilityId: string) => void;
  /** The clinic was told; its answer shows on the case */
  onHeadsUpSent?: (facilityId: string, etaMinutes: number | null) => void;
  onClose: () => void;
}

// Which Listed clinic to take the animal to, and which one received it. The nearest clinic that has not
// reported itself full is suggested; full clinics stay on the list, greyed out.
export default function ClinicPicker({
  open,
  mode = 'admit',
  defaultFacilityId,
  reportId,
  caseLabel,
  near,
  caseLocation,
  busy,
  error,
  onPick,
  onHeadsUpSent,
  onClose,
}: ClinicPickerProps) {
  const [clinics, setClinics] = useState<Clinic[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [headsUpError, setHeadsUpError] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const { ask, sheet } = useConfirm();
  const demoOn = useDemoMode();
  const demo = useDemoData();
  useFocusTrap(panelRef, open);

  // Demo mode lists the sample clinics instead of reading the database
  const demoClinics = useMemo<Clinic[]>(
    () =>
      demo.clinics.map((c) => ({
        id: c.id,
        name: c.name,
        address: c.address,
        phone: c.phone,
        latitude: c.latitude,
        longitude: c.longitude,
        lastActiveAt: c.last_active_at,
        availability: c.availability,
        availabilitySetAt: c.availability_set_at,
      })),
    [demo]
  );

  useEffect(() => {
    if (!open || demoOn) return;
    let active = true;
    const supabase = createClient();
    const basic = 'id,name,address,phone,latitude,longitude,last_active_at';
    const read = async () => {
      // The status columns arrive with the D-042 migration; fall back to the plain list before it
      type FacilityRow = {
        id: string;
        name: string;
        address: string;
        phone: string;
        latitude: number;
        longitude: number;
        last_active_at: string;
        availability?: string | null;
        availability_set_at?: string | null;
      };
      const full = await supabase.from('facilities').select(`${basic},availability,availability_set_at`).eq('status', 'Listed').order('name');
      const result: { data: FacilityRow[] | null; error: unknown } = full.error
        ? await supabase.from('facilities').select(basic).eq('status', 'Listed').order('name')
        : full;
      if (!active) return;
      setLoadError(result.error ? 'Could not load clinics. Check your connection.' : null);
      setClinics(
        (result.data ?? []).map((row) => {
          return {
            id: row.id,
            name: row.name,
            address: row.address,
            phone: row.phone,
            latitude: row.latitude,
            longitude: row.longitude,
            lastActiveAt: row.last_active_at,
            availability: row.availability ?? null,
            availabilitySetAt: row.availability_set_at ?? null,
          };
        })
      );
    };
    read();
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      active = false;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, demoOn, onClose]);

  if (!open) return null;

  const clinicList = demoOn ? demoClinics : clinics;
  const ranked = clinicList ? rankClinics(clinicList, caseLocation ?? near) : null;
  // Nothing tapped yet: the suggested clinic is the starting choice
  // The clinic already told is the starting choice; otherwise the nearest one that is not full
  const chosenId =
    selected ??
    (defaultFacilityId && ranked?.some((r) => r.clinic.id === defaultFacilityId) ? defaultFacilityId : null) ??
    ranked?.find((r) => r.suggested)?.clinic.id ??
    null;
  const chosen = ranked?.find((r) => r.clinic.id === chosenId) ?? null;
  // Expected drive from the animal to the chosen clinic in Manila traffic, like a ride app's estimate. The database works out the
  // same number when the clinic is told, and the claim holds for it (plus time to hand over) once the clinic is expecting them.
  const from = caseLocation ?? near ?? null;
  const eta = chosen && from ? estimateEtaMinutes(distanceKm(from, { lat: chosen.clinic.latitude, lng: chosen.clinic.longitude })) : null;
  const allFull = !!ranked && ranked.length > 0 && !ranked.some((r) => r.usable);
  const canTell = !!reportId && !!chosen && chosen.usable;

  const askAdmit = () => {
    if (!chosen) return;
    ask({
      title: `Admit this case to ${chosen.clinic.name} without its confirmation?`,
      message: `${chosen.clinic.address}. Admin only: the clinic has not confirmed the animal arrived. The clinic is then asked to confirm, and its 14-day care clock starts when it does.`,
      confirmLabel: 'Yes, admit it here',
      cancelLabel: 'Not this clinic',
      onConfirm: () => onPick(chosen.clinic.id),
    });
  };

  const askHeadsUp = () => {
    if (!chosen || !reportId) return;
    ask({
      title: `Tell ${chosen.clinic.name} you are coming?`,
      message: `They get a notification now: the animal, what is wrong, and ${eta ? `that you should be there in about ${eta} minutes` : 'that you are on the way'}. They answer that they are expecting you, or that they cannot take it now.`,
      confirmLabel: 'Yes, tell them',
      onConfirm: async () => {
        setSending(true);
        setHeadsUpError(null);
        const { data, error: rpcError } = await appRpc('send_clinic_heads_up', {
          p_report_id: reportId,
          p_facility_id: chosen.clinic.id,
          p_eta_minutes: eta,
        });
        setSending(false);
        if (rpcError || !data?.success) {
          setHeadsUpError(data?.error || rpcError?.message || 'Could not tell the clinic. Please try again.');
          return;
        }
        onHeadsUpSent?.(chosen.clinic.id, eta);
        if (mode === 'headsup') onClose();
      },
    });
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="clinic-picker-title" className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="fixed inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
      <div ref={panelRef} className="relative z-10 w-full max-w-sm sm:max-w-md bg-surface border-t sm:border border-border rounded-t-[24px] sm:rounded-[24px] p-4 pb-[calc(1rem+env(safe-area-inset-bottom,16px))] sm:pb-4 max-h-[85vh] flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <h2 id="clinic-picker-title" className="text-[22px] font-semibold text-fg leading-tight">
              {mode === 'headsup' ? 'Which clinic are you taking it to?' : 'Which clinic admitted it?'}
            </h2>
            {caseLabel && <p className="text-[12px] text-fg-muted mt-1">{caseLabel}</p>}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-11 h-11 shrink-0 rounded-full flex items-center justify-center text-fg-muted bg-surface-muted hover:text-fg cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {allFull && (
          <p role="status" className="text-[12px] font-semibold text-fg bg-surface-muted border border-border rounded-xl px-3 py-2">
            Every listed clinic reported it is full. Call one to check before you go. Their status is set by the clinic and may be out of date.
          </p>
        )}

        <div role="radiogroup" aria-label="Listed clinics" className="overflow-y-auto divide-y divide-border -mx-2">
          {ranked == null ? (
            <p className="p-4 text-center text-[14px] text-fg-muted">Loading clinics…</p>
          ) : ranked.length === 0 ? (
            <p className="p-4 text-center text-[14px] text-fg-muted">
              {loadError ?? 'No Listed clinics yet. An admin needs to add one first.'}
            </p>
          ) : (
            ranked.map((r) => {
              const c = r.clinic;
              const active = chosenId === c.id;
              const clock = calculateFacilityInactivity(c.lastActiveAt);
              return (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setSelected(c.id)}
                  className={`w-full min-h-[44px] flex items-center gap-3 px-2 py-3 text-left rounded-lg cursor-pointer ${
                    active ? 'bg-surface-muted' : 'hover:bg-surface-muted/60'
                  } ${r.usable ? '' : 'opacity-70'}`}
                >
                  <span className="flex-1 min-w-0">
                    <span className="flex items-baseline gap-2 min-w-0">
                      <span className="block text-[14px] font-semibold text-fg truncate">{c.name}</span>
                      {r.suggested && <span className="shrink-0 text-[12px] font-bold text-healing-fg">Nearest open</span>}
                    </span>
                    <span className="block text-[12px] text-fg-muted truncate">
                      {c.address}
                      {r.distanceKm != null ? ` · ${formatDistance(r.distanceKm)}` : ''}
                    </span>
                    <span className={`block text-[12px] ${r.usable ? 'text-fg-muted' : 'font-semibold text-fg'}`}>
                      {availabilityNote(c.availability, c.availabilitySetAt)}
                      {c.phone ? ` · ${c.phone}` : ''}
                    </span>
                    {clock.status !== 'active' && (
                      <span className="block text-[12px] font-semibold text-claimed-fg">{clock.badgeText}</span>
                    )}
                  </span>
                  <span
                    aria-hidden="true"
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      active ? 'bg-action border-action text-action-fg' : 'border-border'
                    }`}
                  >
                    {active && <Check className="w-3 h-3" />}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {chosen && !chosen.usable && (
          <p className="text-[12px] text-fg-muted">
            {chosen.clinic.name} reported it is full. Choose it only if you have called and they can still take the animal.
          </p>
        )}

        {mode === 'headsup' && reportId && chosen && eta != null && (
          <p className="text-[12px] text-fg">
            <strong className="font-semibold">About {eta} min</strong> to {chosen.clinic.name} in traffic at this hour. {ARRIVAL_HOLD_NOTE}
          </p>
        )}

        {(error || headsUpError) && (
          <p role="alert" className="text-[12px] font-semibold text-fg">
            {headsUpError ?? error}
          </p>
        )}

        {mode === 'headsup' && canTell && (
          <button
            type="button"
            disabled={sending}
            onClick={askHeadsUp}
            className={`w-full rounded-xl font-semibold text-[14px] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
              mode === 'headsup'
                ? 'min-h-[48px] bg-action text-action-fg'
                : 'min-h-[44px] border border-border bg-surface hover:bg-surface-muted text-fg'
            }`}
          >
            {sending ? 'Telling the clinic…' : 'Tell this clinic I’m coming'}
          </button>
        )}
        {mode === 'admit' && (
          <button
            type="button"
            disabled={!chosen || busy}
            onClick={askAdmit}
            className="w-full min-h-[48px] rounded-xl bg-action text-action-fg font-semibold text-[14px] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? 'Saving…' : 'Confirm admission'}
          </button>
        )}
      </div>
      {sheet}
    </div>
  );
}
