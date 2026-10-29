import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Camera } from 'lucide-react-native';
import AuthSheet from '@/components/AuthSheet';
import KupkopMark from '@/components/KupkopMark';
import { AppText, Button } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { markWelcomeSeen } from '@/lib/prefs';
import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/tokens';

// Real sequence, so numbered. Wording matches what the app does today (same as web /welcome).
const STEPS = [
  { title: 'You report it', body: 'Live camera photo, your GPS, and a server timestamp. No gallery uploads, so reports are real and current.' },
  { title: 'One volunteer claims it', body: 'The claim locks the case for an hour, so two people never race to the same animal.' },
  { title: 'Everyone sees the recovery', body: 'Listed clinics must post a recovery update within 14 days of admitting the animal.' },
];

// Shown once, on first launch while signed out
export default function WelcomeScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => {
    markWelcomeSeen();
  }, []);

  useEffect(() => {
    if (user) router.replace('/');
  }, [user]);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 32, paddingBottom: 48 }}>
      <View style={styles.header}>
        <View style={[styles.markTile, { backgroundColor: colors.fg }]}>
          <KupkopMark size={22} color={colors.page} />
        </View>
        <AppText variant="brand">KupKop</AppText>
      </View>

      <View style={{ gap: 12 }}>
        <AppText variant="display" accessibilityRole="header" style={{ maxWidth: 300 }}>
          See a hurt street animal? Get it help in three taps.
        </AppText>
        <AppText tone="fgMuted">
          KupKop connects people who find injured aspins and puspins with rescue volunteers and partner clinics.
        </AppText>
        <Button
          kind="emergency"
          label="Report an emergency now"
          icon={<Camera size={20} color={colors.accentFg} />}
          onPress={() => router.push('/sos')}
          style={{ marginTop: 12 }}
        />
        <AppText variant="caption" tone="fgMuted" style={{ textAlign: 'center' }}>
          No account needed to start. You sign in just before the report is sent.
        </AppText>
      </View>

      <View style={{ gap: 16 }}>
        <AppText variant="title">How a rescue works</AppText>
        {STEPS.map((s, i) => (
          <View key={s.title} style={styles.step}>
            <View style={[styles.num, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <AppText variant="caption" bold>
                {i + 1}
              </AppText>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <AppText bold>{s.title}</AppText>
              <AppText tone="fgMuted">{s.body}</AppText>
            </View>
          </View>
        ))}
      </View>

      <View style={{ gap: 8 }}>
        <Button kind="secondary" label="Log in or create an account" onPress={() => setAuthOpen(true)} />
        <Button kind="ghost" label="Browse cases without an account" onPress={() => router.replace('/')} />
      </View>

      <AppText variant="caption" tone="fgMuted" style={{ textAlign: 'center' }}>
        KupKop is a free prototype. Reports are not sent to 911 or real responders.
      </AppText>

      <AuthSheet visible={authOpen} onClose={() => setAuthOpen(false)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  markTile: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  step: { flexDirection: 'row', gap: 12 },
  num: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
