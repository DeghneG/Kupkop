'use client';

import React, { useState, useEffect } from 'react';
import { Phone, Clock, MapPin, HeartPulse, AlertCircle, ShieldAlert } from 'lucide-react';
import { useUserPosition } from '@/lib/useUserPosition';
import { useIsMounted } from '@/lib/storage';
import { distanceKm, formatDistance } from '@/lib/sos/utils';
import { calculateFacilityInactivity, FacilityClockStatus } from '@/lib/sos/escalation';
import { createClient } from '@/lib/supabase/client';

interface FacilityItem {
  id: string;
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
  status: 'Listed';
  lastActiveAt: string;
  admittedCount?: number;
}

const initialFacilities: FacilityItem[] = [
  {
    id: 'fac-1',
    name: 'Test Clinic A (Katipunan)',
    address: 'Katipunan Ave, Quezon City',
    latitude: 14.6391,
    longitude: 121.0766,
    status: 'Listed',
    lastActiveAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    admittedCount: 2,
  },
  {
    id: 'fac-2',
    name: 'Test Clinic B (New Manila)',
    address: 'E. Rodriguez Sr. Ave, New Manila',
    latitude: 14.6225,
    longitude: 121.0331,
    status: 'Listed',
    lastActiveAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    admittedCount: 1,
  },
  {
    id: 'fac-3',
    name: 'Test Clinic C (Aurora Blvd)',
    address: 'Aurora Blvd near Broadway',
    latitude: 14.6128,
    longitude: 121.0287,
    status: 'Listed',
    lastActiveAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
    admittedCount: 1,
  },
  {
    id: 'fac-4',
    name: 'Test Shelter D (Kamias)',
    address: 'Kamias Rd near Anonas',
    latitude: 14.6262,
    longitude: 121.0546,
    status: 'Listed',
    lastActiveAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    admittedCount: 0,
  },
];

export default function FacilitiesPage() {
  const [facilities, setFacilities] = useState<FacilityItem[]>(initialFacilities);
  const [notification, setNotification] = useState<string | null>(null);
  const userPosition = useUserPosition();
  const mounted = useIsMounted();

  useEffect(() => {
    const fetchFacilities = async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('facilities')
          .select('*')
          .order('name');

        if (!error && data && data.length > 0) {
          const liveFacs: FacilityItem[] = data.map((f) => ({
            id: f.id,
            name: f.name,
            address: f.address,
            latitude: f.latitude,
            longitude: f.longitude,
            status: 'Listed',
            lastActiveAt: f.last_active_at || f.created_at || new Date().toISOString(),
          }));

          setFacilities(liveFacs);
        }
      } catch (err) {
        console.warn('Could not load live facilities from Supabase:', err);
      }
    };

    fetchFacilities();
  }, []);

  const showDisabledCallNotice = (clinicName: string) => {
    setNotification(`Test mode: calls to ${clinicName} disabled.`);
    setTimeout(() => setNotification(null), 3000);
  };

  const renderClockBadge = (clock: FacilityClockStatus) => {
    switch (clock.status) {
      case 'alert':
        return (
          <span className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full text-[12px] font-semibold bg-reported-bg text-reported-fg border border-reported-fg/30 shrink-0">
            <ShieldAlert className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>{clock.badgeText}</span>
          </span>
        );
      case 'warning':
        return (
          <span className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full text-[12px] font-semibold bg-claimed-bg text-claimed-fg border border-claimed-fg/30 shrink-0">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>{clock.badgeText}</span>
          </span>
        );
      case 'active':
      default:
        return (
          <span className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full text-[12px] font-semibold bg-healing-bg text-healing-fg border border-healing-fg/30 shrink-0">
            <HeartPulse className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>{clock.badgeText}</span>
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col flex-1 px-4 pt-3 pb-6 space-y-6">
      {/* Toast Notice */}
      {notification && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-12 left-1/2 -translate-x-1/2 z-50 bg-fg text-page px-4 py-2 rounded-xl text-[12px] font-semibold shadow-lg border border-border"
        >
          {notification}
        </div>
      )}

      {/* Top Header */}
      <header className="pb-3 border-b border-border">
        <h1 className="text-[22px] font-semibold tracking-tight text-fg font-brand">Clinics</h1>
        <p className="text-[12px] text-fg-muted font-normal mt-1">
          Listed clinics must log a recovery update within 14 days of admitting an animal.
        </p>
      </header>

      <div className="space-y-3">
        {mounted && facilities.map((fac) => {
          const clock = calculateFacilityInactivity(fac.lastActiveAt);
          const percentElapsed = Math.min(100, Math.round((clock.elapsedDays / 14) * 100));

          return (
            <article
              key={fac.id}
              className="bg-surface border border-border rounded-2xl p-4 shadow-sm space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5">
                  <h2 className="text-[16px] font-semibold text-fg">
                    {fac.name}
                  </h2>
                  <div className="flex items-center gap-1 text-[12px] text-fg-muted">
                    <MapPin className="w-3.5 h-3.5 shrink-0 text-fg-muted" aria-hidden="true" />
                    <span className="font-normal">{fac.address}</span>
                  </div>
                </div>

                <span className="text-[12px] font-normal px-3 py-1 rounded-full text-fg-muted border border-border shrink-0">
                  {fac.status}
                </span>
              </div>

              {/* 14-Day Inactivity Clock */}
              <div className="pt-3 border-t border-border space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  {renderClockBadge(clock)}
                  {userPosition && fac.latitude != null && fac.longitude != null && (
                    <span className="text-[12px] text-fg-muted tabular-nums">
                      {formatDistance(distanceKm(userPosition, { lat: fac.latitude, lng: fac.longitude }))} away
                    </span>
                  )}
                </div>

                {/* Inactivity Clock 14-Day Progress Rail */}
                <div className="space-y-1">
                  <div className="w-full bg-border h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 rounded-full ${
                        clock.status === 'alert'
                          ? 'bg-reported-fg'
                          : clock.status === 'warning'
                          ? 'bg-claimed-fg'
                          : 'bg-healing-fg'
                      }`}
                      style={{ width: `${percentElapsed}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[12px] text-fg-muted">
                    <span>Day {Math.min(14, clock.elapsedDays + 1)}</span>
                    <span>14-day limit</span>
                  </div>
                </div>
              </div>

              {/* Patient Care & Action Bar */}
              <div className="pt-1 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-[12px] text-fg-muted">
                  <Clock className="w-3.5 h-3.5 shrink-0 text-fg-muted" aria-hidden="true" />
                  <span>
                    {clock.status === 'alert'
                      ? 'No updates logged for >14 days'
                      : clock.status === 'warning'
                      ? 'Welfare update needed soon'
                      : 'Active patient logs'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => showDisabledCallNotice(fac.name)}
                  aria-label={`Call ${fac.name} (disabled in test mode)`}
                  className="min-h-[44px] px-4 rounded-xl border border-border bg-surface hover:bg-surface-muted text-fg font-semibold text-[14px] flex items-center gap-2 transition-colors cursor-pointer shadow-xs active:scale-[0.98]"
                >
                  <Phone className="w-4 h-4 text-fg-muted" aria-hidden="true" />
                  <span>Call</span>
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
