'use client';

import React, { useState, useEffect } from 'react';
import { IncidentCard, ListRowSkeleton, IncidentData } from '@/components/ListRow';
import AccountButton from '@/components/AccountButton';
import DetailSheet from '@/components/DetailSheet';
import ActiveCaseBar from '@/components/ActiveCaseBar';
import { useProfile } from '@/lib/supabase/useProfile';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { useLocation } from '@/lib/useUserPosition';
import { usePullToRefresh } from '@/lib/usePullToRefresh';
import { distanceKm, formatDistance, getDirectionalBearing } from '@/lib/sos/utils';
import { KupkopMark } from '@/components/icons/TriageGlyph';
import { calculateEscalation } from '@/lib/sos/escalation';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { RotateCw } from 'lucide-react';
import { WELCOME_SEEN_KEY } from '@/lib/storage';

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

const STAGE_RANK = { alert: 0, widened: 1, standard: 2 } as const;
const TIER_RANK = { critical: 0, urgent: 1, moderate: 2 } as const;
const createdMs = (incident: IncidentData) => (incident.createdAt ? new Date(incident.createdAt).getTime() : 0);

// Most urgent first: furthest along the escalation clock, then highest tier, then oldest
function byUrgency(a: IncidentData, b: IncidentData): number {
  const ea = calculateEscalation(a.createdAt, a.type);
  const eb = calculateEscalation(b.createdAt, b.type);
  return (
    STAGE_RANK[ea.stage] - STAGE_RANK[eb.stage] ||
    TIER_RANK[ea.tier] - TIER_RANK[eb.tier] ||
    createdMs(a) - createdMs(b)
  );
}

