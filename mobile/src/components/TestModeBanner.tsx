import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TriangleAlert } from 'lucide-react-native';
import { AppText } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';

// Prototype rule: always visible, on every screen
export default function TestModeBanner() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      accessibilityRole="alert"
      style={[styles.banner, { backgroundColor: colors.bannerBg, paddingTop: insets.top + 6 }]}
    >
      <TriangleAlert size={16} color={colors.bannerFg} />
      <AppText variant="caption" tone="bannerFg" style={styles.text}>
        <AppText variant="caption" tone="bannerFg" bold>
          Test mode.{' '}
        </AppText>
        Not connected to 911 or real responders.
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  text: { flex: 1 },
});
