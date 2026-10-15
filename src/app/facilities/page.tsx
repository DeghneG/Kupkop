'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Building2, Phone, Clock, MapPin } from 'lucide-react';

interface FacilityItem {
  id: string;
  name: string;
  address: string;
  distance: string;
  status: 'Listed';
  lastActive: string;
}

const mockFacilities: FacilityItem[] = [
  {
    id: 'fac-1',
    name: 'Test Clinic A',
    address: 'Katipunan Ave',
    distance: '1.1 km',
    status: 'Listed',
    lastActive: 'Active 2 hours ago',
  },
  {
    id: 'fac-2',
    name: 'Test Clinic B',
    address: 'E. Rodriguez Sr. Ave',
    distance: '2.4 km',
    status: 'Listed',
    lastActive: 'Active 3 days ago',
  },
  {
    id: 'fac-3',
    name: 'Test Clinic C',
    address: 'Aurora Blvd',
    distance: '3.7 km',
    status: 'Listed',
    lastActive: 'Active 12 days ago',
  },
];

export default function FacilitiesPage() {
  const [notification, setNotification] = useState<string | null>(null);

  const showDisabledCallNotice = () => {
    setNotification('Test mode: calls disabled.');
    setTimeout(() => setNotification(null), 3000);
  };

  return (
    <div className="flex flex-col flex-1 px-4 py-4 space-y-4">
      {/* Toast Notice */}
      {notification && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-12 left-1/2 -translate-x-1/2 z-50 bg-fg text-surface px-4 py-2 rounded-xl text-xs font-semibold shadow-md border border-border"
        >
          {notification}
        </div>
      )}

      {/* Top Header */}
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <Link
          href="/"
          className="flex items-center gap-1 text-fg-muted hover:text-fg min-w-[44px] min-h-[44px] text-[12px] font-semibold"
          aria-label="Back to Feed"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Feed</span>
        </Link>
        <div className="text-center">
          <h1 className="text-[16px] font-semibold text-fg">
            Partner Clinics
          </h1>
          <p className="text-[12px] text-fg-muted">14-day activity status</p>
        </div>
        <div className="w-11" />
      </div>

      {/* Facilities List */}
      <div className="space-y-3">
        {mockFacilities.map((fac) => (
          <article
            key={fac.id}
            className="bg-surface-card border border-border rounded-2xl p-4 shadow-sm space-y-3"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-[16px] font-semibold text-fg">
                  {fac.name}
                </h2>
                <div className="flex items-center gap-1 text-[12px] text-fg-muted mt-0.5">
                  <MapPin className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>{fac.address}</span>
                </div>
              </div>

              <span className="text-[12px] font-normal px-2.5 py-0.5 rounded-full bg-surface-muted text-fg-muted border border-border">
                {fac.status} Facility
              </span>
            </div>

            {/* Inactivity Clock Badge */}
            <div className="flex items-center justify-between text-[12px] text-fg-muted">
              <div className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>{fac.lastActive}</span>
              </div>
              <span>{fac.distance}</span>
            </div>

            {/* Call Action: Disabled in TEST MODE */}
            <div className="pt-2 border-t border-border">
              <button
                type="button"
                onClick={showDisabledCallNotice}
                aria-label={`Call ${fac.name} (disabled in test mode)`}
                className="w-full min-h-[44px] rounded-xl border border-border bg-surface-card hover:bg-surface-muted text-fg font-semibold text-[14px] flex items-center justify-center gap-2 transition-colors"
              >
                <Phone className="w-4 h-4 text-fg-muted" aria-hidden="true" />
                <span>Call Clinic</span>
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
