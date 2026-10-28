'use client';

import React, { useState, useEffect } from 'react';
import { IncidentCard, ListRowSkeleton, IncidentData } from '@/components/ListRow';
import DetailSheet from '@/components/DetailSheet';
import ActiveCaseBar from '@/components/ActiveCaseBar';
import { useProfile } from '@/lib/supabase/useProfile';
import { createClient } from '@/lib/supabase/client';
import { useUserPosition } from '@/lib/useUserPosition';
import { distanceKm, formatDistance, getDirectionalBearing } from '@/lib/sos/utils';
import { KupkopMark } from '@/components/icons/TriageGlyph';

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
    timeAgo: '32m ago',
    createdAt: new Date(Date.now() - 32 * 60 * 1000).toISOString(),
    blurred: true,
    latitude: 14.6305,
    longitude: 121.0366,
  },
];

const triageChannels = [
  { id: 'all', label: 'All' },
  { id: 'critical', label: 'Critical' },
  { id: 'fracture', label: 'Fracture' },
  { id: 'trapped', label: 'Trapped' },
  { id: 'sick', label: 'Sick / Mange' },
];

function matchesChannel(incident: IncidentData, channelId: string): boolean {
  const lowerType = incident.type.toLowerCase();
  if (channelId === 'critical') return lowerType.includes('hit') || lowerType.includes('bleed') || lowerType.includes('critical');
  if (channelId === 'fracture') return lowerType.includes('fracture') || lowerType.includes('limp');
  if (channelId === 'trapped') return lowerType.includes('trap') || lowerType.includes('drain');
  if (channelId === 'sick') return lowerType.includes('sick') || lowerType.includes('mange');
  return true;
}

