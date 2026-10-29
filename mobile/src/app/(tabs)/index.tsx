import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { RotateCw } from 'lucide-react-native';
import { distanceKm, formatDistance, getDirectionalBearing } from '@shared/geo';
import AccountButton from '@/components/AccountButton';
import ClinicPicker from '@/components/ClinicPicker';
import ActiveCaseBar from '@/components/ActiveCaseBar';
import DetailSheet from '@/components/DetailSheet';
import { DOCK_SPACE } from '@/components/Dock';
import IncidentRow from '@/components/IncidentRow';
import KupkopMark from '@/components/KupkopMark';
import { AppText, Button } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import {
  byUrgency,
  CHANNELS,
  createdMs,
  fromRow,
  matchesChannel,
  type ChannelId,
  type Incident,
  type ReportRow,
} from '@/lib/incidents';
import { hasSeenWelcome } from '@/lib/prefs';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { useDeviceLocation } from '@/lib/useDeviceLocation';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, size } from '@/theme/tokens';

// getDirectionalBearing returns one of these, clockwise from north
const BEARING_ARROWS = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];

const minutesAgo = (m: number) => new Date(Date.now() - m * 60000).toISOString();

// Shown when the database has no reports yet; local only (ids start with "case-")
const SAMPLE: Incident[] = [
  {
    id: 'case-1', shortId: 'KK-4821', animal: 'Aspin Dog', type: 'Hit-and-run · Critical', state: 'reported',
    location: 'Aurora Blvd near EDSA, Cubao', createdAt: minutesAgo(4), latitude: 14.6198, longitude: 121.0526,
    claimedBy: null, claimedAt: null, facilityId: null,
  },
  {
    id: 'case-2', shortId: 'KK-4822', animal: 'Puspin Kitten', type: 'Trapped in storm drain', state: 'claimed',
    location: 'E. Rodriguez Sr. Ave, New Manila', createdAt: minutesAgo(18), latitude: 14.6225, longitude: 121.0331,
    claimedBy: 'vol-test-1', claimedAt: minutesAgo(12), facilityId: null,
  },
  {
    id: 'case-3', shortId: 'KK-4823', animal: 'Injured Puppy', type: 'Fracture / Limping', state: 'reported',
    location: 'Kamuning Rd near Tomas Morato', createdAt: minutesAgo(32), latitude: 14.6305, longitude: 121.0366,
    claimedBy: null, claimedAt: null, facilityId: null,
  },
];

type FeedStatus = 'loading' | 'live' | 'sample' | 'error';

