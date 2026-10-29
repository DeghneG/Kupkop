import React, { useState } from 'react';
import { Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from 'react-native-reanimated';
import { Eye, EyeOff, MapPin, Navigation, Phone, X } from 'lucide-react-native';
import { AppText, Button } from '@/components/ui';
import { statusOf, timeAgo, type Incident } from '@/lib/incidents';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, size } from '@/theme/tokens';

type Props = {
  incident: Incident | null;
  now: number;
  distance?: string;
  userId: string | null;
  canClaim: boolean;
  error?: string | null;
  busy?: boolean;
  onClose: () => void;
  onClaim: (i: Incident) => void;
  onRelease: (i: Incident) => void;
  onAdmit: (i: Incident) => void;
};

export default function DetailSheet({
  incident,
  now,
  distance,
  userId,
  canClaim,
  error,
  busy,
  onClose,
  onClaim,
  onRelease,
  onAdmit,
}: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const [revealed, setRevealed] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const close = () => {
    setRevealed(false);
    setNotice(null);
    onClose();
  };

  const openMaps = () => {
    if (!incident || incident.latitude == null || incident.longitude == null) return;
    const { latitude: lat, longitude: lng } = incident;
    const label = encodeURIComponent(`${incident.animal} #${incident.shortId}`);
    const url =
      Platform.OS === 'android'
        ? `geo:${lat},${lng}?q=${lat},${lng}(${label})`
        : `https://maps.apple.com/?ll=${lat},${lng}&q=${label}`;
    Linking.openURL(url).catch(() =>
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`)
    );
  };

  const status = incident ? statusOf(incident) : null;
  const mine = !!incident && incident.state === 'claimed' && incident.claimedBy === userId;

  return (
    <Modal
      visible={!!incident}
      transparent
      animationType={reduceMotion ? 'none' : 'slide'}
      onRequestClose={close}
      statusBarTranslucent
    >
      <View style={[styles.backdrop, { backgroundColor: colors.scrim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close case details" />
        {incident && status && (
          <View
            style={[
              styles.sheet,
              { backgroundColor: colors.surface, borderColor: colors.border, paddingBottom: insets.bottom + 16 },
            ]}
          >
            <ScrollView contentContainerStyle={{ gap: 16 }}>
              {/* Photo stays blurred until the viewer chooses to see it */}
              <Pressable
                onPress={() => setRevealed((v) => !v)}
                accessibilityRole="button"
                accessibilityLabel={revealed ? 'Blur photo' : 'Show photo. It may show injuries'}
                style={[styles.photo, { backgroundColor: colors.surfaceMuted }]}
              >
                {incident.photoUrl ? (
                  <Image
                    source={{ uri: incident.photoUrl }}
                    style={StyleSheet.absoluteFill}
                    blurRadius={revealed ? 0 : 24}
                    contentFit="cover"
                  />
                ) : null}
                <View style={[styles.revealChip, { backgroundColor: colors.scrim }]}>
                  {revealed ? <EyeOff size={14} color={colors.onScrim} /> : <Eye size={14} color={colors.onScrim} />}
                  <AppText variant="caption" bold tone="onScrim">
                    {incident.photoUrl ? (revealed ? 'Tap to blur' : 'Tap to show photo') : 'No photo'}
                  </AppText>
                </View>
              </Pressable>

              <Pressable
                onPress={close}
                accessibilityRole="button"
                accessibilityLabel="Close"
                style={[styles.close, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <X size={18} color={colors.fg} />
              </Pressable>

              <View style={{ gap: 4 }}>
                <AppText variant="caption" tone="fgMuted">
                  Case #{incident.shortId} · {timeAgo(incident.createdAt, now)}
                </AppText>
                <AppText variant="display" accessibilityRole="header">
                  {incident.animal}
                </AppText>
                <AppText tone="fgMuted">{incident.type}</AppText>
                <AppText bold tone={status.tone}>
                  {status.label}
                </AppText>
              </View>

              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              <View style={styles.line}>
                <MapPin size={16} color={colors.fgMuted} />
                <AppText style={{ flex: 1 }}>
                  {incident.location}
                  {distance ? <AppText tone="fgMuted"> · {distance} away</AppText> : null}
                </AppText>
              </View>
              {incident.description && <AppText tone="fgMuted">{incident.description}</AppText>}

              {error && (
                <AppText variant="caption" tone="reportedFg" accessibilityRole="alert">
                  {error}
                </AppText>
              )}
              {notice && (
                <AppText variant="caption" tone="fgMuted" accessibilityRole="alert">
                  {notice}
                </AppText>
              )}

              <View style={{ gap: 8 }}>
                {incident.state === 'reported' && canClaim && (
                  <Button label="Claim this rescue" onPress={() => onClaim(incident)} loading={busy} />
                )}
                {mine && (
                  <View style={styles.row}>
                    <Button kind="secondary" label="Release" onPress={() => onRelease(incident)} style={{ flex: 1 }} />
                    <Button label="Mark as admitted" onPress={() => onAdmit(incident)} loading={busy} style={{ flex: 1.6 }} />
                  </View>
                )}
                <View style={styles.row}>
                  <Button
                    kind="secondary"
                    label="Directions"
                    icon={<Navigation size={16} color={colors.fg} />}
                    onPress={openMaps}
                    disabled={incident.latitude == null}
                    style={{ flex: 1 }}
                  />
                  <Button
                    kind="secondary"
                    label="Call reporter"
                    icon={<Phone size={16} color={colors.fg} />}
                    onPress={() => setNotice('Test mode: calls disabled.')}
                    style={{ flex: 1 }}
                  />
                </View>
              </View>
            </ScrollView>
          </View>
        )}
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
    maxHeight: '92%',
  },
  photo: {
    height: 200,
    borderRadius: radius.lg,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  revealChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
  },
  close: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: size.tap,
    height: size.tap,
    borderRadius: size.tap / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: { height: 1 },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  row: { flexDirection: 'row', gap: 8 },
});
