'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Building2, PhoneCall, Clock, MapPin, AlertCircle } from 'lucide-react';

interface FacilityItem {
  id: string;
  name: string;
  address: string;
  distance: string;
  phone: string;
  status: 'Listed'; // Never 'Verified' per prototype rule
  lastActive: string;
  daysRemainingOnClock: number; // 14-day inactivity clock
}

const mockFacilities: FacilityItem[] = [
  {
    id: 'fac-1',
    name: 'QC Animal Care Emergency Clinic',
    address: '142 Katipunan Ave, Quezon City',
    distance: '1.1 km',
    phone: '0917-123-4567',
    status: 'Listed',
    lastActive: 'Active 2 hours ago',
    daysRemainingOnClock: 13,
  },
  {
    id: 'fac-2',
    name: 'San Roque Veterinary Haven',
    address: '88 E. Rodriguez Sr. Ave, Quezon City',
    distance: '2.4 km',
    phone: '0918-987-6543',
    status: 'Listed',
    lastActive: 'Active 3 days ago',
    daysRemainingOnClock: 11,
  },
  {
    id: 'fac-3',
    name: 'Metro Paws Rescue Station',
    address: '22 Aurora Blvd, Quezon City',
    distance: '3.7 km',
    phone: '0922-333-4455',
    status: 'Listed',
    lastActive: 'Active 12 days ago (Warning: Near 14-day limit)',
    daysRemainingOnClock: 2,
  },
];

export default function FacilitiesPage() {
  return (
    <div className="flex flex-col flex-1 px-4 py-4 min-h-[calc(100vh-80px)] space-y-4">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-white min-w-[48px] min-h-[48px]"
          aria-label="Back to Feed"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-xs font-bold">Feed</span>
        </Link>
        <div className="text-center">
          <h1 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wide">
            Partner Clinics & Shelters
          </h1>
          <p className="text-[10px] text-zinc-500">14-day activity verification</p>
        </div>
        <div className="w-10" />
      </div>

      {/* Prototype Rule Callout */}
      <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold">Prototype Policy Notice</p>
          <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5">
            Facilities are strictly labeled as &quot;Listed&quot;, never &quot;Verified&quot;. All facilities must check in within 14 days or they are automatically delisted from emergency routing.
          </p>
        </div>
      </div>

      {/* Facilities List */}
      <div className="space-y-3">
        {mockFacilities.map((fac) => {
          const isWarning = fac.daysRemainingOnClock <= 3;

          return (
            <article
              key={fac.id}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm space-y-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    {fac.name}
                  </h2>
                  <div className="flex items-center gap-1 text-xs text-zinc-500 mt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    <span>{fac.address}</span>
                  </div>
                </div>

                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 uppercase">
                  {fac.status}
                </span>
              </div>

              {/* Inactivity Clock Badge */}
              <div className="flex items-center justify-between text-xs pt-1">
                <div className="flex items-center gap-1 text-zinc-500">
                  <Clock className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="text-[11px]">{fac.lastActive}</span>
                </div>

                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                    isWarning
                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                      : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                  }`}
                >
                  {fac.daysRemainingOnClock}d left on clock
                </span>
              </div>

              {/* Call Action */}
              <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <a
                  href={`tel:${fac.phone.replace(/[^0-9]/g, '')}`}
                  className="w-full min-h-[48px] bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-transform shadow-sm"
                  aria-label={`Call ${fac.name} at ${fac.phone}`}
                >
                  <PhoneCall className="w-4 h-4" />
                  <span>CALL CLINIC ({fac.phone})</span>
                </a>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
