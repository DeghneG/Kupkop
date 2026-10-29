import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Check, Lock, LockOpen } from 'lucide-react-native';
import { calculateClaimTimer, ESCALATION_CONFIG } from '@shared/escalation';
import { AppText, Button } from '@/components/ui';
import type { Incident } from '@/lib/incidents';
import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/tokens';

type Props = {
  incident: Incident;
  error?: string | null;
  bottom: number;
  onRelease: () => void;
  onAdmit: () => void;
  onClaimAgain: () => void;
  onDismiss: () => void;
};

// Floats above the dock while the user holds a claim (Claude Design "Active Case Bar"), same copy as web
export default function ActiveCaseBar({ incident, error, bottom, onRelease, onAdmit, onClaimAgain, onDismiss }: Props) {
  const { colors } = useTheme();
  const [, tick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const timer = calculateClaimTimer(incident.claimedAt);
  const expired = timer.isExpired;
  const expiring = !expired && timer.remainingMinutes < 5;
  const pill = expiring
    ? `${timer.remainingMinutes}:${String(timer.remainingSeconds).padStart(2, '0')} left`
    : `${timer.remainingMinutes + (timer.remainingSeconds > 0 ? 1 : 0)}m left`;
  const lockUntil = incident.claimedAt
    ? new Date(
        new Date(incident.claimedAt).getTime() + ESCALATION_CONFIG.claimLockDurationMinutes * 60000
      ).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : '';

  return (
    <View style={[styles.bar, { bottom, backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.head}>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="caption" tone="fgMuted">
            Your case · #{incident.shortId}
          </AppText>
          <AppText variant="title" numberOfLines={1}>
            {incident.animal} · {incident.location}
          </AppText>
        </View>
        <View style={[styles.pill, { backgroundColor: expired ? colors.surfaceMuted : colors.claimedBg }]}>
          {expired ? <LockOpen size={14} color={colors.fg} /> : <Lock size={14} color={colors.claimedFg} />}
          <AppText variant="caption" bold tone={expired ? 'fg' : 'claimedFg'}>
            {expired ? 'Lock expired' : pill}
          </AppText>
        </View>
      </View>

      {!expired && (
        <View style={[styles.track, { backgroundColor: colors.surfaceMuted }]}>
          <View
            style={[
              styles.fill,
              { width: `${timer.percentRemaining}%`, backgroundColor: expiring ? colors.claimedFg : colors.fgMuted },
            ]}
          />
        </View>
      )}
      <AppText variant="caption" bold={expiring} tone={expiring ? 'claimedFg' : 'fgMuted'}>
        {expired
          ? 'Others can claim this case now.'
          : expiring
            ? 'Lock ends soon. Admit or release.'
            : `Locked to you until ${lockUntil}`}
      </AppText>

      {error && (
        <AppText variant="caption" tone="reportedFg" accessibilityRole="alert">
          {error}
        </AppText>
      )}

      <View style={styles.actions}>
        <Button kind="secondary" label={expired ? 'Dismiss' : 'Release'} onPress={expired ? onDismiss : onRelease} style={{ flex: 1 }} />
        <Button
          label={expired ? 'Claim again' : 'Admit'}
          icon={expired ? <Lock size={14} color={colors.actionFg} /> : <Check size={14} color={colors.actionFg} />}
          onPress={expired ? onClaimAgain : onAdmit}
          style={{ flex: 1.6 }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: 16,
    gap: 10,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2 },
  actions: { flexDirection: 'row', gap: 8 },
});
