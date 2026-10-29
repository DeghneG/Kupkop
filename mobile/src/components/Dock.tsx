import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Building2, Camera, Home, MessageSquareHeart, Settings } from 'lucide-react-native';
import { AppText } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/tokens';

const TABS: Record<string, { label: string; Icon: typeof Home }> = {
  index: { label: 'Feed', Icon: Home },
  rafa: { label: 'Rafa AI', Icon: MessageSquareHeart },
  clinics: { label: 'Clinics', Icon: Building2 },
  settings: { label: 'Settings', Icon: Settings },
};

// Floating dock with the coral SOS button in the middle, like the web app.
// SOS is its own full-screen route, so it opens without the dock.
export default function Dock({ state, navigateToTab }: BottomTabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const routes = state.routes.filter((r) => TABS[r.name]);

  const renderTab = (route: (typeof state.routes)[number]) => {
    const { label, Icon } = TABS[route.name];
    const focused = state.routes[state.index]?.key === route.key;
    return (
      <Pressable
        key={route.key}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={label}
        onPress={() => {
          if (!focused) navigateToTab(route.key);
        }}
        style={[styles.tab, focused && { backgroundColor: colors.surfaceMuted }]}
      >
        <Icon size={20} color={focused ? colors.fg : colors.fgMuted} />
        <AppText variant="caption" tone={focused ? 'fg' : 'fgMuted'} bold={focused}>
          {label}
        </AppText>
      </Pressable>
    );
  };

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 12) }]} pointerEvents="box-none">
      <View style={[styles.dock, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {routes.slice(0, 2).map(renderTab)}
        <View style={styles.sosSlot}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Report an emergency"
            onPress={() => router.push('/sos')}
            style={({ pressed }) => [
              styles.sos,
              { backgroundColor: colors.accent, borderColor: colors.surface, opacity: pressed ? 0.9 : 1 },
            ]}
          >
            <Camera size={22} color={colors.accentFg} />
            <AppText variant="caption" bold style={{ color: colors.accentFg }}>
              SOS
            </AppText>
          </Pressable>
        </View>
        {routes.slice(2).map(renderTab)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
  },
  dock: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: 6,
    gap: 4,
  },
  tab: {
    flex: 1,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: radius.lg,
  },
  sosSlot: { flex: 1, alignItems: 'center' },
  sos: {
    width: 64,
    height: 64,
    marginTop: -28,
    borderRadius: 32,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

/** Space screens leave at the bottom so content clears the floating dock */
export const DOCK_SPACE = 104;
