import React, { useEffect, useState } from 'react';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from 'react-native-reanimated';
import { X } from 'lucide-react-native';
import { AppText, Button } from '@/components/ui';
import { supabase, API_BASE, completeOAuth } from '@/lib/supabase';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, size, type as typeScale } from '@/theme/tokens';

type Mode = 'login' | 'signup';

/**
 * Whether Google is switched on in Supabase. A disabled provider fails on Supabase's own error page,
 * so check first (same as web). null = unknown: show the button and let it try.
 */
function useGoogleEnabled(active: boolean): boolean | null {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  useEffect(() => {
    const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    if (!active || !url || !key) return;
    let live = true;
    fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } })
      .then((res) => (res.ok ? res.json() : null))
      .then((settings) => {
        if (live && settings?.external) setEnabled(!!settings.external.google);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [active]);
  return enabled;
}

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Called once a session exists (SOS uses it to send the staged report) */
  onSignedIn?: () => void;
  title?: string;
};

// Email + code sign-in. Phones have no shared browser session, so the code (not the link)
// is the main path: it signs in this app directly.
export default function AuthSheet({ visible, onClose, onSignedIn, title }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noAccount, setNoAccount] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const googleEnabled = useGoogleEnabled(visible);

  // Google opens in an in-app browser and returns to kupkop://auth/callback with a one-time code
  const signInWithGoogle = async () => {
    setGoogleBusy(true);
    setError(null);
    try {
      const redirectTo = Linking.createURL('auth/callback');
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (oauthError || !data?.url) throw new Error(oauthError?.message || 'Could not start Google sign-in.');
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type === 'success') {
        const failure = await completeOAuth(result.url);
        if (failure) throw new Error(failure);
      }
      // On Android the callback route may finish sign-in instead; either way check for a session
      const { data: s } = await supabase.auth.getSession();
      if (s.session) {
        reset();
        onSignedIn?.();
        onClose();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Google sign-in failed. Please try again.');
    } finally {
      setGoogleBusy(false);
    }
  };

  const reset = () => {
    setStep('email');
    setCode('');
    setError(null);
    setNoAccount(false);
    setBusy(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const sendCode = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Enter a valid email address.');
      return;
    }
    setBusy(true);
    setError(null);
    setNoAccount(false);
    try {
      // Same check as the web app: real, deliverable domain
      const res = await fetch(`${API_BASE}/api/auth/validate-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      });
      const check = await res.json().catch(() => ({ valid: true }));
      if (!res.ok || check.valid === false) {
        setError(check.reason || 'Please enter a valid, existing email address.');
        return;
      }

      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: { shouldCreateUser: mode === 'signup' },
      });
      if (otpError) {
        if (mode === 'login' && (otpError.status === 422 || /signups not allowed/i.test(otpError.message))) {
          setError('No account uses this email yet. Check the spelling, or create an account.');
          setNoAccount(true);
        } else if (otpError.status === 429) {
          setError('Too many sign-in emails were sent in the last hour. Please try again later.');
        } else {
          setError(otpError.message);
        }
        return;
      }
      setStep('code');
    } catch {
      setError('Could not reach KupKop. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    const token = code.replace(/\D/g, '');
    if (token.length < 6) {
      setError('Enter the code from the email.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: verifyError } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token, type: 'email' });
    setBusy(false);
    if (verifyError) {
      setError(
        /expired/i.test(verifyError.message)
          ? 'That code has expired. Go back and send a new one.'
          : 'That code did not match. Check the latest email and try again.'
      );
      return;
    }
    reset();
    onSignedIn?.();
    onClose();
  };

  const inputStyle = [
    styles.input,
    { backgroundColor: colors.surfaceMuted, color: colors.fg, borderColor: colors.border },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduceMotion ? 'none' : 'slide'}
      onRequestClose={close}
      statusBarTranslucent
    >
      <View style={[styles.backdrop, { backgroundColor: colors.scrim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close sign in" />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View
            style={[
              styles.sheet,
              { backgroundColor: colors.surface, borderColor: colors.border, paddingBottom: insets.bottom + 24 },
            ]}
          >
            <Pressable
              onPress={close}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={[styles.close, { backgroundColor: colors.surfaceMuted }]}
            >
              <X size={18} color={colors.fgMuted} />
            </Pressable>

            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 16 }}>
              {step === 'email' ? (
                <>
                  <View style={{ gap: 4, paddingRight: 48 }}>
                    <AppText variant="display" accessibilityRole="header">
                      {title ?? (mode === 'login' ? 'Log in to KupKop' : 'Create your account')}
                    </AppText>
                    <AppText tone="fgMuted">
                      Free. Save your reports, volunteer for rescues, and follow recoveries.
                    </AppText>
                  </View>

                  <View style={[styles.segment, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
                    {(['login', 'signup'] as const).map((m) => (
                      <Pressable
                        key={m}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: mode === m }}
                        onPress={() => {
                          setMode(m);
                          setError(null);
                          setNoAccount(false);
                        }}
                        style={[styles.segmentItem, mode === m && { backgroundColor: colors.surface }]}
                      >
                        <AppText bold tone={mode === m ? 'fg' : 'fgMuted'}>
                          {m === 'login' ? 'Log in' : 'Create account'}
                        </AppText>
                      </Pressable>
                    ))}
                  </View>

                  <Button
                    kind="secondary"
                    label={googleEnabled === false ? 'Google sign-in not set up yet' : 'Continue with Google'}
                    onPress={signInWithGoogle}
                    loading={googleBusy}
                    disabled={googleEnabled === false || busy}
                  />
                  <View style={styles.divider}>
                    <View style={[styles.rule, { backgroundColor: colors.border }]} />
                    <AppText variant="caption" tone="fgMuted">
                      or use email
                    </AppText>
                    <View style={[styles.rule, { backgroundColor: colors.border }]} />
                  </View>

                  <View style={{ gap: 6 }}>
                    <AppText variant="caption" bold>
                      Email address
                    </AppText>
                    <TextInput
                      value={email}
                      onChangeText={setEmail}
                      placeholder="name@example.com"
                      placeholderTextColor={colors.fgMuted}
                      autoCapitalize="none"
                      autoComplete="email"
                      keyboardType="email-address"
                      textContentType="emailAddress"
                      editable={!busy}
                      style={inputStyle}
                      onSubmitEditing={sendCode}
                      accessibilityLabel="Email address"
                    />
                  </View>

                  {error && (
                    <View style={{ gap: 8 }}>
                      <AppText variant="caption" tone="reportedFg" accessibilityRole="alert">
                        {error}
                      </AppText>
                      {noAccount && (
                        <Button
                          kind="secondary"
                          label="Create an account with this email"
                          onPress={() => {
                            setMode('signup');
                            setError(null);
                            setNoAccount(false);
                          }}
                        />
                      )}
                    </View>
                  )}

                  <Button
                    label={mode === 'login' ? 'Email me a sign-in code' : 'Email me a code to create my account'}
                    onPress={sendCode}
                    loading={busy}
                  />
                  <AppText variant="caption" tone="fgMuted" style={{ textAlign: 'center' }}>
                    No password needed. The code signs you in.
                  </AppText>
                </>
              ) : (
                <>
                  <View style={{ gap: 4, paddingRight: 48 }}>
                    <AppText variant="display" accessibilityRole="header">
                      Check your email
                    </AppText>
                    <AppText tone="fgMuted">
                      We sent a code to <AppText bold>{email.trim()}</AppText>. Type it here.
                    </AppText>
                  </View>
                  <TextInput
                    value={code}
                    onChangeText={setCode}
                    keyboardType="number-pad"
                    autoComplete="one-time-code"
                    textContentType="oneTimeCode"
                    maxLength={10}
                    editable={!busy}
                    autoFocus
                    style={[inputStyle, styles.codeInput]}
                    onSubmitEditing={verify}
                    accessibilityLabel="Code from the email"
                  />
                  {error && (
                    <AppText variant="caption" tone="reportedFg" accessibilityRole="alert">
                      {error}
                    </AppText>
                  )}
                  <Button label="Sign in with code" onPress={verify} loading={busy} />
                  <Button kind="ghost" label="Use a different email" onPress={reset} />
                </>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    padding: 24,
    maxHeight: '92%',
  },
  close: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: size.tap,
    height: size.tap,
    borderRadius: size.tap / 2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  segment: { flexDirection: 'row', borderWidth: 1, borderRadius: radius.lg, padding: 4, gap: 4 },
  segmentItem: {
    flex: 1,
    minHeight: size.tap,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  input: {
    minHeight: size.primary,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    fontSize: typeScale.title,
  },
  codeInput: { textAlign: 'center', letterSpacing: 6, fontSize: typeScale.display },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rule: { flex: 1, height: 1 },
});
