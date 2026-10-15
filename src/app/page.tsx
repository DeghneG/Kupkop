'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { Camera, User } from 'lucide-react';
import { ListRow, ListRowSkeleton, EmptyIncidentsState, IncidentData } from '@/components/ListRow';
import DetailSheet from '@/components/DetailSheet';
import ProfileSheet from '@/components/ProfileSheet';
import AuthModal from '@/components/AuthModal';
import ThemeToggle from '@/components/ThemeToggle';

type MockRole = 'citizen' | 'volunteer' | 'facility' | 'admin';

const initialEmergencies: IncidentData[] = [
  {
    id: 'case-1',
    shortId: 'KK-4821',
    animal: 'Aspin Dog',
    type: 'Hit-and-run · High priority',
    state: 'reported',
    location: 'Aurora Blvd near EDSA, Cubao',
    distance: '0.8 km',
    timeAgo: '4m ago',
    blurred: true,
  },
  {
    id: 'case-2',
    shortId: 'KK-4822',
    animal: 'Puspin Kitten',
    type: 'Trapped in storm drain',
    state: 'claimed',
    location: 'E. Rodriguez Sr. Ave, New Manila',
    distance: '1.4 km',
    timeAgo: '18m ago',
    blurred: true,
  },
  {
    id: 'case-3',
    shortId: 'KK-4823',
    animal: 'Injured Puppy',
    type: 'Fracture / Limping',
    state: 'reported',
    location: 'Kamuning Rd near Tomas Morato',
    distance: '2.1 km',
    timeAgo: '32m ago',
    blurred: true,
  },
];

export default function HomePage() {
  const [emergencies] = useState<IncidentData[]>(initialEmergencies);
  const [selectedIncident, setSelectedIncident] = useState<IncidentData | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  /**
   * DEV ONLY (mock role state)
   * Note: This state is for local prototype validation only.
   * In production, role is stored in profiles.role in Supabase Postgres and approved by admin.
   * Must be removed before real auth and RLS integration.
   */
  const [mockRole, setMockRole] = useState<MockRole>('citizen');

  const profileBtnRef = useRef<HTMLButtonElement>(null);
  const [activeTriggerEl, setActiveTriggerEl] = useState<HTMLElement | null>(null);

  const handleRowClick = (incident: IncidentData, e: React.MouseEvent<HTMLElement>) => {
    setActiveTriggerEl(e.currentTarget);
    setSelectedIncident(incident);
  };

  return (
    <div className="flex flex-col flex-1 px-5 pt-3 pb-8">
      {/* 1. Brand Row */}
      <header className="flex items-center justify-between pb-1">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-accent text-accent-fg flex items-center justify-center font-bold text-[16px] shadow-sm shrink-0 font-brand">
              K
            </div>
            <h1 className="text-[22px] font-bold tracking-tight leading-none text-fg font-brand">
              KupKop
            </h1>
          </div>
          <p className="text-[12px] text-fg-muted font-normal mt-1 pl-0.5">
            Location not set
          </p>
        </div>

        {/* Header Action Controls */}
        <div className="flex items-center gap-2">
          {/* Quick Theme Toggle (Light / Dark) */}
          <ThemeToggle />

          {/* Profile Avatar Button (44px, opens Profile Sheet) */}
          <button
            ref={profileBtnRef}
            type="button"
            onClick={() => setIsProfileOpen(true)}
            className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-surface border border-border flex items-center justify-center text-fg hover:bg-surface-muted transition-colors cursor-pointer shrink-0 focus:outline-none focus:ring-2 focus:ring-accent"
            aria-label="Open profile and settings"
          >
            <User className="w-5 h-5 text-fg-muted" aria-hidden="true" />
          </button>
        </div>
      </header>

      {/* 2. Hero: NO card, NO box around it, 32px vertical space */}
      <section aria-label="Emergency Report Action" className="my-8 space-y-2.5">
        <Link
          href="/sos"
          id="hero-sos-trigger-button"
          className="w-full h-16 min-h-[64px] rounded-[20px] bg-accent hover:opacity-95 active:scale-[0.98] text-accent-fg font-semibold text-[18px] flex items-center justify-center gap-2.5 shadow-sm transition-all border-none focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <Camera className="w-6 h-6 text-accent-fg" aria-hidden="true" />
          <span>Report emergency</span>
        </Link>
        <p className="text-center text-[14px] text-fg-muted font-normal leading-normal">
          Take a live photo. We add your location and time automatically.
        </p>
      </section>

      {/* 3. Nearby Incidents Section */}
      <section aria-labelledby="nearby-heading" className="space-y-3">
        <h2 id="nearby-heading" className="text-[22px] font-semibold text-fg tracking-tight">
          Nearby
        </h2>

        {/* ONE white grouped container, rounded-2xl, soft shadow in light mode */}
        <div className="bg-surface rounded-[20px] shadow-[0_2px_12px_rgba(0,0,0,0.04)] dark:shadow-none overflow-hidden">
          {emergencies.length === 0 ? (
            <EmptyIncidentsState />
          ) : (
            emergencies.map((incident, idx) => (
              <ListRow
                key={incident.id}
                incident={incident}
                onClick={(e: any) => handleRowClick(incident, e)}
                isLast={idx === emergencies.length - 1}
              />
            ))
          )}
        </div>
      </section>

      {/* Detail Bottom Sheet (opens on row tap) */}
      <DetailSheet
        incident={selectedIncident}
        onClose={() => setSelectedIncident(null)}
        mockRole={mockRole}
        triggerElement={activeTriggerEl}
      />

      {/* Profile & Settings Bottom Sheet (opens on avatar tap) */}
      <ProfileSheet
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        mockRole={mockRole}
        onRoleChange={setMockRole}
        onOpenAuth={() => setIsAuthOpen(true)}
        triggerElement={profileBtnRef.current}
      />

      {/* Auth Modal for Magic Link / Google Sign-In */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
      />
    </div>
  );
}
