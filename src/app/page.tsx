'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Camera } from 'lucide-react';
import { ListRow, EmptyIncidentsState, IncidentData } from '@/components/ListRow';
import DetailSheet from '@/components/DetailSheet';
import ThemeToggle from '@/components/ThemeToggle';

type MockRole = 'citizen' | 'volunteer' | 'facility' | 'admin';

const initialEmergencies: IncidentData[] = [
  {
    id: 'case-1',
    shortId: 'KK-4821',
    animal: 'Aspin Dog',
    type: 'Hit-and-run · Critical',
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

const triageShortcuts = [
  { label: 'Bleeding', query: 'bleeding' },
  { label: 'Hit-and-run', query: 'hit-and-run' },
  { label: 'Fracture', query: 'fracture' },
  { label: 'Trapped', query: 'trapped' },
];

export default function HomePage() {
  const [emergencies] = useState<IncidentData[]>(initialEmergencies);
  const [selectedIncident, setSelectedIncident] = useState<IncidentData | null>(null);
  const [activeTriggerEl, setActiveTriggerEl] = useState<HTMLElement | null>(null);
  const [mockRole, setMockRole] = useState<MockRole>('citizen');

  // Sync mock role from prototype settings if saved
  useEffect(() => {
    try {
      const stored = localStorage.getItem('kupkop-mock-role') as MockRole | null;
      if (stored && ['citizen', 'volunteer', 'facility', 'admin'].includes(stored)) {
        setMockRole(stored);
      }
    } catch {
      // Default to citizen
    }
  }, []);

  const handleRowClick = (incident: IncidentData, e?: React.MouseEvent<HTMLElement>) => {
    if (e) {
      setActiveTriggerEl(e.currentTarget);
    }
    setSelectedIncident(incident);
  };

  return (
    <div className="flex flex-col flex-1 px-5 pt-3 pb-8 space-y-6">
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
            Street Animal Emergency Network
          </p>
        </div>

        {/* Header Action Controls */}
        <div className="flex items-center gap-2">
          {/* Quick Theme Toggle (Light / Dark) */}
          <ThemeToggle />
        </div>
      </header>

      {/* 2. Hero: Card Hero with 56px action button and quick triage shortcut chips */}
      <section aria-label="Emergency Report Action" className="bg-surface rounded-[20px] p-5 border border-border shadow-sm space-y-4">
        <div className="space-y-1">
          <h2 className="text-[16px] font-semibold text-fg tracking-tight">
            Found an injured street animal?
          </h2>
          <p className="text-[12px] text-fg-muted font-normal leading-normal">
            Take a live photo. We add GPS and server timestamp automatically.
          </p>
        </div>

        {/* 56px Primary Red Emergency Button */}
        <Link
          href="/sos"
          id="hero-sos-trigger-button"
          className="w-full min-h-[56px] rounded-xl bg-accent hover:opacity-95 active:scale-[0.98] text-accent-fg font-semibold text-[17px] flex items-center justify-center gap-2.5 shadow-sm transition-transform border-none focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <Camera className="w-5 h-5 text-accent-fg" aria-hidden="true" />
          <span>Report emergency</span>
        </Link>

        {/* Quick Triage Shortcut Chips */}
        <div className="pt-2 border-t border-border">
          <p className="text-[12px] font-normal text-fg-muted mb-2">
            Quick triage shortcuts:
          </p>
          <div className="flex flex-wrap gap-2">
            {triageShortcuts.map((chip) => (
              <Link
                key={chip.label}
                href={`/sos?triage=${chip.query}`}
                className="px-3 py-1.5 rounded-full text-[12px] font-semibold border border-border bg-surface-muted hover:bg-border/60 text-fg transition-colors"
              >
                {chip.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 3. Nearby Incidents Feed */}
      <section aria-labelledby="nearby-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 id="nearby-heading" className="text-[22px] font-semibold text-fg tracking-tight">
            Nearby
          </h2>
          <span className="text-[12px] text-fg-muted font-normal">
            {emergencies.length} active
          </span>
        </div>

        {/* ONE white/surface grouped container with soft border & shadow */}
        <div className="bg-surface rounded-[20px] border border-border shadow-sm overflow-hidden">
          {emergencies.length === 0 ? (
            <EmptyIncidentsState />
          ) : (
            emergencies.map((incident, idx) => (
              <ListRow
                key={incident.id}
                incident={incident}
                onClick={() => handleRowClick(incident)}
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
    </div>
  );
}