export default function FeedScreen() {
  const { colors } = useTheme();
  const { user, role, loading: authLoading } = useAuth();
  const location = useDeviceLocation();

  const [items, setItems] = useState<Incident[]>([]);
  const [status, setStatus] = useState<FeedStatus>('loading');
  const [realtime, setRealtime] = useState<'connecting' | 'live' | 'down'>('connecting');
  const [channel, setChannel] = useState<ChannelId>('all');
  const [selected, setSelected] = useState<Incident | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [dismissedId, setDismissedId] = useState<string | null>(null);
  const [admitTarget, setAdmitTarget] = useState<Incident | null>(null);

  // A tapped alert arrives as ?case=<report id>; open it once the list has it
  const { case: caseParam } = useLocalSearchParams<{ case?: string }>();
  useEffect(() => {
    if (!caseParam) return;
    const match = items.find((i) => i.id === caseParam);
    if (!match) return;
    const t = setTimeout(() => {
      setSelected(match);
      router.setParams({ case: undefined });
    }, 0);
    return () => clearTimeout(t);
  }, [caseParam, items]);

  // First launch while signed out: show the welcome screen once
  useEffect(() => {
    if (!authLoading && !user && !hasSeenWelcome()) router.replace('/welcome');
  }, [authLoading, user]);

  // Relative labels and escalation stay current
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  // State is set only when the request answers, never synchronously
  const load = useCallback(
    () =>
      supabase
        .from('sos_reports')
        .select('*')
        .order('created_at', { ascending: false })
        .then(({ data, error }) => {
          setRefreshing(false);
          if (error) {
            console.error('Failed to load live reports:', error.code, error.message);
            setStatus((prev) => (prev === 'live' ? prev : 'error'));
            return;
          }
          setLastUpdated(Date.now());
          setNow(Date.now());
          if (!data || data.length === 0) {
            setItems(SAMPLE);
            setStatus('sample');
            return;
          }
          setItems((data as ReportRow[]).map(fromRow));
          setStatus('live');
        }),
    []
  );

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    load();
    // "Live" shows only while this channel is connected
    const ch = supabase
      .channel('sos_reports_feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sos_reports' }, () => load())
      .subscribe((s) => {
        if (s === 'SUBSCRIBED') setRealtime('live');
        else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') setRealtime('down');
      });
    return () => {
      supabase.removeChannel(ch);
    };
  }, [load]);

  const refresh = () => {
    setRefreshing(true);
    load();
  };

  const userPos = location.coords;
  const geoOf = (i: Incident) => {
    if (!userPos || i.latitude == null || i.longitude == null) return {};
    const target = { lat: i.latitude, lng: i.longitude };
    const arrow = getDirectionalBearing(userPos, target);
    return {
      km: distanceKm(userPos, target),
      distance: formatDistance(distanceKm(userPos, target)),
      bearingDeg: BEARING_ARROWS.indexOf(arrow) * 45,
    };
  };

  // Same rules as web: real reports go through database functions that enforce who may do what
  const isLive = (i: Incident) => !i.id.startsWith('case-');

  const callFn = async (fn: 'claim_sos_report' | 'release_sos_claim' | 'admit_to_facility', args: Record<string, string>) => {
    setActionError(null);
    const { data, error } = await supabase.rpc(fn, args);
    if (error || !data?.success) {
      setActionError(data?.error || error?.message || 'Something went wrong. Please try again.');
      return false;
    }
    return true;
  };

  const apply = (updated: Incident) => {
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    setSelected((prev) => (prev?.id === updated.id ? updated : prev));
  };

  const claim = async (i: Incident) => {
    setBusyId(i.id);
    try {
      if (isLive(i) && !(await callFn('claim_sos_report', { p_report_id: i.id }))) return;
      setDismissedId(null);
      apply({ ...i, state: 'claimed', claimedAt: new Date().toISOString(), claimedBy: user?.id ?? null });
    } finally {
      setBusyId(null);
    }
  };

  const release = async (i: Incident) => {
    if (isLive(i) && !(await callFn('release_sos_claim', { p_report_id: i.id }))) return;
    apply({ ...i, state: 'reported', claimedAt: null, claimedBy: null });
  };

  // Real cases ask which Listed clinic took the animal; sample cases update locally
  const admit = (i: Incident) => {
    setActionError(null);
    if (isLive(i)) setAdmitTarget(i);
    else apply({ ...i, state: 'admitted', facilityId: 'fac-1' });
  };

  const confirmAdmit = async (facilityId: string) => {
    if (!admitTarget) return;
    const target = admitTarget;
    setBusyId(target.id);
    try {
      if (!(await callFn('admit_to_facility', { p_report_id: target.id, p_facility_id: facilityId }))) return;
      apply({ ...target, state: 'admitted', facilityId });
      setAdmitTarget(null);
    } finally {
      setBusyId(null);
    }
  };

  const activeCase = user
    ? items.find((i) => i.state === 'claimed' && i.claimedBy === user.id && i.id !== dismissedId) ?? null
    : null;
  const canClaim = role === 'volunteer' || role === 'admin';

  const filtered = useMemo(() => items.filter((i) => matchesChannel(i, channel)), [items, channel]);
  const groups = [
    { id: 'open', title: 'Needs a rescuer', items: filtered.filter((i) => i.state === 'reported').sort(byUrgency) },
    {
      id: 'progress',
      title: 'In progress',
      items: filtered
        .filter((i) => ['claimed', 'admitted', 'healing'].includes(i.state))
        .sort((a, b) => createdMs(b) - createdMs(a)),
    },
    {
      id: 'resolved',
      title: 'Resolved',
      items: filtered.filter((i) => i.state === 'resolved').sort((a, b) => createdMs(b) - createdMs(a)),
    },
  ].filter((g) => g.items.length > 0);

  const openCases = items.filter((i) => i.state === 'reported');
  const inProgress = items.filter((i) => ['claimed', 'admitted', 'healing'].includes(i.state)).length;
  const nearestKm = userPos
    ? openCases.reduce<number | null>((best, i) => {
        const g = geoOf(i);
        return g.km == null ? best : best == null || g.km < best ? g.km : best;
      }, null)
    : null;

  const showCounts = status === 'live' || status === 'sample';
  const liveLabel =
    status === 'sample' ? 'Sample data' : realtime === 'live' ? 'Live' : realtime === 'down' ? 'Reconnecting…' : 'Connecting…';
  const updatedLabel = (() => {
    if (lastUpdated == null) return null;
    const s = Math.max(0, Math.floor((now - lastUpdated) / 1000));
    if (s < 60) return 'Updated just now';
    const m = Math.floor(s / 60);
    return m < 60 ? `Updated ${m}m ago` : `Updated ${Math.floor(m / 60)}h ago`;
  })();

  const barSpace = activeCase ? 200 : 0;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        stickyHeaderIndices={[1]}
        contentContainerStyle={{ paddingBottom: DOCK_SPACE + barSpace + 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.fgMuted} colors={[colors.action]} />
        }
      >
        {/* 0: header and summary */}
        <View style={{ paddingTop: 16 }}>
          <View style={styles.header}>
            <View style={styles.brand}>
              <View style={[styles.markTile, { backgroundColor: colors.fg }]}>
                <KupkopMark size={22} color={colors.page} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="brand" accessibilityRole="header">
                  KupKop
                </AppText>
                <AppText variant="caption" tone="fgMuted" numberOfLines={1}>
                  Street animal emergency network
                </AppText>
              </View>
            </View>
            <View style={styles.headerRight}>
              {showCounts && (
                <View style={styles.liveWrap} accessibilityLiveRegion="polite">
                  <View style={[styles.dot, { backgroundColor: liveLabel === 'Live' ? colors.action : colors.fgMuted }]} />
                  <AppText variant="caption" bold tone="fgMuted">
                    {liveLabel}
                  </AppText>
                </View>
              )}
              <AccountButton />
            </View>
          </View>

          {showCounts && (
            <View style={[styles.summary, { borderColor: colors.border }]}>
              <View style={styles.stat}>
                <AppText variant="caption" tone="fgMuted">
                  Need rescuer
                </AppText>
                <AppText variant="title" tone={openCases.length > 0 ? 'reportedFg' : 'fg'}>
                  {openCases.length}
                </AppText>
              </View>
              <View style={[styles.stat, styles.statMid, { borderColor: colors.border }]}>
                <AppText variant="caption" tone="fgMuted">
                  In progress
                </AppText>
                <AppText variant="title">{inProgress}</AppText>
              </View>
              <View style={styles.stat}>
                <AppText variant="caption" tone="fgMuted">
                  Nearest open
                </AppText>
                {nearestKm != null ? (
                  <AppText variant="title">{formatDistance(nearestKm)}</AppText>
                ) : (
                  <Pressable onPress={location.start} accessibilityRole="button" hitSlop={12}>
                    <AppText bold tone="link">
                      {location.status === 'searching' || location.status === 'requesting' ? 'Locating…' : 'Show distances'}
                    </AppText>
                  </Pressable>
                )}
              </View>
            </View>
          )}

          <View style={styles.sectionHead}>
            <AppText variant="title">Nearby cases</AppText>
            {updatedLabel && (
              <Pressable onPress={refresh} accessibilityRole="button" accessibilityLabel={`${updatedLabel}. Refresh`} style={styles.updated}>
                <RotateCw size={14} color={colors.fgMuted} />
                <AppText variant="caption" tone="fgMuted">
                  {updatedLabel}
                </AppText>
              </Pressable>
            )}
          </View>
        </View>

        {/* 1: filter tabs, sticky */}
        <View style={{ backgroundColor: colors.page, borderBottomWidth: 1, borderColor: colors.border }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
            {CHANNELS.map((c) => {
              const active = channel === c.id;
              const count = items.filter((i) => matchesChannel(i, c.id)).length;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => setChannel(c.id)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  style={[styles.tab, active && { borderBottomColor: colors.fg }]}
                >
                  <AppText bold={active} tone={active ? 'fg' : 'fgMuted'}>
                    {c.label}{' '}
                    <AppText variant="caption" tone="fgMuted">
                      {count}
                    </AppText>
                  </AppText>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* 2: list */}
        <View>
          {!isSupabaseConfigured ? (
            <View style={styles.notice}>
              <AppText bold>KupKop is not connected to its database</AppText>
              <AppText variant="caption" tone="fgMuted" style={{ textAlign: 'center' }}>
                mobile/.env is missing. Copy .env.example to .env and restart Expo.
              </AppText>
            </View>
          ) : status === 'loading' ? (
            <View style={styles.notice}>
              <AppText tone="fgMuted">Loading cases…</AppText>
            </View>
          ) : status === 'error' ? (
            <View style={styles.notice} accessibilityRole="alert">
              <AppText bold>Could not load incidents</AppText>
              <AppText variant="caption" tone="fgMuted">
                Check your connection and try again.
              </AppText>
              <Button kind="secondary" label="Try again" onPress={() => { setStatus('loading'); load(); }} />
            </View>
          ) : groups.length === 0 ? (
            <View style={styles.notice}>
              <AppText tone="fgMuted">No cases in this filter.</AppText>
            </View>
          ) : (
            groups.map((g) => (
              <View key={g.id}>
                <AppText variant="caption" bold tone="fgMuted" style={styles.groupTitle}>
                  {g.title} {g.items.length}
                </AppText>
                {g.items.map((i, idx) => {
                  const geo = geoOf(i);
                  return (
                    <View key={i.id} style={idx > 0 ? { borderTopWidth: 1, borderColor: colors.border } : undefined}>
                      <IncidentRow
                        incident={i}
                        now={now}
                        distance={geo.distance}
                        bearingDeg={geo.bearingDeg}
                        onPress={() => {
                          setActionError(null);
                          setSelected(i);
                        }}
                        onClaim={canClaim && !activeCase ? () => claim(i) : undefined}
                        claiming={busyId === i.id}
                      />
                    </View>
                  );
                })}
              </View>
            ))
          )}

          {showCounts && (
            <View style={styles.endNote}>
              <AppText variant="caption" tone="fgMuted" style={{ textAlign: 'center' }}>
                That&apos;s every case. Found an animal that needs help?
              </AppText>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button kind="secondary" label="Ask Rafa" onPress={() => router.navigate('/rafa')} />
                <Button kind="secondary" label="Report with SOS" onPress={() => router.push('/sos')} />
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {activeCase && (
        <ActiveCaseBar
          incident={activeCase}
          error={actionError}
          bottom={DOCK_SPACE}
          onRelease={() => release(activeCase)}
          onAdmit={() => admit(activeCase)}
          onClaimAgain={() => claim(activeCase)}
          onDismiss={() => setDismissedId(activeCase.id)}
        />
      )}

      <DetailSheet
        incident={selected}
        now={now}
        distance={selected ? geoOf(selected).distance : undefined}
        userId={user?.id ?? null}
        canClaim={canClaim && !activeCase}
        error={actionError}
        busy={!!selected && busyId === selected.id}
        onClose={() => setSelected(null)}
        onClaim={claim}
        onRelease={release}
        onAdmit={(i) => {
          // One sheet at a time: close the case details before the clinic list opens
          setSelected(null);
          admit(i);
        }}
      />

      <ClinicPicker
        visible={!!admitTarget}
        caseLabel={admitTarget ? `${admitTarget.animal} · Case #${admitTarget.shortId}` : undefined}
        near={location.coords}
        busy={!!admitTarget && busyId === admitTarget.id}
        error={admitTarget ? actionError : null}
        onPick={confirmAdmit}
        onClose={() => setAdmitTarget(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 16 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 },
  markTile: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  liveWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  summary: { flexDirection: 'row', marginTop: 20, marginHorizontal: 16, borderTopWidth: 1, borderBottomWidth: 1 },
  stat: { flex: 1, paddingVertical: 12, gap: 4 },
  statMid: { borderLeftWidth: 1, borderRightWidth: 1, paddingHorizontal: 12 },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 24,
    marginBottom: 4,
  },
  updated: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: size.tap },
  tabs: { paddingHorizontal: 12, gap: 4 },
  tab: { minHeight: size.tap, paddingHorizontal: 8, justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  groupTitle: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 },
  notice: { alignItems: 'center', gap: 8, padding: 24 },
  endNote: { alignItems: 'center', gap: 12, padding: 24 },
});
