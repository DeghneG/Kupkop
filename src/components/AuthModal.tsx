'use client';

import React, { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { createClient } from '@/lib/supabase/client';
import { X, Mail, CheckCircle2, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Reset internal states when opened
  useEffect(() => {
    if (isOpen) {
      setSent(false);
      setErrorMsg(null);
    }
  }, [isOpen]);

  // Escape key listener
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // GSAP animated entrance respecting prefers-reduced-motion
  useGSAP(
    () => {
      if (!isOpen || !sheetRef.current || !backdropRef.current) return;

      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: reduce)', () => {
        gsap.set(backdropRef.current, { opacity: 1 });
        gsap.set(sheetRef.current, { y: '0%', opacity: 1 });
      });

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.fromTo(
          backdropRef.current,
          { opacity: 0 },
          { opacity: 1, duration: 0.22, ease: 'power2.out' }
        );
        gsap.fromTo(
          sheetRef.current,
          { y: '100%', opacity: 0.8 },
          { y: '0%', opacity: 1, duration: 0.32, ease: 'power3.out' }
        );
      });

      closeButtonRef.current?.focus();

      return () => mm.revert();
    },
    { dependencies: [isOpen], scope: containerRef }
  );

  // GSAP animated exit
  const handleClose = () => {
    if (!sheetRef.current || !backdropRef.current) {
      onClose();
      return;
    }

    const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (isReduced) {
      onClose();
      return;
    }

    gsap.to(backdropRef.current, {
      opacity: 0,
      duration: 0.18,
      ease: 'power2.in',
    });

    gsap.to(sheetRef.current, {
      y: '100%',
      opacity: 0.5,
      duration: 0.24,
      ease: 'power3.in',
      onComplete: onClose,
    });
  };

  if (!isOpen) return null;

  const supabase = createClient();

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setErrorMsg(null);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setErrorMsg(error.message);
      } else {
        setSent(true);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to send sign-in link.';
      setErrorMsg(message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) setErrorMsg(error.message);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Google sign-in error.';
      setErrorMsg(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
    >
      {/* Dimmed backdrop with click-to-dismiss */}
      <div
        ref={backdropRef}
        onClick={handleClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm cursor-pointer"
        aria-hidden="true"
      />

      {/* Modal Card / Bottom Sheet Container */}
      <div
        ref={sheetRef}
        className="relative z-10 w-full max-w-sm sm:max-w-md bg-surface border-t sm:border border-border rounded-t-[24px] sm:rounded-[24px] p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,16px))] sm:pb-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto"
      >
        {/* Mobile drag handle */}
        <div className="sm:hidden w-10 h-1 bg-border rounded-full mx-auto -mt-2 mb-3" aria-hidden="true" />

        {/* Accessible 44px Close Button */}
        <button
          ref={closeButtonRef}
          type="button"
          onClick={handleClose}
          className="absolute top-4 right-4 w-11 h-11 min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-fg-muted hover:text-fg bg-surface-muted hover:bg-border/60 transition-colors cursor-pointer"
          aria-label="Close dialog"
        >
          <X className="w-4 h-4" />
        </button>

        {sent ? (
          <div className="text-center py-4 space-y-3.5">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h2 id="auth-modal-title" className="text-[18px] font-semibold text-fg">
              Check your email
            </h2>
            <p className="text-[14px] text-fg-muted leading-relaxed px-2">
              We sent a magic sign-in link to <strong className="text-fg break-all">{email}</strong>. Click the link in your email to continue.
            </p>

            <div className="pt-2 space-y-2">
              <button
                type="button"
                onClick={handleClose}
                className="w-full min-h-[48px] bg-action hover:opacity-95 text-white font-semibold text-[14px] rounded-xl transition-opacity cursor-pointer shadow-sm"
              >
                Done
              </button>
              
              {/* Typo recovery link */}
              <button
                type="button"
                onClick={() => setSent(false)}
                className="w-full min-h-[40px] text-[13px] font-medium text-link hover:underline flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Use a different email</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="pr-10">
              <h2 id="auth-modal-title" className="text-[22px] font-semibold tracking-tight text-fg font-brand">
                Sign in to <span className="text-fg">KupKop</span>
              </h2>
              <p className="text-[14px] text-fg-muted mt-0.5">
                Save reports, claim rescues, and track animal recovery.
              </p>
            </div>

            {errorMsg && (
              <div
                role="alert"
                className="flex items-start gap-2 p-3 rounded-xl bg-reported-bg text-reported-fg border border-reported-fg/20 text-[12px] font-medium"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Email Magic Link Form */}
            <form onSubmit={handleEmailSignIn} className="space-y-3 pt-1">
              <div>
                <label htmlFor="auth-email-input" className="block text-[12px] font-semibold text-fg mb-1">
                  Email address
                </label>
                <input
                  id="auth-email-input"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full min-h-[48px] px-3.5 text-[14px] bg-surface-muted text-fg rounded-xl border border-border outline-none focus:ring-2 focus:ring-action"
                />
              </div>

              {/* Primary Action Button (Neutral Blue --action, NOT Emergency Red --accent) */}
              <button
                type="submit"
                disabled={loading}
                className="w-full min-h-[48px] bg-action hover:opacity-95 text-white font-semibold text-[14px] rounded-xl flex items-center justify-center gap-2 shadow-sm transition-opacity disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Mail className="w-4 h-4" />
                )}
                <span>Send Magic Link</span>
              </button>
            </form>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-border" />
              <span className="flex-shrink mx-3 text-[12px] text-fg-muted uppercase">or</span>
              <div className="flex-grow border-t border-border" />
            </div>

            {/* Google OAuth Button */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full min-h-[44px] bg-surface hover:bg-surface-muted text-fg border border-border font-semibold text-[14px] rounded-xl flex items-center justify-center gap-2.5 transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
