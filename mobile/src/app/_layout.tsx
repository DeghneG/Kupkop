import React, { useEffect } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, BricolageGrotesque_600SemiBold } from '@expo-google-fonts/bricolage-grotesque';
import { useReducedMotion } from 'react-native-reanimated';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import { AuthProvider } from '@/lib/auth';
import TestModeBanner from '@/components/TestModeBanner';

SplashScreen.preventAutoHideAsync();

function RootStack() {
  const { colors, isDark } = useTheme();
  const reduceMotion = useReducedMotion();

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <TestModeBanner />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.page },
          animation: reduceMotion ? 'none' : 'default',
        }}
      >
        <Stack.Screen name="(tabs)" />
        {/* SOS opens full screen without the dock; the camera screen has no motion besides the shutter flash */}
        <Stack.Screen name="sos" options={{ animation: 'none', gestureEnabled: false }} />
        <Stack.Screen name="welcome" />
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ BricolageGrotesque_600SemiBold });

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  // Brand font only affects headings, so a font error still shows the app
  if (!fontsLoaded && !fontError) return null;

  return (
    <ThemeProvider>
      <AuthProvider>
        <RootStack />
      </AuthProvider>
    </ThemeProvider>
  );
}
