'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { calculateFacilityInactivity } from '@/lib/sos/escalation';
import { distanceKm, formatDistance, type LatLng } from '@/lib/sos/geo';

type Clinic = { id: string; name: string; address: string; latitude: number; longitude: number; lastActiveAt: string };

interface ClinicPickerProps {
  open: boolean;
  caseLabel?: string;
  near?: LatLng | null;
  busy?: boolean;
  error?: string | null;
  onPick: (facilityId: string) => void;
  onClose: () => void;
}

// Which Listed clinic received the animal. Replaces "first Listed clinic" on Admit.
export default function ClinicPicker({ open, caseLabel, near, busy, error, onPick, onClose }: ClinicPickerProps) {
  const [clinics, setClinics] = useState<Clinic[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    createClient()
      .from('facilities')
      .select('id,name,address,latitude,longitude,last_active_at')
      .eq('status', 'Listed')
      .order('name')
      .then(({ data, error: e }) => {
        if (!active) return;
        setLoadError(e ? 'Could not load clinics. Check your connection.' : null);
        setClinics(
          (data ?? []).map((f) => ({
            id: f.id,
            name: f.name,
            address: f.address,
            latitude: f.latitude,
            longitude: f.longitude,
            lastActiveAt: f.last_active_at,
          }))
        );
      });
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      active = false;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const sorted =
    clinics && near
      ? [...clinics].sort(
          (a, b) =>
            distanceKm(near, { lat: a.latitude, lng: a.longitude }) - distanceKm(near, { lat: b.latitude, lng: b.longitude })
        )
      : clinics;

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="clinic-picker-title" className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="fixed inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-sm sm:max-w-md bg-surface border-t sm:border border-border rounded-t-[24px] sm:rounded-[24px] p-4 pb-[calc(1rem+env(safe-area-inset-bottom,16px))] sm:pb-4 max-h-[85vh] flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <h2 id="clinic-picker-title" className="text-[22px] font-semibold text-fg leading-tight">
              Which clinic admitted it?
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

        <div role="radiogroup" aria-label="Listed clinics" className="overflow-y-auto divide-y divide-border -mx-2">
          {sorted == null ? (
            <p className="p-4 text-center text-[14px] text-fg-muted">Loading clinics…</p>
          ) : sorted.length === 0 ? (
            <p className="p-4 text-center text-[14px] text-fg-muted">
              {loadError ?? 'No Listed clinics yet. An admin needs to add one first.'}
            </p>
          ) : (
            sorted.map((c) => {
              const active = selected === c.id;
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
                  }`}
                >
                  <span className="flex-1 min-w-0">
                    <span className="block text-[14px] font-semibold text-fg truncate">{c.name}</span>
                    <span className="block text-[12px] text-fg-muted truncate">
                      {c.address}
                      {near ? ` · ${formatDistance(distanceKm(near, { lat: c.latitude, lng: c.longitude }))}` : ''}
                    </span>
                    {clock.status !== 'active' && (
                      <span
                        className={`block text-[12px] font-semibold ${clock.status === 'alert' ? 'text-reported-fg' : 'text-claimed-fg'}`}
                      >
                        {clock.badgeText}
                      </span>
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

        {error && (
          <p role="alert" className="text-[12px] text-reported-fg">
            {error}
          </p>
        )}
        <button
          type="button"
          disabled={!selected || busy}
          onClick={() => selected && onPick(selected)}
          className="w-full min-h-[48px] rounded-xl bg-action text-action-fg font-semibold text-[14px] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? 'Saving…' : 'Confirm admission'}
        </button>
      </div>
    </div>
  );
}
