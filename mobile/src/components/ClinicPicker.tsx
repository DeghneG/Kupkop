import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from 'react-native-reanimated';
import { Check, X } from 'lucide-react-native';
import { calculateFacilityInactivity } from '@shared/escalation';
import { distanceKm, formatDistance } from '@shared/geo';
import { AppText, Button } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import type { Coords } from '@/lib/useDeviceLocation';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, size } from '@/theme/tokens';

type Clinic = { id: string; name: string; address: string; latitude: number; longitude: number; lastActiveAt: string };

type Props = {
  visible: boolean;
  /** Case being handed off; shown in the title */
  caseLabel?: string;
  /** Rescuer's position, to sort nearest first */
  near?: Coords | null;
  busy?: boolean;
  error?: string | null;
  onPick: (facilityId: string) => void;
  onClose: () => void;
};

// Which Listed clinic received the animal. Replaces "first Listed clinic" on Admit.
export default function ClinicPicker({ visible, caseLabel, near, busy, error, onPick, onClose }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const [clinics, setClinics] = useState<Clinic[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    supabase
      .from('facilities')
      .select('id,name,address,latitude,longitude,last_active_at')
      .eq('status', 'Listed')
      .order('name')
      .then(({ data, error: e }) => {
        if (!active) return;
        if (e) {
          setLoadError('Could not load clinics. Check your connection.');
          setClinics([]);
          return;
        }
        setLoadError(null);
        setClinics(
          (data ?? []).map((f) => ({
            id: f.id,
            name: f.name,
            address: f.address,
            latitude: f.latitude,
            longitude: f.longitude,
            lastActiveAt: f.last_active_at,
          }))
        );
      });
    return () => {
      active = false;
    };
  }, [visible]);

  const sorted = clinics
    ? near
      ? [...clinics].sort(
          (a, b) =>
            distanceKm(near, { lat: a.latitude, lng: a.longitude }) - distanceKm(near, { lat: b.latitude, lng: b.longitude })
        )
      : clinics
    : null;

  const close = () => {
    setSelected(null);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType={reduceMotion ? 'none' : 'slide'} onRequestClose={close} statusBarTranslucent>
      <View style={[styles.backdrop, { backgroundColor: colors.scrim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close clinic list" />
        <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border, paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.head}>
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="display" accessibilityRole="header">
                Which clinic admitted it?
              </AppText>
              {caseLabel && (
                <AppText variant="caption" tone="fgMuted">
                  {caseLabel}
                </AppText>
              )}
            </View>
            <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Close" style={[styles.close, { backgroundColor: colors.surfaceMuted }]}>
              <X size={18} color={colors.fgMuted} />
            </Pressable>
          </View>

          <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ paddingVertical: 8 }}>
            {sorted == null ? (
              <ActivityIndicator color={colors.fgMuted} style={{ padding: 24 }} />
            ) : sorted.length === 0 ? (
              <AppText tone="fgMuted" style={{ padding: 16, textAlign: 'center' }}>
                {loadError ?? 'No Listed clinics yet. An admin needs to add one first.'}
              </AppText>
            ) : (
              sorted.map((c, idx) => {
                const active = selected === c.id;
                const clock = calculateFacilityInactivity(c.lastActiveAt);
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => setSelected(c.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    style={[
                      styles.row,
                      idx > 0 && { borderTopWidth: 1, borderColor: colors.border },
                      active && { backgroundColor: colors.surfaceMuted },
                    ]}
                  >
                    <View style={{ flex: 1, gap: 2 }}>
                      <AppText bold numberOfLines={1}>
                        {c.name}
                      </AppText>
                      <AppText variant="caption" tone="fgMuted" numberOfLines={1}>
                        {c.address}
                        {near ? ` · ${formatDistance(distanceKm(near, { lat: c.latitude, lng: c.longitude }))}` : ''}
                      </AppText>
                      {clock.status !== 'active' && (
                        <AppText variant="caption" bold tone={clock.status === 'alert' ? 'reportedFg' : 'claimedFg'}>
                          {clock.badgeText}
                        </AppText>
                      )}
                    </View>
                    <View style={[styles.radio, { borderColor: active ? colors.action : colors.border, backgroundColor: active ? colors.action : 'transparent' }]}>
                      {active && <Check size={14} color={colors.actionFg} />}
                    </View>
                  </Pressable>
                );
              })
            )}
          </ScrollView>

          {error && (
            <AppText variant="caption" tone="reportedFg" accessibilityRole="alert">
              {error}
            </AppText>
          )}
          <Button label="Confirm admission" onPress={() => selected && onPick(selected)} disabled={!selected} loading={busy} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    padding: 16,
    gap: 12,
    maxHeight: '85%',
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  close: { width: size.tap, height: size.tap, borderRadius: size.tap / 2, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 8, minHeight: size.tap },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
