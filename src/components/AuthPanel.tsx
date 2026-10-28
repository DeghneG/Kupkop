'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Mail, CheckCircle2, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';

export type AuthMode = 'login' | 'signup';
type OAuthProvider = 'google' | 'facebook';

interface AuthPanelProps {
  /** Id for the heading, so a dialog can point aria-labelledby at it. */
  headingId?: string;
  initialMode?: AuthMode;
  /** Where to land after the email link or OAuth round trip. Defaults to the current page. */
  redirectPath?: string;
  /** Shown as a "Done" button once the email link is sent (the modal uses it to close). */
  onDone?: () => void;
}

const PROVIDER_LABEL: Record<OAuthProvider, string> = { google: 'Google', facebook: 'Facebook' };

/**
 * Which social providers are switched on in Supabase. A disabled provider fails on Supabase's own
 * error page after the redirect, so we check first. null = unknown (show the buttons and let it try).
 */
function useEnabledProviders(): Record<OAuthProvider, boolean> | null {
  const [enabled, setEnabled] = useState<Record<OAuthProvider, boolean> | null>(null);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;
    let active = true;
    fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } })
      .then((res) => (res.ok ? res.json() : null))
      .then((settings) => {
        if (!active || !settings?.external) return;
        setEnabled({ google: !!settings.external.google, facebook: !!settings.external.facebook });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  return enabled;
}

// Shared sign-in form: email magic link (log in or create account), Google, and Facebook.
// Used by the landing page and by AuthModal.
export default function AuthPanel({ headingId, initialMode = 'login', redirectPath, onDone }: AuthPanelProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState<'email' | OAuthProvider | null>(null);
  const [sent, setSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isNonExistent, setIsNonExistent] = useState(false);
  const enabledProviders = useEnabledProviders();
  const isOff = (provider: OAuthProvider) => enabledProviders !== null && !enabledProviders[provider];

  const callbackUrl = () => {
    const next = redirectPath ?? window.location.pathname;
    return `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
  };

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setErrorMsg(null);
    setIsNonExistent(false);
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;

    setLoading('email');
    setErrorMsg(null);
    setIsNonExistent(false);

    try {
      // 1. Verify that email has valid format and a real, deliverable domain (DNS MX check)
      const validateRes = await fetch('/api/auth/validate-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      });

      const validateData = await validateRes.json();
      if (!validateRes.ok || !validateData.valid) {
        setErrorMsg(validateData.reason || 'Please enter a valid, existing email address.');
        return;
      }

      // 2. Request OTP from Supabase (enforcing existing user when logging in)
      const { error } = await createClient().auth.signInWithOtp({
        email: trimmed,
        options: {
          shouldCreateUser: mode === 'signup',
          emailRedirectTo: callbackUrl(),
        },
      });

      if (error) {
        // When in login mode and the user does not exist in Supabase auth
        if (
          mode === 'login' &&
          (error.status === 422 ||
            error.code === 'otp_disabled' ||
            error.message?.toLowerCase().includes('signups not allowed'))
        ) {
          setErrorMsg('No account uses this email yet. Check the spelling, or create an account.');
          setIsNonExistent(true);
        } else {
          setErrorMsg(error.message);
        }
      } else {
        setSent(true);
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to send sign-in link.');
    } finally {
      setLoading(null);
    }
  };

  const handleOAuth = async (provider: OAuthProvider) => {
    setLoading(provider);
    setErrorMsg(null);
    try {
      const { error } = await createClient().auth.signInWithOAuth({
        provider,
        options: { redirectTo: callbackUrl() },
      });
      if (error) {
        // Supabase answers this way until the provider is switched on in the dashboard
        setErrorMsg(
          /not enabled|unsupported provider/i.test(error.message)
            ? `${PROVIDER_LABEL[provider]} sign-in isn't set up yet. Use email for now.`
            : error.message
        );
        setLoading(null);
      }
      // On success the browser leaves for the provider, so the spinner stays until then
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : `${PROVIDER_LABEL[provider]} sign-in error.`);
      setLoading(null);
    }
  };

  if (sent) {
    return (
      <div className="text-center py-4 space-y-3">
        <div className="w-12 h-12 rounded-full bg-resolved-bg text-resolved-fg flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-6 h-6" aria-hidden="true" />
        </div>
        <h2 id={headingId} className="text-[22px] font-semibold text-fg">
          Check your email
        </h2>
        <p className="text-[14px] text-fg-muted leading-relaxed px-2">
          We sent a sign-in link to <strong className="text-fg break-all">{email}</strong>. Open it on this
          device to continue.
        </p>

        <div className="pt-2 space-y-2">
          {onDone && (
            <button
              type="button"
              onClick={onDone}
              className="w-full min-h-[48px] bg-action hover:opacity-95 text-action-fg font-semibold text-[14px] rounded-xl transition-opacity cursor-pointer"
            >
              Done
            </button>
          )}
          <button
            type="button"
            onClick={() => setSent(false)}
            className="w-full min-h-[44px] text-[14px] text-link hover:underline flex items-center justify-center gap-2 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Use a different email</span>
          </button>
        </div>
      </div>
    );
  }

  const busy = loading !== null;

  return (
    <div className="space-y-4">
      <div>
        <h2 id={headingId} className="text-[22px] font-semibold tracking-tight text-fg font-brand">
          {mode === 'login' ? 'Log in to KupKop' : 'Create your account'}
        </h2>
        <p className="text-[14px] text-fg-muted mt-1">
          {mode === 'login'
            ? 'Welcome back. Pick how you signed up.'
            : 'Free. Save your reports, volunteer for rescues, and follow recoveries.'}
        </p>
      </div>

      {/* Log in vs create account */}
      <div role="tablist" aria-label="Account" className="flex p-1 bg-surface-muted rounded-full border border-border">
        {(['login', 'signup'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => switchMode(m)}
            className={`flex-1 min-h-[40px] text-[14px] font-semibold rounded-full transition-colors cursor-pointer border ${
              mode === m ? 'bg-surface text-fg border-border' : 'text-fg-muted hover:text-fg border-transparent'
            }`}
          >
            {m === 'login' ? 'Log in' : 'Create account'}
          </button>
        ))}
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="flex items-start gap-2 p-3 rounded-xl bg-reported-bg text-reported-fg text-[12px]"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-1">
            <div>{errorMsg}</div>
            {isNonExistent && (
              <button
                type="button"
                onClick={() => switchMode('signup')}
                className="min-h-[32px] text-[12px] font-semibold underline text-link hover:opacity-80 cursor-pointer"
              >
                Create an account with this email
              </button>
            )}
          </div>
        </div>
      )}

      {/* Social sign-in first: one tap, no inbox round trip */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => handleOAuth('google')}
          disabled={busy || isOff('google')}
          className="w-full min-h-[48px] bg-surface hover:bg-surface-muted text-fg border border-border font-semibold text-[14px] rounded-xl flex items-center justify-center gap-3 transition-colors disabled:opacity-50 cursor-pointer"
        >
          {loading === 'google' ? (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          ) : (
            // Brand mark keeps Google's own colors
            <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
          )}
          <span>{isOff('google') ? 'Google sign-in not set up yet' : 'Continue with Google'}</span>
        </button>

        <button
          type="button"
          onClick={() => handleOAuth('facebook')}
          disabled={busy || isOff('facebook')}
          className="w-full min-h-[48px] bg-surface hover:bg-surface-muted text-fg border border-border font-semibold text-[14px] rounded-xl flex items-center justify-center gap-3 transition-colors disabled:opacity-50 cursor-pointer"
        >
          {loading === 'facebook' ? (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          ) : (
            // Brand mark keeps Facebook's own blue
            <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#1877F2"
                d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z"
              />
            </svg>
          )}
          <span>{isOff('facebook') ? 'Facebook sign-in not set up yet' : 'Continue with Facebook'}</span>
        </button>
      </div>

      <div className="flex items-center gap-3" aria-hidden="true">
        <div className="flex-1 border-t border-border" />
        <span className="text-[12px] text-fg-muted">or use email</span>
        <div className="flex-1 border-t border-border" />
      </div>

      {/* Email magic link: no password to remember */}
      <form onSubmit={handleEmailSignIn} className="space-y-3">
        <div>
          <label htmlFor={`${headingId ?? 'auth'}-email`} className="block text-[12px] font-semibold text-fg mb-1">
            Email address
          </label>
          <input
            id={`${headingId ?? 'auth'}-email`}
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (isNonExistent) setIsNonExistent(false);
            }}
            placeholder="name@example.com"
            className="w-full min-h-[48px] px-4 text-[14px] bg-surface-muted text-fg placeholder:text-fg-muted rounded-xl border border-border outline-none focus:ring-2 focus:ring-action"
          />
        </div>

        <button
          type="submit"
          disabled={busy}
          className="w-full min-h-[48px] bg-action hover:opacity-95 text-action-fg font-semibold text-[14px] rounded-xl flex items-center justify-center gap-2 transition-opacity disabled:opacity-50 cursor-pointer"
        >
          {loading === 'email' ? (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          ) : (
            <Mail className="w-4 h-4" aria-hidden="true" />
          )}
          <span>{mode === 'login' ? 'Email me a sign-in link' : 'Email me a link to create my account'}</span>
        </button>
        <p className="text-[12px] text-fg-muted text-center">No password needed. The link signs you in.</p>
      </form>
    </div>
  );
}
