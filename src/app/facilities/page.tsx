'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Phone, Clock, MapPin, HeartPulse, AlertCircle, ShieldAlert } from 'lucide-react';
import { calculateFacilityInactivity, FacilityClockStatus } from '@/lib/sos/escalation';
import { createClient } from '@/lib/supabase/client';

interface FacilityItem {
  id: string;
  name: string;
  address: string;
  distance: string;
  status: 'Listed';
  lastActiveAt: string;
  admittedCount?: number;
}

const initialFacilities: FacilityItem[] = [
  {
    id: 'fac-1',
    name: 'Test Clinic A (Katipunan)',
    address: 'Katipunan Ave, Quezon City',
    distance: '1.1 km',
    status: 'Listed',
    lastActiveAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    admittedCount: 2,
  },
  {
    id: 'fac-2',
    name: 'Test Clinic B (New Manila)',
    address: 'E. Rodriguez Sr. Ave, New Manila',
    distance: '2.4 km',
    status: 'Listed',
    lastActiveAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    admittedCount: 1,
  },
  {
    id: 'fac-3',
    name: 'Test Clinic C (Aurora Blvd)',
    address: 'Aurora Blvd near Broadway',
    distance: '3.7 km',
    status: 'Listed',
    lastActiveAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
    admittedCount: 1,
  },
  {
    id: 'fac-4',
    name: 'Test Shelter D (Kamias)',
    address: 'Kamias Rd near Anonas',
    distance: '4.2 km',
    status: 'Listed',
    lastActiveAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    admittedCount: 0,
  },
];

export default function FacilitiesPage() {
  const [facilities, setFacilities] = useState<FacilityItem[]>(initialFacilities);
  const [notification, setNotification] = useState<string | null>(null);

  useEffect(() => {
    const fetchFacilities = async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('facilities')
          .select('*')
          .order('name');

        if (!error && data && data.length > 0) {
          const liveFacs: FacilityItem[] = data.map((f, idx) => ({
            id: f.id,
            name: f.name,
            address: f.address,
            distance: `${(1.2 + idx * 0.8).toFixed(1)} km`,
            status: 'Listed',
            lastActiveAt: f.last_active_at || f.created_at || new Date().toISOString(),
            admittedCount: 1,
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
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[12px] font-semibold bg-reported-bg text-reported-fg border border-reported-fg/30 shrink-0">
            <ShieldAlert className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>{clock.badgeText}</span>
          </span>
        );
      case 'warning':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[12px] font-semibold bg-claimed-bg text-claimed-fg border border-claimed-fg/30 shrink-0">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>{clock.badgeText}</span>
          </span>
        );
      case 'active':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[12px] font-semibold bg-healing-bg text-healing-fg border border-healing-fg/30 shrink-0">
            <HeartPulse className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>{clock.badgeText}</span>
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col flex-1 px-4 py-4 space-y-4">
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
      <header className="flex items-center justify-between pb-2 border-b border-border">
        <Link
          href="/"
          className="flex items-center gap-1 text-fg-muted hover:text-fg min-w-[44px] min-h-[44px] text-[12px] font-semibold transition-colors"
          aria-label="Back to Feed"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Feed</span>
        </Link>
        <div className="text-center">
          <h1 className="text-[16px] font-semibold text-fg">
            Partner Clinics
          </h1>
          <p className="text-[12px] text-fg-muted font-normal">14-day inactivity clock tracking</p>
        </div>
        <div className="w-11" aria-hidden="true" />
      </header>

      {/* Ground Rules Notice: Labeled "Listed", never "Verified" */}
      <div className="bg-surface-muted border border-border rounded-xl p-3 space-y-1">
        <p className="text-[12px] font-semibold text-fg">
          Partner Facility Registry & Inactivity Clock
        </p>
        <p className="text-[12px] text-fg-muted font-normal leading-relaxed">
          In prototype mode, all facilities are labeled <strong>Listed</strong> (never Verified). Admitted cases must receive clinical recovery updates within 14 days or trigger an automated welfare check alert.
        </p>
      </div>

      {/* Facilities List */}
      <div className="space-y-3">
        {facilities.map((fac) => {
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

                <span className="text-[12px] font-normal px-2.5 py-0.5 rounded-full bg-surface-muted text-fg-muted border border-border shrink-0">
                  {fac.status} Facility
                </span>
              </div>

              {/* 14-Day Inactivity Clock Section */}
              <div className="bg-surface-muted/60 border border-border/80 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  {renderClockBadge(clock)}
                  <span className="font-mono text-[12px] text-fg-muted tabular-nums">
                    {fac.distance} away
                  </span>
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
                <div className="flex items-center gap-1.5 text-[12px] text-fg-muted">
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
