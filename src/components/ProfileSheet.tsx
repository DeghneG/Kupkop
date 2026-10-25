'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { X, User, Sun, Moon, Laptop, ShieldAlert, LogOut, LogIn } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { useThemeMode, MockRole } from '@/lib/storage';

interface ProfileSheetProps {
  isOpen: boolean;
  onClose: () => void;
  mockRole: MockRole;
  onRoleChange: (role: MockRole) => void;
  onOpenAuth: () => void;
  triggerElement?: HTMLElement | null;
}

export default function ProfileSheet({
  isOpen,
  onClose,
  mockRole,
  onRoleChange,
  onOpenAuth,
  triggerElement,
}: ProfileSheetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const [themeMode, handleThemeChange] = useThemeMode();
  const [user, setUser] = useState<SupabaseUser | null>(null);

  // Read auth on mount
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Animate out and return focus to trigger element
  const handleClose = useCallback(() => {
    if (!sheetRef.current || !backdropRef.current) {
      onClose();
      triggerElement?.focus();
      return;
    }

    const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (isReduced) {
      onClose();
      triggerElement?.focus();
      return;
    }

    gsap.to(backdropRef.current, {
      opacity: 0,
      duration: 0.2,
      ease: 'power2.in',
    });

    gsap.to(sheetRef.current, {
      y: '100%',
      duration: 0.25,
      ease: 'power3.in',
      onComplete: () => {
        onClose();
        triggerElement?.focus();
      },
    });
  }, [onClose, triggerElement]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  // Animate in using GSAP with prefers-reduced-motion check
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
          { opacity: 1, duration: 0.25, ease: 'power2.out' }
        );
        gsap.fromTo(
          sheetRef.current,
          { y: '100%' },
          { y: '0%', duration: 0.35, ease: 'power3.out' }
        );
      });

      // Move focus into the sheet
      closeButtonRef.current?.focus();

      return () => mm.revert();
    },
    { dependencies: [isOpen], scope: containerRef }
  );

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
  };

  if (!isOpen) return null;

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-sheet-title"
      className="fixed inset-0 z-50 flex items-end justify-center"
    >
      {/* Dimmed backdrop */}
      <div
        ref={backdropRef}
        onClick={handleClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm cursor-pointer"
        aria-hidden="true"
      />

      {/* Bottom Sheet */}
      <div
        ref={sheetRef}
        className="relative z-10 w-full max-w-md bg-surface border-t border-border rounded-t-[24px] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col pb-[env(safe-area-inset-bottom,20px)]"
      >
        {/* Drag handle / top bar */}
        <div className="pt-3 pb-2 flex items-center justify-between px-5">
          <div className="w-10 h-1 bg-border rounded-full mx-auto -mr-1" aria-hidden="true" />
          <button
            ref={closeButtonRef}
            type="button"
            onClick={handleClose}
            className="w-10 h-10 min-w-[40px] min-h-[40px] rounded-full bg-surface-muted hover:bg-border/60 text-fg-muted hover:text-fg flex items-center justify-center transition-colors cursor-pointer shrink-0"
            aria-label="Close profile"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto px-5 pb-6 space-y-6">
          <div>
            <h2 id="profile-sheet-title" className="text-[22px] font-semibold text-fg tracking-tight">
              Profile & Settings
            </h2>
            <p className="text-[12px] text-fg-muted font-normal mt-0.5">
              Account status, display preferences, and test environment controls.
            </p>
          </div>

          {/* 1. Account / Sign In section */}
          <div className="bg-surface-muted rounded-[18px] p-4 border border-border space-y-3">
            <span className="text-[12px] font-semibold uppercase tracking-wider text-fg-muted">
              Account
            </span>

            {user ? (
              <div className="flex items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center text-fg font-semibold text-[14px] shrink-0">
                    <User className="w-5 h-5 text-fg-muted" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-fg truncate">
                      {user.email}
                    </p>
                    <p className="text-[12px] text-fg-muted">Signed in via Supabase Auth</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSignOut}
                  className="min-h-[40px] px-3.5 rounded-[12px] bg-surface hover:bg-border/60 border border-border text-fg font-semibold text-[12px] flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                >
                  <LogOut className="w-3.5 h-3.5 text-fg-muted" aria-hidden="true" />
                  <span>Sign out</span>
                </button>
              </div>
            ) : (
              <div className="pt-1 space-y-2">
                <p className="text-[14px] text-fg-muted">
                  Sign in to track emergency rescues and verify responder applications.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    handleClose();
                    onOpenAuth();
                  }}
                  className="w-full min-h-[44px] bg-action text-white font-semibold text-[14px] rounded-[14px] flex items-center justify-center gap-2 shadow-sm hover:opacity-95 transition-opacity cursor-pointer border-none"
                >
                  <LogIn className="w-4 h-4 text-white" aria-hidden="true" />
                  <span>Sign in to KupKop</span>
                </button>
              </div>
            )}
          </div>

          {/* 2. Theme: 3-Option iOS Segmented Control */}
          <div className="bg-surface-muted rounded-[18px] p-4 border border-border space-y-3">
            <span className="text-[12px] font-semibold uppercase tracking-wider text-fg-muted">
              Appearance
            </span>

            {/* iOS 3-Segment Pill Control */}
            <div
              role="radiogroup"
              aria-label="Theme switcher"
              className="grid grid-cols-3 p-1 bg-surface rounded-[14px] border border-border gap-1"
            >
              <button
                type="button"
                role="radio"
                aria-checked={themeMode === 'system'}
                onClick={() => handleThemeChange('system')}
                className={`min-h-[38px] rounded-[10px] text-[12px] font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  themeMode === 'system'
                    ? 'bg-surface-muted text-fg shadow-sm border border-border'
                    : 'text-fg-muted hover:text-fg'
                }`}
              >
                <Laptop className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>System</span>
              </button>

              <button
                type="button"
                role="radio"
                aria-checked={themeMode === 'light'}
                onClick={() => handleThemeChange('light')}
                className={`min-h-[38px] rounded-[10px] text-[12px] font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  themeMode === 'light'
                    ? 'bg-surface-muted text-fg shadow-sm border border-border'
                    : 'text-fg-muted hover:text-fg'
                }`}
              >
                <Sun className="w-3.5 h-3.5 text-amber-500 shrink-0" aria-hidden="true" />
                <span>Light</span>
              </button>

              <button
                type="button"
                role="radio"
                aria-checked={themeMode === 'dark'}
                onClick={() => handleThemeChange('dark')}
                className={`min-h-[38px] rounded-[10px] text-[12px] font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  themeMode === 'dark'
                    ? 'bg-surface-muted text-fg shadow-sm border border-border'
                    : 'text-fg-muted hover:text-fg'
                }`}
              >
                <Moon className="w-3.5 h-3.5 text-sky-400 shrink-0" aria-hidden="true" />
                <span>Dark</span>
              </button>
            </div>
          </div>

          {/* 3. DEV Role Selector */}
          {/* DEV ONLY (mock role): In production, role is stored in profiles.role in Supabase Postgres and approved by admin. This selector must be removed before real auth and RLS integration. */}
          <div className="bg-surface-muted rounded-[18px] p-4 border border-border space-y-3">
            <div className="flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-banner-fg shrink-0" aria-hidden="true" />
              <span className="text-[12px] font-semibold uppercase tracking-wider text-fg-muted">
                DEV ONLY (mock role)
              </span>
            </div>

            <p className="text-[12px] text-fg-muted font-normal">
              Simulates different permission levels for local prototype validation.
            </p>

            <div className="grid grid-cols-2 gap-2 pt-1">
              {(['citizen', 'volunteer', 'facility', 'admin'] as MockRole[]).map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => onRoleChange(role)}
                  className={`min-h-[42px] px-3 rounded-[12px] text-[12px] font-semibold capitalize flex items-center justify-between border transition-all cursor-pointer ${
                    mockRole === role
                      ? 'bg-accent text-accent-fg border-accent shadow-sm'
                      : 'bg-surface text-fg border-border hover:bg-border/60'
                  }`}
                >
                  <span>{role}</span>
                  {mockRole === role && <span className="text-[10px] uppercase">Active</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