export default function HomePage() {
  const [emergencies, setEmergencies] = useState<IncidentData[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [feedStatus, setFeedStatus] = useState<'loading' | 'live' | 'sample' | 'error'>('loading');
  const { position: userPosition, status: locationStatus, request: requestLocation } = useLocation();
  const [realtimeState, setRealtimeState] = useState<'connecting' | 'live' | 'down'>('connecting');
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<IncidentData | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<string>('all');
  const [activeTriggerEl, setActiveTriggerEl] = useState<HTMLElement | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [dismissedCaseId, setDismissedCaseId] = useState<string | null>(null);
  // Clock for relative labels; set from timers and fetches, never read during render
  const [now, setNow] = useState(0);
  const profile = useProfile();
  const router = useRouter();

  // First visit on this device while signed out: show the landing page once.
  // It offers "Report an emergency now" up top, so reporting is never blocked behind it.
  useEffect(() => {
    if (profile.loading || profile.user) return;
    try {
      if (!localStorage.getItem(WELCOME_SEEN_KEY)) router.replace('/welcome');
    } catch {
      // Storage unavailable: skip the landing page rather than show it on every visit
    }
  }, [profile.loading, profile.user, router]);

  // Re-render twice a minute so escalation labels and ordering stay current
  // (The first fetch sets `now`, so nothing is set synchronously here.)
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const supabase = createClient();

    const fetchLiveReports = async () => {
      try {
        const query = () => supabase.from('sos_reports').select('*').order('created_at', { ascending: false });
        let { data, error } = await query();

        // A stale or invalid sign-in token makes even public reads fail (PGRST301/303).
        // Refresh it once; if that fails, drop the local session so the feed loads signed out.
        if (error?.code?.startsWith('PGRST30')) {
          const { error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError) await supabase.auth.signOut({ scope: 'local' });
          ({ data, error } = await query());
        }

        if (error) {
          console.error('Failed to load live reports:', error.code, error.message);
          setFeedStatus((prev) => (prev === 'live' ? prev : 'error'));
          return;
        }

        const fetchedAt = Date.now();
        setLastUpdated(fetchedAt);
        setNow(fetchedAt);

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
      } finally {
        setRefreshing(false);
      }
    };

    // Without Supabase settings every request goes to a fake host; the feed shows a setup notice instead
    if (!isSupabaseConfigured) return;

    fetchLiveReports();

    // Listen for new dispatches in real-time; "Live" is shown only while this channel is connected
    const channel = supabase
      .channel('sos_reports_feed')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sos_reports' },
        () => {
          fetchLiveReports();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setRealtimeState('live');
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') setRealtimeState('down');
      });

    return () => {
      setRealtimeState('connecting');
      supabase.removeChannel(channel);
    };
  }, [reloadKey]);

  const refreshFeed = () => {
    setRefreshing(true);
    setReloadKey((k) => k + 1);
  };

  const pull = usePullToRefresh(refreshFeed, refreshing);

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

  // Quick claim from the feed row; on success the active case bar takes over
  const handleQuickClaim = async (incident: IncidentData) => {
    setClaimingId(incident.id);
    try {
      await handleClaimIncident(incident);
    } finally {
      setClaimingId(null);
    }
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

  const showCounts = feedStatus === 'live' || feedStatus === 'sample';
  const openCases = emergencies.filter((incident) => incident.state === 'reported');
  const inProgressCount = emergencies.filter((incident) =>
    ['claimed', 'admitted', 'healing'].includes(incident.state)
  ).length;

  // Nearest case still waiting for a rescuer; only when the device position is already known
  const nearestOpenKm = userPosition
    ? openCases.reduce<number | null>((nearest, incident) => {
        if (incident.latitude == null || incident.longitude == null) return nearest;
        const km = distanceKm(userPosition, { lat: incident.latitude, lng: incident.longitude });
        return nearest == null || km < nearest ? km : nearest;
      }, null)
    : null;

  const feedGroups = [
    {
      id: 'open',
      title: 'Needs a rescuer',
      items: filteredEmergencies.filter((incident) => incident.state === 'reported').sort(byUrgency),
    },
    {
      id: 'progress',
      title: 'In progress',
      items: filteredEmergencies
        .filter((incident) => ['claimed', 'admitted', 'healing'].includes(incident.state))
        .sort((a, b) => createdMs(b) - createdMs(a)),
    },
    {
      id: 'resolved',
      title: 'Resolved',
      items: filteredEmergencies
        .filter((incident) => incident.state === 'resolved')
        .sort((a, b) => createdMs(b) - createdMs(a)),
    },
  ].filter((group) => group.items.length > 0);

  // Responders get a Claim button on open rows; the database still decides who may claim.
  // Hidden while the user already holds a case so the bar stays the one place to act on it.
  const canQuickClaim = (profile.role === 'volunteer' || profile.role === 'admin') && !activeCase;

  const updatedLabel = (() => {
    if (lastUpdated == null) return null;
    const seconds = Math.max(0, Math.floor((now - lastUpdated) / 1000));
    if (seconds < 60) return 'Updated just now';
    const minutes = Math.floor(seconds / 60);
    return minutes < 60 ? `Updated ${minutes}m ago` : `Updated ${Math.floor(minutes / 60)}h ago`;
  })();

  const liveLabel =
    feedStatus === 'sample'
      ? 'Sample data'
      : realtimeState === 'live'
        ? 'Live'
        : realtimeState === 'down'
          ? 'Reconnecting…'
          : 'Connecting…';

  return (
    <div className={`flex flex-col flex-1 pt-4 ${activeCase ? 'pb-56' : 'pb-6'}`}>
      {/* Pull-to-refresh indicator; only this pill moves so the fixed case bar is unaffected */}
      {(pull.distance > 0 || refreshing) && (
        <div
          role="status"
          className="fixed left-0 right-0 z-40 flex justify-center pointer-events-none"
          style={{ top: 'calc(var(--banner-h, 0px) + 8px)' }}
        >
          <span
            className="inline-flex items-center gap-2 h-9 px-4 rounded-full border border-border bg-surface text-[12px] font-semibold text-fg shadow-sm"
            style={
              refreshing
                ? undefined
                : { transform: `translateY(${pull.distance - 40}px)`, opacity: Math.min(1, pull.distance / 48) }
            }
          >
            <RotateCw
              className="w-3.5 h-3.5 motion-safe:transition-transform"
              style={refreshing ? undefined : { transform: `rotate(${pull.distance * 4}deg)` }}
              aria-hidden="true"
            />
            {refreshing ? 'Refreshing…' : pull.armed ? 'Release to refresh' : 'Pull to refresh'}
          </span>
        </div>
      )}

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
        <div className="flex items-center gap-3 shrink-0">
          {showCounts && (
            <span className="inline-flex items-center gap-2 text-[12px] font-semibold text-fg-muted">
              <span
                className={`w-2 h-2 rounded-full ${liveLabel === 'Live' ? 'bg-action' : 'bg-fg-muted'}`}
                aria-hidden="true"
              />
              <span aria-live="polite">{liveLabel}</span>
            </span>
          )}
          <AccountButton />
        </div>
      </header>

      {/* Summary: counts across all cases, independent of the filter */}
      {showCounts && (
        <dl className="mt-5 mx-4 grid grid-cols-3 divide-x divide-border border-y border-border">
          <div className="py-3 pr-3 flex flex-col gap-1">
            <dt className="text-[12px] text-fg-muted">Need rescuer</dt>
            <dd
              className={`text-[16px] font-semibold tabular-nums ${
                openCases.length > 0 ? 'text-reported-fg' : 'text-fg'
              }`}
            >
              {openCases.length}
            </dd>
          </div>
          <div className="py-3 px-3 flex flex-col gap-1">
            <dt className="text-[12px] text-fg-muted">In progress</dt>
            <dd className="text-[16px] font-semibold tabular-nums text-fg">{inProgressCount}</dd>
          </div>
          <div className="py-3 pl-3 flex flex-col gap-1">
            <dt className="text-[12px] text-fg-muted">Nearest open</dt>
            <dd className="text-[16px] font-semibold tabular-nums text-fg">
              {nearestOpenKm != null ? (
                formatDistance(nearestOpenKm)
              ) : userPosition ? (
                <span className="text-[14px] font-normal text-fg-muted">None</span>
              ) : locationStatus === 'off' || locationStatus === 'requesting' ? (
                // Prompts only on this tap; Home never asks for location on its own
                <button
                  type="button"
                  onClick={requestLocation}
                  disabled={locationStatus === 'requesting'}
                  className="-my-3 min-h-[44px] text-[14px] font-semibold text-link cursor-pointer hover:underline underline-offset-4 disabled:cursor-wait"
                >
                  {locationStatus === 'requesting' ? 'Locating…' : 'Show distances'}
                </button>
              ) : (
                <span className="text-[14px] font-normal text-fg-muted">
                  {locationStatus === 'denied'
                    ? 'Location blocked'
                    : locationStatus === 'unsupported'
                      ? 'Unavailable'
                      : '…'}
                </span>
              )}
            </dd>
          </div>
        </dl>
      )}

      <section aria-labelledby="nearby-heading" className="mt-6">
        <div className="flex items-center justify-between gap-3 px-4">
          <h2 id="nearby-heading" className="text-[16px] font-semibold text-fg tracking-tight">
            Nearby cases
          </h2>
          {updatedLabel && (
            <button
              type="button"
              onClick={refreshFeed}
              disabled={refreshing}
              aria-label={`${updatedLabel}. Refresh cases`}
              className="-mr-2 min-h-[44px] px-2 inline-flex items-center gap-1.5 rounded-xl text-[12px] text-fg-muted tabular-nums cursor-pointer hover:text-fg hover:bg-surface-muted disabled:cursor-wait"
            >
              <RotateCw className={`w-3.5 h-3.5 ${refreshing ? 'motion-safe:animate-spin' : ''}`} aria-hidden="true" />
              {refreshing ? 'Refreshing…' : updatedLabel}
            </button>
          )}
        </div>

        {/* Filters: underlined text tabs with live counts; sticks under the test banner while scrolling */}
        <div className="sticky top-[var(--banner-h,0px)] z-20 bg-page mt-1 border-b border-border">
        <div
          role="group"
          aria-label="Filter by emergency type"
          className="flex items-center gap-5 overflow-x-auto no-scrollbar px-4"
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
          {/* Edge fade hints that the tab row scrolls */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-page to-transparent"
          />
        </div>

        {feedStatus === 'sample' && (
          <p className="px-4 pt-3 text-[12px] text-fg-muted">
            These are sample cases. Real reports replace them as soon as one is filed.
          </p>
        )}

        {/* Quick-claim failures; the sheet and the case bar show their own errors */}
        {actionError && !selectedIncident && !activeCase && (
          <p role="alert" className="px-4 pt-3 text-[12px] font-semibold text-reported-fg">
            {actionError}
          </p>
        )}

        <div className="flex flex-col">
          {!isSupabaseConfigured ? (
            <div role="alert" className="mx-4 my-4 rounded-2xl p-6 border border-border text-center space-y-2">
              <p className="text-[14px] font-semibold text-fg">KupKop is not connected to its database</p>
              <p className="text-[12px] text-fg-muted">
                This build has no Supabase settings. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then rebuild.
              </p>
            </div>
          ) : feedStatus === 'loading' ? (
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
            <>
              {feedGroups.map((group) => (
                <section key={group.id} aria-labelledby={`group-${group.id}`}>
                  <h3
                    id={`group-${group.id}`}
                    className="px-4 pt-5 pb-2 flex items-baseline gap-2 text-[14px] font-semibold text-fg"
                  >
                    {group.title}
                    <span className="text-[12px] font-normal text-fg-muted tabular-nums">{group.items.length}</span>
                  </h3>
                  <div className="divide-y divide-border border-y border-border">
                    {group.items.map((incident) => (
                      <IncidentCard
                        key={incident.id}
                        incident={withDistance(incident)}
                        onClick={() => handleRowClick(incident)}
                        onClaim={canQuickClaim ? () => handleQuickClaim(incident) : undefined}
                        claiming={claimingId === incident.id}
                      />
                    ))}
                  </div>
                </section>
              ))}

              {/* End of list: says the list is complete and offers the next useful step */}
              <div className="px-4 pt-8 pb-4 flex flex-col items-center gap-4 text-center">
                <p className="text-[14px] text-fg-muted max-w-[280px]">
                  That&apos;s every case near you. New reports appear here as soon as they&apos;re filed.
                </p>
                <div className="flex items-center gap-3">
                  <Link
                    href="/rafa"
                    className="min-h-[44px] px-4 rounded-xl border border-border bg-surface hover:bg-surface-muted text-fg font-semibold text-[14px] flex items-center"
                  >
                    Ask Rafa for first aid
                  </Link>
                  <Link
                    href="/sos"
                    className="min-h-[44px] px-4 rounded-xl text-link font-semibold text-[14px] flex items-center hover:underline underline-offset-4"
                  >
                    Report an emergency
                  </Link>
                </div>
              </div>
            </>
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
