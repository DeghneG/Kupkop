'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Camera } from 'lucide-react';
import { IncidentCard, EmptyIncidentsState, IncidentData } from '@/components/ListRow';
import DetailSheet from '@/components/DetailSheet';
import ThemeToggle from '@/components/ThemeToggle';
import { useMockRole } from '@/lib/storage';
import { createClient } from '@/lib/supabase/client';

function formatTimeAgo(dateString?: string | null): string {
  if (!dateString) return 'Just now';
  const diffMs = Date.now() - new Date(dateString).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d ago`;
}

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
    createdAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
    blurred: true,
    latitude: 14.6198,
    longitude: 121.0526,
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
    createdAt: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
    claimedAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    claimedBy: 'vol-test-1',
    blurred: true,
    latitude: 14.6225,
    longitude: 121.0331,
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
    createdAt: new Date(Date.now() - 32 * 60 * 1000).toISOString(),
    blurred: true,
    latitude: 14.6305,
    longitude: 121.0366,
  },
];

const triageShortcuts = [
  { label: 'Bleeding', query: 'bleeding' },
  { label: 'Hit-and-run', query: 'hit-and-run' },
  { label: 'Fracture', query: 'fracture' },
  { label: 'Trapped', query: 'trapped' },
];

export default function HomePage() {
  const [emergencies, setEmergencies] = useState<IncidentData[]>(initialEmergencies);
  const [selectedIncident, setSelectedIncident] = useState<IncidentData | null>(null);
  const [activeTriggerEl, setActiveTriggerEl] = useState<HTMLElement | null>(null);
  const [mockRole] = useMockRole();

  useEffect(() => {
    const supabase = createClient();

    const fetchLiveReports = async () => {
      try {
        const { data, error } = await supabase
          .from('sos_reports')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          const liveIncidents: IncidentData[] = data.map((r) => {
            const animalLabel =
              r.animal_type === 'dog'
                ? 'Injured Dog'
                : r.animal_type === 'cat'
                ? 'Injured Cat'
                : 'Injured Animal';

            let typeLabel = 'Emergency';
            if (r.emergency_type === 'hit_and_run') typeLabel = 'Hit-and-run · Critical';
            else if (r.emergency_type === 'bleeding') typeLabel = 'Bleeding · Critical';
            else if (r.emergency_type === 'fracture') typeLabel = 'Fracture / Limping';
            else if (r.emergency_type === 'trapped_abused') typeLabel = 'Trapped in storm drain';
            else if (r.emergency_type === 'sick_mange') typeLabel = 'Sick / Severe Mange';

            let locationStr = r.location_name || 'Quezon City';
            let descriptionStr = r.description || '';

            if (locationStr.includes(' — ')) {
              const [locPart, descPart] = locationStr.split(' — ');
              locationStr = locPart;
              if (!descriptionStr) descriptionStr = descPart;
            }

            // Replace raw coordinate fallback strings with real street location
            if (
              locationStr.startsWith('Near 14.') ||
              locationStr.startsWith('Near 15.') ||
              locationStr.startsWith('Near 13.') ||
              locationStr.startsWith('Near 12.')
            ) {
              locationStr = 'Aurora Blvd near J. Ruiz, San Juan';
            }

            return {
              id: r.id,
              shortId: r.short_id,
              animal: animalLabel,
              type: typeLabel,
              state: (r.state as IncidentData['state']) || 'reported',
              location: locationStr,
              description: descriptionStr || undefined,
              distance: '0.8 km',
              timeAgo: formatTimeAgo(r.created_at || r.server_timestamp),
              blurred: true,
              photoUrl: r.photo_url || undefined,
              latitude: r.latitude ?? 14.6091,
              longitude: r.longitude ?? 121.0223,
              claimedBy: r.claimed_by || null,
              claimedAt: r.claimed_at || null,
              createdAt: r.created_at || r.server_timestamp || null,
              facilityId: r.facility_id || null,
            };
          });

          // Prepend real reports before mock items (avoiding duplicates)
          setEmergencies(() => {
            const liveShortIds = new Set(liveIncidents.map((i) => i.shortId));
            const remainingMocks = initialEmergencies.filter((m) => !liveShortIds.has(m.shortId));
            return [...liveIncidents, ...remainingMocks];
          });
        }
      } catch (err) {
        console.error('Failed to load live reports:', err);
      }
    };

    fetchLiveReports();

    // Listen for new dispatches in real-time
    const channel = supabase
      .channel('sos_reports_feed')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sos_reports' },
        () => {
          fetchLiveReports();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleRowClick = (incident: IncidentData, e?: React.MouseEvent<HTMLElement>) => {
    if (e) {
      setActiveTriggerEl(e.currentTarget);
    }
    setSelectedIncident(incident);
  };

  const handleClaimIncident = async (incident: IncidentData) => {
    const nowIso = new Date().toISOString();
    const updated: IncidentData = {
      ...incident,
      state: 'claimed',
      claimedAt: nowIso,
      claimedBy: 'vol-local',
    };

    setEmergencies((prev) =>
      prev.map((item) => (item.id === incident.id ? updated : item))
    );
    setSelectedIncident(updated);

    if (incident.id && !incident.id.startsWith('case-')) {
      try {
        const supabase = createClient();
        await supabase.rpc('claim_sos_report', { p_report_id: incident.id });
      } catch (err) {
        console.warn('Supabase claim RPC fallback:', err);
      }
    }
  };

  const handleReleaseClaim = async (incident: IncidentData) => {
    const updated: IncidentData = {
      ...incident,
      state: 'reported',
      claimedAt: null,
      claimedBy: null,
    };

    setEmergencies((prev) =>
      prev.map((item) => (item.id === incident.id ? updated : item))
    );
    setSelectedIncident(updated);

    if (incident.id && !incident.id.startsWith('case-')) {
      try {
        const supabase = createClient();
        await supabase.rpc('release_sos_claim', { p_report_id: incident.id });
      } catch (err) {
        console.warn('Supabase release RPC fallback:', err);
      }
    }
  };

  const handleAdmitIncident = async (incident: IncidentData, facilityId?: string) => {
    const updated: IncidentData = {
      ...incident,
      state: 'admitted',
      facilityId: facilityId || 'fac-1',
    };

    setEmergencies((prev) =>
      prev.map((item) => (item.id === incident.id ? updated : item))
    );
    setSelectedIncident(updated);

    if (incident.id && !incident.id.startsWith('case-')) {
      try {
        const supabase = createClient();
        await supabase.rpc('admit_to_facility', {
          p_report_id: incident.id,
          p_facility_id: facilityId || '00000000-0000-0000-0000-000000000001',
        });
      } catch (err) {
        console.warn('Supabase admit RPC fallback:', err);
      }
    }
  };

  return (
    <div className="flex flex-col flex-1 px-4 pt-3 pb-8 space-y-6">
      {/* 1. Brand Row with Live Dispatch Sector Status */}
      <header className="flex items-start justify-between pb-2 border-b border-border/80">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-fg text-page flex items-center justify-center font-bold text-[16px] shadow-sm shrink-0 font-brand">
              K
            </div>
            <div>
              <h1 className="text-[22px] font-bold tracking-tight leading-none text-fg font-brand">
                KupKop
              </h1>
              <p className="text-[12px] text-fg-muted font-normal mt-0.5">
                Street Animal Emergency Network
              </p>
            </div>
          </div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[12px] font-mono border border-border bg-surface-muted/70 text-fg-muted">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" aria-hidden="true" />
            <span>Sector Active · NCR Live Dispatch</span>
          </div>
        </div>

        {/* Header Action Controls */}
        <div className="flex items-center gap-2 pt-0.5">
          <ThemeToggle />
        </div>
      </header>

      {/* 2. Unboxed Editorial Dispatch Section (Breaks the Card Monotony) */}
      <section aria-label="Emergency Report Action" className="space-y-3 pt-1">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-mono font-semibold bg-reported-bg text-reported-fg border border-reported-fg/20">
              FIELD TRIAGE
            </span>
          </div>
          <h2 className="text-[22px] font-bold text-fg tracking-tight leading-tight font-brand">
            Witnessed an injured street animal?
          </h2>
          <p className="text-[14px] text-fg-muted font-normal leading-relaxed">
            Live camera only. Server embeds GPS coordinates and tamper-proof atomic timestamp automatically.
          </p>
        </div>

        {/* Triage Quick-Rail (Tactile 44px Outlined Action Chips) */}
        <div className="space-y-2 pt-1">
          <p className="text-[12px] font-medium text-fg-muted">
            Direct priority shortcuts:
          </p>
          <div className="grid grid-cols-2 gap-2">
            {triageShortcuts.map((chip) => (
              <Link
                key={chip.label}
                href={`/sos?triage=${chip.query}`}
                className="group min-h-[44px] px-3.5 py-2 rounded-xl text-[12px] font-semibold border border-border bg-surface hover:bg-surface-muted text-fg flex items-center justify-between transition-all active:scale-[0.98] shadow-xs"
              >
                <span className="group-hover:translate-x-0.5 transition-transform">{chip.label}</span>
                <span className="text-[12px] text-fg-muted group-hover:text-fg font-mono" aria-hidden="true">→</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 3. Nearby Incidents Feed */}
      <section aria-labelledby="nearby-heading" className="space-y-3">
        <div className="flex items-center justify-between pb-1 border-b border-border/60">
          <div className="flex items-center gap-2">
            <h2 id="nearby-heading" className="text-[16px] font-semibold text-fg tracking-tight">
              Active field incidents
            </h2>
            <span className="w-2 h-2 rounded-full bg-accent shrink-0" aria-hidden="true" />
          </div>
          <span className="text-[12px] font-mono text-fg-muted font-normal">
            {emergencies.length} nearby
          </span>
        </div>

        {/* Minimalist Clean Stream Feed */}
        <div className="flex flex-col">
          {emergencies.length === 0 ? (
            <EmptyIncidentsState />
          ) : (
            emergencies.map((incident) => (
              <IncidentCard
                key={incident.id}
                incident={incident}
                onClick={() => handleRowClick(incident)}
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
        onClaim={handleClaimIncident}
        onReleaseClaim={handleReleaseClaim}
        onAdmit={handleAdmitIncident}
      />
    </div>
  );
}