export default function HomePage() {
  const [emergencies, setEmergencies] = useState<IncidentData[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [feedStatus, setFeedStatus] = useState<'loading' | 'live' | 'sample' | 'error'>('loading');
  const userPosition = useUserPosition();
  const [selectedIncident, setSelectedIncident] = useState<IncidentData | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<string>('all');
  const [activeTriggerEl, setActiveTriggerEl] = useState<HTMLElement | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [dismissedCaseId, setDismissedCaseId] = useState<string | null>(null);
  const profile = useProfile();

  useEffect(() => {
    const supabase = createClient();

    const fetchLiveReports = async () => {
      try {
        const { data, error } = await supabase
          .from('sos_reports')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          setFeedStatus((prev) => (prev === 'live' ? prev : 'error'));
          return;
        }

        if (!data || data.length === 0) {
          setEmergencies(initialEmergencies);
          setFeedStatus('sample');
          return;
        }

        {
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

            let locationStr = r.location_name || 'Pinned location';
            let descriptionStr = r.description || '';

            if (locationStr.includes(' — ')) {
              const [locPart, descPart] = locationStr.split(' — ');
              locationStr = locPart;
              if (!descriptionStr) descriptionStr = descPart;
            }

            // The SOS screen stores raw coordinates when street lookup fails; the pin is still real
            if (/^Near -?\d+\.\d+/.test(locationStr)) {
              locationStr = 'Pinned location';
            }

            return {
              id: r.id,
              shortId: r.short_id,
              animal: animalLabel,
              type: typeLabel,
              state: (r.state as IncidentData['state']) || 'reported',
              location: locationStr,
              description: descriptionStr || undefined,
              timeAgo: formatTimeAgo(r.created_at || r.server_timestamp),
              blurred: true,
              photoUrl: r.photo_url || undefined,
              latitude: r.latitude ?? undefined,
              longitude: r.longitude ?? undefined,
              claimedBy: r.claimed_by || null,
              claimedAt: r.claimed_at || null,
              createdAt: r.created_at || r.server_timestamp || null,
              facilityId: r.facility_id || null,
            };
          });

          setEmergencies(liveIncidents);
          setFeedStatus('live');
        }
      } catch (err) {
        console.error('Failed to load live reports:', err);
        setFeedStatus((prev) => (prev === 'live' ? prev : 'error'));
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
  }, [reloadKey]);

  const handleRowClick = (incident: IncidentData, e?: React.MouseEvent<HTMLElement>) => {
    if (e) {
      setActiveTriggerEl(e.currentTarget);
    }
    setActionError(null);
    setSelectedIncident(incident);
  };

  const applyUpdate = (updated: IncidentData) => {
    setEmergencies((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    // Only refresh the sheet if it is showing this case; bar actions must not open it
    setSelectedIncident((prev) => (prev?.id === updated.id ? updated : prev));
  };

  // Real reports go through the database functions, which enforce who may do what.
  // Sample incidents ("case-*") stay local-only for the prototype.
  const isLiveReport = (incident: IncidentData) => !!incident.id && !incident.id.startsWith('case-');

  const callCaseFunction = async (
    fn: 'claim_sos_report' | 'release_sos_claim' | 'admit_to_facility',
    args: Record<string, string>
  ): Promise<boolean> => {
    setActionError(null);
    const supabase = createClient();
    const { data, error } = await supabase.rpc(fn, args);
    if (error || !data?.success) {
      setActionError(data?.error || error?.message || 'Something went wrong. Please try again.');
      return false;
    }
    return true;
  };

  const handleClaimIncident = async (incident: IncidentData) => {
    if (isLiveReport(incident) && !(await callCaseFunction('claim_sos_report', { p_report_id: incident.id! }))) return;
    setDismissedCaseId(null);
    applyUpdate({ ...incident, state: 'claimed', claimedAt: new Date().toISOString(), claimedBy: profile.user?.id ?? null });
  };

  const handleReleaseClaim = async (incident: IncidentData) => {
    if (isLiveReport(incident) && !(await callCaseFunction('release_sos_claim', { p_report_id: incident.id! }))) return;
    applyUpdate({ ...incident, state: 'reported', claimedAt: null, claimedBy: null });
  };

  const handleAdmitIncident = async (incident: IncidentData, facilityId?: string) => {
    let targetFacility = facilityId;
    if (isLiveReport(incident)) {
      if (!targetFacility) {
        // TODO: replace with a facility picker; for now hand off to the first Listed facility
        const { data } = await createClient()
          .from('facilities')
          .select('id')
          .eq('status', 'Listed')
          .order('created_at')
          .limit(1)
          .maybeSingle();
        targetFacility = data?.id;
      }
      if (!targetFacility) {
        setActionError('No listed facility is available for handoff yet.');
        return;
      }
      if (!(await callCaseFunction('admit_to_facility', { p_report_id: incident.id!, p_facility_id: targetFacility }))) return;
    }
    applyUpdate({ ...incident, state: 'admitted', facilityId: targetFacility || 'fac-1' });
  };

  const filteredEmergencies = emergencies.filter((incident) => matchesChannel(incident, selectedChannel));

  // Distance and direction exist only when the device position is known
  const withDistance = (incident: IncidentData): IncidentData => {
    if (!userPosition || incident.latitude == null || incident.longitude == null) return incident;
    const target = { lat: incident.latitude, lng: incident.longitude };
    return {
      ...incident,
      distance: formatDistance(distanceKm(userPosition, target)),
      bearing: getDirectionalBearing(userPosition, target),
    };
  };

  // The signed-in user's own claimed case, kept until dismissed even after the lock expires
  const activeCase = profile.user
    ? emergencies.find(
        (incident) =>
          incident.state === 'claimed' &&
          incident.claimedBy === profile.user?.id &&
          incident.id !== dismissedCaseId
      ) ?? null
    : null;

  const openCount = emergencies.filter((incident) => incident.state === 'reported').length;
  const showCounts = feedStatus === 'live' || feedStatus === 'sample';

  return (
    <div className={`flex flex-col flex-1 pt-4 ${activeCase ? 'pb-56' : 'pb-6'}`}>
      <header className="flex items-center justify-between gap-3 px-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-fg flex items-center justify-center shrink-0">
            <KupkopMark size={22} className="text-page" />
          </div>
          <div className="min-w-0">
            <h1 className="text-[22px] font-semibold tracking-tight leading-none text-fg font-brand">
              KupKop
            </h1>
            <p className="text-[12px] text-fg-muted mt-1 truncate">Street animal emergency network</p>
          </div>
        </div>
        {showCounts && (
          <span className="inline-flex items-center gap-2 text-[12px] font-semibold text-fg-muted shrink-0">
            <span
              className={`w-2 h-2 rounded-full ${feedStatus === 'live' ? 'bg-action' : 'bg-fg-muted'}`}
              aria-hidden="true"
            />
            {feedStatus === 'live' ? 'Live' : 'Sample data'}
          </span>
        )}
      </header>

      <section aria-labelledby="nearby-heading" className="mt-6">
        <div className="flex items-baseline justify-between gap-3 px-4">
          <h2 id="nearby-heading" className="text-[16px] font-semibold text-fg tracking-tight">
            Nearby cases
          </h2>
          {showCounts && (
            <span className="text-[12px] text-fg-muted tabular-nums">
              {openCount} need {openCount === 1 ? 'a rescuer' : 'rescuers'}
            </span>
          )}
        </div>

        {/* Filters: underlined text tabs with live counts, scrollable at narrow widths */}
        <div
          role="group"
          aria-label="Filter by emergency type"
          className="mt-2 flex items-center gap-5 overflow-x-auto no-scrollbar px-4 border-b border-border"
        >
          {triageChannels.map((channel) => {
            const isActive = selectedChannel === channel.id;
            const count = emergencies.filter((incident) => matchesChannel(incident, channel.id)).length;
            return (
              <button
                key={channel.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => setSelectedChannel(channel.id)}
                className={`relative h-11 flex items-center gap-1.5 shrink-0 whitespace-nowrap text-[14px] cursor-pointer transition-colors ${
                  isActive ? 'text-fg font-semibold' : 'text-fg-muted hover:text-fg'
                }`}
              >
                {channel.label}
                {showCounts && (
                  <span className="text-[12px] font-normal text-fg-muted tabular-nums">{count}</span>
                )}
                <span
                  aria-hidden="true"
                  className={`absolute left-0 right-0 -bottom-px h-0.5 rounded-full bg-fg origin-center transition-transform duration-200 ease-out motion-reduce:transition-none ${
                    isActive ? 'scale-x-100' : 'scale-x-0'
                  }`}
                />
              </button>
            );
          })}
        </div>

        {feedStatus === 'sample' && (
          <p className="px-4 pt-3 text-[12px] text-fg-muted">
            These are sample cases. Real reports replace them as soon as one is filed.
          </p>
        )}

        <div className="flex flex-col divide-y divide-border border-b border-border">
          {feedStatus === 'loading' ? (
            <ListRowSkeleton />
          ) : feedStatus === 'error' ? (
            <div role="alert" className="mx-4 my-4 rounded-2xl p-6 border border-border text-center space-y-3">
              <p className="text-[14px] font-semibold text-fg">Could not load incidents</p>
              <p className="text-[12px] text-fg-muted">Check your connection and try again.</p>
              <button
                type="button"
                onClick={() => {
                  setFeedStatus('loading');
                  setReloadKey((k) => k + 1);
                }}
                className="min-h-[40px] px-4 rounded-xl border border-border bg-surface hover:bg-surface-muted text-fg font-semibold text-[14px] cursor-pointer"
              >
                Try again
              </button>
            </div>
          ) : filteredEmergencies.length === 0 ? (
            <div className="px-4 py-8 text-center space-y-3">
              <p className="text-[14px] font-semibold text-fg">No cases of this type right now</p>
              <button
                type="button"
                onClick={() => setSelectedChannel('all')}
                className="min-h-[40px] px-4 rounded-xl border border-border bg-surface hover:bg-surface-muted text-fg font-semibold text-[14px] cursor-pointer"
              >
                Show all cases
              </button>
            </div>
          ) : (
            filteredEmergencies.map((incident) => (
              <IncidentCard
                key={incident.id}
                incident={withDistance(incident)}
                onClick={() => handleRowClick(incident)}
              />
            ))
          )}
        </div>
      </section>

      {/* Active case bar: floats above the dock while the user holds a claim */}
      {activeCase && !selectedIncident && (
        <div className="fixed left-0 right-0 bottom-[calc(env(safe-area-inset-bottom,0px)+104px)] z-30 px-4 pointer-events-none">
          <div className="max-w-md mx-auto pointer-events-auto">
            <ActiveCaseBar
              incident={withDistance(activeCase)}
              error={actionError}
              onRelease={() => handleReleaseClaim(activeCase)}
              onAdmit={() => handleAdmitIncident(activeCase)}
              onClaimAgain={() => handleClaimIncident(activeCase)}
              onDismiss={() => setDismissedCaseId(activeCase.id ?? null)}
            />
          </div>
        </div>
      )}

      {/* Detail Bottom Sheet (opens on row tap) */}
      <DetailSheet
        incident={selectedIncident ? withDistance(selectedIncident) : null}
        onClose={() => setSelectedIncident(null)}
        role={profile.role}
        actionError={actionError}
        triggerElement={activeTriggerEl}
        onClaim={handleClaimIncident}
        onReleaseClaim={handleReleaseClaim}
        onAdmit={handleAdmitIncident}
      />
    </div>
  );
}
