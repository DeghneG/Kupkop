'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Phone, MapPin, HeartPulse, AlertCircle } from 'lucide-react';
import { useUserPosition } from '@/lib/useUserPosition';
import { distanceKm, formatDistance } from '@/lib/sos/utils';
import { calculateFacilityInactivity, type FacilityClockStatus } from '@/lib/sos/escalation';
import { availabilityNote, effectiveAvailability } from '@/lib/sos/clinics';
import { createClient } from '@/lib/supabase/client';
import ScreenHeader from '@/components/ScreenHeader';
import { useDemoData, useDemoMode } from '@/lib/demo/demo';
import StageWeave from '@/components/StageWeave';

interface Clinic {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  /** Set by the clinic itself, never verified; missing before the D-042 migration */
  availability: string | null;
  availabilitySetAt: string | null;
  /** Animals this clinic is caring for now (admitted or healing) */
  inCare: number;
  /** The most overdue in-care case; null when the clinic has no animals in care */
  worstClock: FacilityClockStatus | null;
}

type CaseRow = { facility_id: string; updated_at: string; recovery_updates: { created_at: string }[] | null };

const STATUS_RANK = { alert: 0, warning: 1, active: 2 } as const;

// The 14-day clock belongs to each animal in care, counted from its newest recovery update.
// A clinic with no animals in care has no clock running, so it is never shown as inactive.
export default function FacilitiesPage() {
  const [clinics, setClinics] = useState<Clinic[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [notification, setNotification] = useState<string | null>(null);
  const userPosition = useUserPosition();
  const demoOn = useDemoMode();
  const demo = useDemoData();

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    type FacilityRow = {
      id: string;
      name: string;
      address: string;
      latitude: number;
      longitude: number;
      availability?: string | null;
      availability_set_at?: string | null;
    };
    // The status columns arrive with the D-042 migration; read the plain list before it
    const loadFacilities = async (): Promise<{ data: FacilityRow[] | null; error: { message: string } | null }> => {
      const withStatus = await supabase
        .from('facilities')
        .select('id,name,address,latitude,longitude,availability,availability_set_at')
        .eq('status', 'Listed')
        .order('name');
      if (!withStatus.error) return withStatus;
      return supabase.from('facilities').select('id,name,address,latitude,longitude').eq('status', 'Listed').order('name');
    };
    type Loaded = {
      facilities: { data: FacilityRow[] | null; error: { message: string } | null };
      cases: { data: unknown[] | null; error: { message: string } | null };
    };
    // Demo mode reads the sample clinics and their animals in care instead of the database
    const load: Promise<Loaded> = demoOn
      ? Promise.resolve({
          facilities: {
            data: demo.clinics.map((c) => ({
              id: c.id,
              name: c.name,
              address: c.address,
              latitude: c.latitude,
              longitude: c.longitude,
              availability: c.availability,
              availability_set_at: c.availability_set_at,
            })),
            error: null,
          },
          cases: {
            data: demo.reports
              .filter((r) => (r.state === 'admitted' || r.state === 'healing') && r.facility_id)
              .map((r) => ({
                facility_id: r.facility_id,
                updated_at: r.updated_at,
                recovery_updates: demo.updates.filter((u) => u.report_id === r.id).map((u) => ({ created_at: u.created_at })),
              })),
            error: null,
          },
        })
      : Promise.all([
          loadFacilities(),
          supabase
            .from('sos_reports')
            .select('facility_id,updated_at,recovery_updates(created_at)')
            .in('state', ['admitted', 'healing'])
            .not('facility_id', 'is', null),
        ]).then(([facilities, cases]) => ({ facilities, cases }));
    load.then(({ facilities, cases }) => {
      if (!active) return;
      if (facilities.error || cases.error) {
        console.error('Could not load clinics:', facilities.error?.message ?? cases.error?.message);
        setLoadError(true);
        return;
      }
      setLoadError(false);

      const clocksByClinic = new Map<string, FacilityClockStatus[]>();
      for (const c of (cases.data ?? []) as unknown as CaseRow[]) {
        const newest = (c.recovery_updates ?? []).map((u) => u.created_at).sort().at(-1) ?? c.updated_at;
        const list = clocksByClinic.get(c.facility_id) ?? [];
        list.push(calculateFacilityInactivity(newest));
        clocksByClinic.set(c.facility_id, list);
      }

      setClinics(
        (facilities.data ?? []).map((f) => {
          const clocks = clocksByClinic.get(f.id) ?? [];
          const worst =
            clocks.sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || b.elapsedDays - a.elapsedDays)[0] ??
            null;
          return {
            id: f.id,
            name: f.name,
            address: f.address,
            latitude: f.latitude,
            longitude: f.longitude,
            availability: f.availability ?? null,
            availabilitySetAt: f.availability_set_at ?? null,
            inCare: clocks.length,
            worstClock: worst,
          };
        })
      );
    });
    return () => {
      active = false;
    };
  }, [reloadKey, demoOn, demo]);

  const showDisabledCallNotice = (clinicName: string) => {
    setNotification(`Test mode: calls to ${clinicName} disabled.`);
    setTimeout(() => setNotification(null), 3000);
  };

  const sorted =
    clinics && userPosition
      ? [...clinics].sort(
          (a, b) =>
            distanceKm(userPosition, { lat: a.latitude, lng: a.longitude }) -
            distanceKm(userPosition, { lat: b.latitude, lng: b.longitude })
        )
      : clinics;

  return (
    <div className="flex flex-col flex-1 px-4 pt-3 pb-6 space-y-6">
      {notification && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-12 left-1/2 -translate-x-1/2 z-50 bg-fg text-page px-4 py-2 rounded-xl text-[12px] font-semibold shadow-lg border border-border"
        >
          {notification}
        </div>
      )}

      <ScreenHeader
        title="Clinics"
        subtitle="Listed clinics post a recovery update at least every 14 days for each animal in their care."
        className="-mx-4 -mt-3"
      />

      {loadError ? (
        <div role="alert" className="rounded-2xl p-6 border border-border text-center space-y-3">
          <p className="text-[14px] font-semibold text-fg">Could not load clinics</p>
          <p className="text-[12px] text-fg-muted">Check your connection and try again.</p>
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            className="min-h-[44px] px-4 rounded-xl border border-border bg-surface hover:bg-surface-muted text-fg font-semibold text-[14px] cursor-pointer"
          >
            Try again
          </button>
        </div>
      ) : sorted == null ? (
        <p role="status" className="text-[14px] text-fg-muted">
          Loading clinics…
        </p>
      ) : sorted.length === 0 ? (
        <div className="space-y-3">
          <StageWeave blank className="w-32" />
          <p className="text-[14px] text-fg-muted">No Listed clinics yet. An admin adds them.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((clinic) => (
            <article key={clinic.id} className="bg-surface -mx-4 px-4 py-4 border-y border-border space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5 min-w-0">
                  <h2 className="text-[16px] font-semibold text-fg">
                    <Link href={`/facilities/${clinic.id}`} className="underline-offset-4 hover:underline">
                      {clinic.name}
                    </Link>
                  </h2>
                  <div className="flex items-center gap-1 text-[12px] text-fg-muted">
                    <MapPin className="w-3.5 h-3.5 shrink-0 text-fg-muted" aria-hidden="true" />
                    <span className="font-normal">{clinic.address}</span>
                  </div>
                </div>
                <span className="text-[12px] font-normal px-3 py-1 rounded-full text-fg-muted border border-border shrink-0">
                  Listed
                </span>
              </div>

              <p
                className={`text-[12px] ${effectiveAvailability(clinic.availability, clinic.availabilitySetAt) === 'full' ? 'font-bold text-fg' : 'text-fg-muted'}`}
              >
                {availabilityNote(clinic.availability, clinic.availabilitySetAt)} · reported by the clinic
              </p>

              <div className="pt-3 border-t border-border flex items-center justify-between gap-3">
                <CareSummary clinic={clinic} />
                {userPosition && (
                  <span className="text-[12px] text-fg-muted tabular-nums shrink-0">
                    {formatDistance(distanceKm(userPosition, { lat: clinic.latitude, lng: clinic.longitude }))} away
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
              <Link
                href={`/facilities/${clinic.id}`}
                className="min-h-[44px] px-4 rounded-xl border border-border bg-surface hover:bg-surface-muted text-fg font-semibold text-[14px] flex items-center justify-center"
              >
                View clinic
              </Link>
              <button
                type="button"
                onClick={() => showDisabledCallNotice(clinic.name)}
                aria-label={`Call ${clinic.name} (disabled in test mode)`}
                className="min-h-[44px] px-4 rounded-xl border border-border bg-surface hover:bg-surface-muted text-fg font-semibold text-[14px] flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Phone className="w-4 h-4 text-fg-muted" aria-hidden="true" />
                <span>Call</span>
              </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function CareSummary({ clinic }: { clinic: Clinic }) {
  if (!clinic.worstClock) {
    return <span className="text-[12px] text-fg-muted">No animals in care right now</span>;
  }
  const clock = clinic.worstClock;
  const animals = `${clinic.inCare} ${clinic.inCare === 1 ? 'animal' : 'animals'} in care`;
  // Overdue reads in amber with an icon; coral is kept for emergencies and Reported cases
  if (clock.status === 'active') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-healing-fg">
        <HeartPulse className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        {animals} · updates on time
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-claimed-fg">
      <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      {animals} · {clock.status === 'alert' ? 'an update is overdue' : clock.badgeText.toLowerCase()}
    </span>
  );
}
