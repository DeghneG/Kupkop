import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { CheckCircle2, HeartHandshake, Laptop, LogOut, Moon, Sun } from 'lucide-react-native';
import AuthSheet from '@/components/AuthSheet';
import { DOCK_SPACE } from '@/components/Dock';
import { AppText, Button } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import type { ThemeMode } from '@/lib/prefs';
import { unregisterPush } from '@/lib/push';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, size, type as typeScale } from '@/theme/tokens';

type ApplicationStatus = 'pending' | 'approved' | 'rejected';

export default function SettingsScreen() {
  const { colors, mode, setMode } = useTheme();
  const { user, role } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 24, paddingBottom: DOCK_SPACE + 16 }}>
      <View style={{ gap: 4, paddingBottom: 4, borderBottomWidth: 1, borderColor: colors.border }}>
        <AppText variant="brand" accessibilityRole="header">
          Settings
        </AppText>
        <AppText variant="caption" tone="fgMuted">
          Account, appearance, and prototype test controls.
        </AppText>
      </View>

      <Section title="Account">
        {user ? (
          <View style={styles.accountRow}>
            <View style={[styles.avatar, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
              <AppText bold>{(user.email?.[0] ?? '?').toUpperCase()}</AppText>
            </View>
            <View style={{ flex: 1 }}>
              <AppText bold numberOfLines={1}>
                {user.email}
              </AppText>
              <AppText variant="caption" tone="fgMuted" style={{ textTransform: 'capitalize' }}>
                Signed in · {role}
              </AppText>
            </View>
            <Button
              kind="secondary"
              label="Sign out"
              icon={<LogOut size={14} color={colors.fgMuted} />}
              onPress={async () => {
                await unregisterPush();
                await supabase.auth.signOut();
              }}
            />
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            <AppText tone="fgMuted">
              Sign in to manage incident reports, claim emergency rescues, and follow recoveries.
            </AppText>
            <Button label="Sign in to KupKop" onPress={() => setAuthOpen(true)} />
          </View>
        )}
      </Section>

      <Section title="Appearance">
        <View accessibilityRole="radiogroup" style={[styles.segment, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
          {(
            [
              ['system', 'System', Laptop],
              ['light', 'Light', Sun],
              ['dark', 'Dark', Moon],
            ] as [ThemeMode, string, typeof Sun][]
          ).map(([value, label, Icon]) => {
            const active = mode === value;
            return (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                onPress={() => setMode(value)}
                style={[styles.segmentItem, active && { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <Icon size={16} color={active ? colors.fg : colors.fgMuted} />
                <AppText variant="caption" bold tone={active ? 'fg' : 'fgMuted'}>
                  {label}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </Section>

      <VolunteerSection userId={user?.id ?? null} role={role} onSignIn={() => setAuthOpen(true)} />

      <AppText variant="caption" tone="fgMuted">
        KupKop is a prototype. Reports are not sent to real responders.
      </AppText>

      <AuthSheet visible={authOpen} onClose={() => setAuthOpen(false)} />
    </ScrollView>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {icon}
        <AppText variant="caption" bold tone="fgMuted" accessibilityRole="header">
          {title}
        </AppText>
      </View>
      {children}
    </View>
  );
}

// Users apply; only an admin approves. The app never writes profiles.role.
function VolunteerSection({ userId, role, onSignIn }: { userId: string | null; role: string; onSignIn: () => void }) {
  const { colors } = useTheme();
  const [status, setStatus] = useState<ApplicationStatus | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    supabase
      .from('role_applications')
      .select('status')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (active && data) setStatus(data.status as ApplicationStatus);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  const submit = async () => {
    if (!userId) return;
    setSubmitting(true);
    setError(null);
    const { error: insertError } = await supabase
      .from('role_applications')
      .insert({ user_id: userId, requested_role: 'volunteer', note: note.trim() });
    setSubmitting(false);
    if (insertError) {
      setError(
        insertError.code === '23505'
          ? 'You already have an application waiting for review.'
          : 'Could not send your application. Please try again.'
      );
      return;
    }
    setStatus('pending');
    setNote('');
  };

  const isResponder = role === 'volunteer' || role === 'admin' || role === 'facility';

  return (
    <Section title="Volunteer" icon={<HeartHandshake size={16} color={colors.fgMuted} />}>
      {isResponder ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <CheckCircle2 size={16} color={colors.healingFg} />
          <AppText style={{ textTransform: 'capitalize' }}>You are an approved {role}.</AppText>
        </View>
      ) : !userId ? (
        <View style={{ gap: 12 }}>
          <AppText tone="fgMuted">Sign in to apply as a rescue volunteer.</AppText>
          <Button kind="secondary" label="Sign in" onPress={onSignIn} />
        </View>
      ) : status === 'pending' ? (
        <AppText tone="fgMuted">Your application is waiting for admin review.</AppText>
      ) : (
        <View style={{ gap: 12 }}>
          <AppText tone="fgMuted">
            Volunteers can claim rescues from the feed. An admin reviews every application.
            {status === 'rejected' ? ' Your last application was not approved; you can apply again.' : ''}
          </AppText>
          <View style={{ gap: 6 }}>
            <AppText variant="caption" bold>
              Why do you want to help? (10–500 characters)
            </AppText>
            <TextInput
              value={note}
              onChangeText={setNote}
              maxLength={500}
              multiline
              accessibilityLabel="Why do you want to help?"
              style={[styles.note, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, color: colors.fg }]}
            />
          </View>
          {error && (
            <AppText variant="caption" tone="reportedFg" accessibilityRole="alert">
              {error}
            </AppText>
          )}
          <Button
            label={submitting ? 'Sending…' : 'Apply to be a volunteer'}
            onPress={submit}
            disabled={submitting || note.trim().length < 10}
          />
        </View>
      )}
    </Section>
  );
}

const styles = StyleSheet.create({
  section: { borderWidth: 1, borderRadius: radius.lg, padding: 16, gap: 12 },
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  segment: { flexDirection: 'row', borderWidth: 1, borderRadius: radius.md, padding: 4, gap: 4 },
  segmentItem: {
    flex: 1,
    minHeight: size.tap,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  note: { minHeight: 88, borderWidth: 1, borderRadius: radius.md, padding: 12, fontSize: typeScale.body, textAlignVertical: 'top' },
});
