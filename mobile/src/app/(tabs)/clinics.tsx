import React, { useEffect, useState } from 'react';
import { Linking, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Navigation, Phone } from 'lucide-react-native';
import { calculateFacilityInactivity } from '@shared/escalation';
import { distanceKm, formatDistance } from '@shared/geo';
import { DOCK_SPACE } from '@/components/Dock';
import { AppText, Button } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useDeviceLocation } from '@/lib/useDeviceLocation';
import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/tokens';

type Clinic = { id: string; name: string; address: string; latitude?: number; longitude?: number; lastActiveAt: string };

const daysAgo = (d: number) => new Date(Date.now() - d * 86400000).toISOString();

// Shown until the database has facilities; prototype rule: "Listed", never "Verified"
const SAMPLE: Clinic[] = [
  { id: 'fac-1', name: 'Test Clinic A (Katipunan)', address: 'Katipunan Ave, Quezon City', latitude: 14.6391, longitude: 121.0766, lastActiveAt: daysAgo(0.1) },
  { id: 'fac-2', name: 'Test Clinic B (New Manila)', address: 'E. Rodriguez Sr. Ave, New Manila', latitude: 14.6225, longitude: 121.0331, lastActiveAt: daysAgo(4) },
  { id: 'fac-3', name: 'Test Clinic C (Aurora Blvd)', address: 'Aurora Blvd near Broadway', latitude: 14.6128, longitude: 121.0287, lastActiveAt: daysAgo(12) },
  { id: 'fac-4', name: 'Test Shelter D (Kamias)', address: 'Kamias Rd near Anonas', latitude: 14.6262, longitude: 121.0546, lastActiveAt: daysAgo(15) },
];

export default function ClinicsScreen() {
  const { colors } = useTheme();
  const location = useDeviceLocation();
  const [clinics, setClinics] = useState<Clinic[]>(SAMPLE);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('facilities')
      .select('*')
      .order('name')
      .then(({ data, error }) => {
        if (error || !data || data.length === 0) return;
        setClinics(
          data.map((f) => ({
            id: f.id,
            name: f.name,
            address: f.address,
            latitude: f.latitude ?? undefined,
            longitude: f.longitude ?? undefined,
            lastActiveAt: f.last_active_at || f.created_at || new Date().toISOString(),
          }))
        );
      });
  }, []);

  const directions = (c: Clinic) => {
    if (c.latitude == null || c.longitude == null) return;
    const q = encodeURIComponent(c.name);
    const url =
      Platform.OS === 'android'
        ? `geo:${c.latitude},${c.longitude}?q=${c.latitude},${c.longitude}(${q})`
        : `https://maps.apple.com/?ll=${c.latitude},${c.longitude}&q=${q}`;
    Linking.openURL(url).catch(() => {});
  };

  const pos = location.coords;
  const sorted = pos
    ? [...clinics].sort((a, b) => {
        const da = a.latitude != null ? distanceKm(pos, { lat: a.latitude, lng: a.longitude! }) : Infinity;
        const db = b.latitude != null ? distanceKm(pos, { lat: b.latitude, lng: b.longitude! }) : Infinity;
        return da - db;
      })
    : clinics;

  return (
    <ScrollView contentContainerStyle={{ paddingTop: 16, paddingBottom: DOCK_SPACE + 16 }}>
      <View style={{ paddingHorizontal: 16, gap: 4 }}>
        <AppText variant="brand" accessibilityRole="header">
          Clinics
        </AppText>
        <AppText variant="caption" tone="fgMuted">
          Listed clinics must log a recovery update within 14 days of admitting an animal.
        </AppText>
        {!pos && (
          <Button kind="ghost" label="Sort by distance" onPress={location.start} style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }} />
        )}
      </View>

      {notice && (
        <AppText variant="caption" tone="fgMuted" accessibilityRole="alert" style={{ paddingHorizontal: 16, paddingTop: 8 }}>
          {notice}
        </AppText>
      )}

      <View style={{ marginTop: 8 }}>
        {sorted.map((c, idx) => {
          const clock = calculateFacilityInactivity(c.lastActiveAt);
          const tone = clock.status === 'alert' ? 'reportedFg' : clock.status === 'warning' ? 'claimedFg' : 'healingFg';
          const dist = pos && c.latitude != null ? formatDistance(distanceKm(pos, { lat: c.latitude, lng: c.longitude! })) : null;
          return (
            <View key={c.id} style={[styles.row, idx > 0 && { borderTopWidth: 1, borderColor: colors.border }]}>
              <View style={{ gap: 4 }}>
                <View style={styles.titleLine}>
                  <AppText variant="title" style={{ flex: 1 }} numberOfLines={1}>
                    {c.name}
                  </AppText>
                  <View style={[styles.listed, { backgroundColor: colors.surfaceMuted }]}>
                    <AppText variant="caption" bold tone="fgMuted">
                      Listed
                    </AppText>
                  </View>
                </View>
                <AppText tone="fgMuted" numberOfLines={1}>
                  {c.address}
                  {dist ? ` · ${dist}` : ''}
                </AppText>
                <AppText variant="caption" bold tone={tone}>
                  {clock.badgeText}
                </AppText>
              </View>
              <View style={styles.actions}>
                <Button
                  kind="secondary"
                  label="Directions"
                  icon={<Navigation size={16} color={colors.fg} />}
                  onPress={() => directions(c)}
                  disabled={c.latitude == null}
                  style={{ flex: 1 }}
                />
                <Button
                  kind="secondary"
                  label="Call"
                  icon={<Phone size={16} color={colors.fg} />}
                  onPress={() => {
                    setNotice(`Test mode: calls to ${c.name} disabled.`);
                    setTimeout(() => setNotice(null), 3000);
                  }}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 16, paddingVertical: 16, gap: 12 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  listed: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full },
  actions: { flexDirection: 'row', gap: 8 },
});
