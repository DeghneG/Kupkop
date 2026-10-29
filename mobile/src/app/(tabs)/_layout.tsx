import React from 'react';
import { Tabs } from 'expo-router/js-tabs';
import Dock from '@/components/Dock';
import { useTheme } from '@/theme/ThemeProvider';

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      tabBar={(props) => <Dock {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.page } }}
    >
      <Tabs.Screen name="index" options={{ title: 'Feed' }} />
      <Tabs.Screen name="rafa" options={{ title: 'Rafa AI' }} />
      <Tabs.Screen name="clinics" options={{ title: 'Clinics' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
