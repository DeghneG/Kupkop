import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router, useGlobalSearchParams } from 'expo-router';
import { completeOAuth } from '@/lib/supabase';
import { useTheme } from '@/theme/ThemeProvider';

// Google sends the browser back to kupkop://auth/callback?code=...
// On Android the router also opens this route, so finish sign-in here and go home.
export default function AuthCallback() {
  const { colors } = useTheme();
  const params = useGlobalSearchParams<{ code?: string; error_description?: string }>();

  useEffect(() => {
    const query = new URLSearchParams();
    if (params.code) query.set('code', String(params.code));
    if (params.error_description) query.set('error_description', String(params.error_description));
    completeOAuth(`kupkop://auth/callback?${query.toString()}`).finally(() => router.replace('/'));
  }, [params.code, params.error_description]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.page }}>
      <ActivityIndicator color={colors.fgMuted} />
    </View>
  );
}
