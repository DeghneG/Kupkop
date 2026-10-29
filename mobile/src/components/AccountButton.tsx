import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import AuthSheet from '@/components/AuthSheet';
import { AppText, Button } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/theme/ThemeProvider';
import { size } from '@/theme/tokens';

// Signed in: the user's initial (opens Settings). Signed out: "Sign in".
// Empty while the session loads, so it never flashes "Sign in".
export default function AccountButton() {
  const { user, loading } = useAuth();
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);

  if (loading) return <View style={styles.slot} />;

  if (user) {
    const email = user.email ?? '';
    return (
      <Pressable
        onPress={() => router.navigate('/settings')}
        accessibilityRole="button"
        accessibilityLabel={`Signed in as ${email}. Open account settings`}
        style={[styles.avatar, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
      >
        <AppText bold>{(email.trim()[0] ?? '?').toUpperCase()}</AppText>
      </Pressable>
    );
  }

  return (
    <>
      <Button kind="secondary" label="Sign in" onPress={() => setOpen(true)} />
      <AuthSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  slot: { width: size.tap, height: size.tap },
  avatar: {
    width: size.tap,
    height: size.tap,
    borderRadius: size.tap / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
