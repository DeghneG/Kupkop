// Base building blocks. They hold the design floor: tokens only, 12px minimum text,
// primary 48px / secondary 44px, no nested cards.
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { brandFont, radius, size, type as typeScale, weight } from '@/theme/tokens';
import type { ColorTokens } from '@/theme/tokens';

type Variant = 'caption' | 'body' | 'title' | 'display' | 'brand';

type AppTextProps = TextProps & {
  variant?: Variant;
  tone?: keyof ColorTokens;
  bold?: boolean;
};

export function AppText({ variant = 'body', tone = 'fg', bold, style, ...rest }: AppTextProps) {
  const { colors } = useTheme();
  const brand = variant === 'brand';
  const base: TextStyle = {
    color: colors[tone],
    fontSize:
      variant === 'caption'
        ? typeScale.caption
        : variant === 'title'
          ? typeScale.title
          : variant === 'display' || variant === 'brand'
            ? typeScale.display
            : typeScale.body,
    // The brand face carries its own weight
    fontWeight: brand ? undefined : bold || variant === 'title' || variant === 'display' ? weight.semibold : weight.regular,
    fontFamily: brand ? brandFont : undefined,
    letterSpacing: brand ? -0.3 : undefined,
  };
  return <Text style={[base, style]} {...rest} />;
}

type ButtonKind = 'primary' | 'secondary' | 'emergency' | 'ghost';

type ButtonProps = Omit<PressableProps, 'style'> & {
  label: string;
  kind?: ButtonKind;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function Button({ label, kind = 'primary', loading, icon, disabled, style, ...rest }: ButtonProps) {
  const { colors } = useTheme();
  const palette = {
    primary: { bg: colors.action, fg: colors.actionFg, border: colors.action },
    emergency: { bg: colors.accent, fg: colors.accentFg, border: colors.accent },
    secondary: { bg: colors.surface, fg: colors.fg, border: colors.border },
    ghost: { bg: 'transparent', fg: colors.link, border: 'transparent' },
  }[kind];
  const isPrimary = kind === 'primary' || kind === 'emergency';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled || !!loading, busy: !!loading }}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        {
          minHeight: isPrimary ? size.primary : size.secondary,
          backgroundColor: palette.bg,
          borderColor: palette.border,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}
      {...rest}
    >
      {loading ? <ActivityIndicator color={palette.fg} /> : icon}
      <Text style={[styles.buttonLabel, { color: palette.fg }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  buttonLabel: {
    fontSize: typeScale.body,
    fontWeight: weight.semibold,
  },
});
