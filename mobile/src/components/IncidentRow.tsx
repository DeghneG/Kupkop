import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { ArrowUp, Camera } from 'lucide-react-native';
import { AppText, Button } from '@/components/ui';
import { statusOf, timeAgo, triageTag, type Incident } from '@/lib/incidents';
import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/tokens';

type Props = {
  incident: Incident;
  now: number;
  distance?: string;
  /** Degrees clockwise from north */
  bearingDeg?: number;
  onPress: () => void;
  /** Responders only, on open cases */
  onClaim?: () => void;
  claiming?: boolean;
};

// Flat row, no card. Photo is blurred so injuries are not shown until the case is opened.
export default function IncidentRow({ incident, now, distance, bearingDeg, onPress, onClaim, claiming }: Props) {
  const { colors } = useTheme();
  const status = statusOf(incident);
  const open = incident.state === 'reported';
  const showClaim = !!onClaim && open;

  return (
    <View style={[styles.wrap, open && { backgroundColor: colors.reportedBg + '66' }]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${status.label}: ${incident.animal}, ${incident.type}, ${incident.location}`}
        style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceMuted }]}
      >
        <View style={[styles.thumb, { backgroundColor: colors.surfaceMuted }]}>
          {incident.photoUrl ? (
            <Image source={{ uri: incident.photoUrl }} style={StyleSheet.absoluteFill} blurRadius={12} contentFit="cover" />
          ) : (
            <Camera size={20} color={colors.fgMuted} />
          )}
        </View>

        <View style={styles.body}>
          <View style={styles.topLine}>
            <AppText variant="title" numberOfLines={1} style={{ flex: 1 }}>
              {incident.animal}
              <AppText tone="fgMuted"> · {triageTag(incident.type)}</AppText>
            </AppText>
            <AppText variant="caption" tone="fgMuted">
              {timeAgo(incident.createdAt, now)}
            </AppText>
          </View>
          <AppText tone="fgMuted" numberOfLines={1}>
            {incident.location}
          </AppText>
          <View style={styles.meta}>
            <AppText variant="caption" bold tone={status.tone} numberOfLines={1} style={{ flexShrink: 1 }}>
              {status.label}
            </AppText>
            {distance && (
              <>
                <AppText variant="caption" tone="fgMuted">
                  ·
                </AppText>
                {bearingDeg != null && (
                  <ArrowUp size={12} color={colors.fgMuted} style={{ transform: [{ rotate: `${bearingDeg}deg` }] }} />
                )}
                <AppText variant="caption" tone="fgMuted">
                  {distance}
                </AppText>
              </>
            )}
            <AppText variant="caption" tone="fgMuted" numberOfLines={1}>
              · #{incident.shortId}
            </AppText>
          </View>
        </View>
      </Pressable>

      {showClaim && (
        <Button
          kind="secondary"
          label={claiming ? 'Claiming…' : 'Claim'}
          accessibilityLabel={`Claim case #${incident.shortId}`}
          onPress={onClaim}
          disabled={claiming}
          style={{ marginRight: 16 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center' },
  row: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16 },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 4, minWidth: 0 },
  topLine: { flexDirection: 'row', alignItems: 'baseline', gap: 12 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 0 },
});
