'use client';

import React, { useEffect, useState } from 'react';
import { User, Sun, Moon, Laptop, ShieldAlert, LogOut, LogIn, Info } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import AuthModal from '@/components/AuthModal';
import { useThemeMode, useMockRole, MockRole } from '@/lib/storage';

export default function SettingsPage() {
  const [themeMode, handleThemeChange] = useThemeMode();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [mockRole, handleRoleChange] = useMockRole();

  // Listen to Supabase auth state changes
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

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <div className="flex flex-col flex-1 px-5 pt-3 pb-8 space-y-6">
      {/* 1. Page Header */}
      <header className="pb-1 border-b border-border">
        <h1 className="text-[22px] font-bold tracking-tight text-fg font-brand">
          Settings
        </h1>
        <p className="text-[12px] text-fg-muted font-normal mt-0.5">
          Account, appearance, and prototype test controls.
        </p>
      </header>

      {/* 2. Account Section */}
      <section aria-labelledby="settings-account-heading" className="bg-surface rounded-2xl p-4 border border-border shadow-sm space-y-3">
        <h2 id="settings-account-heading" className="text-[12px] font-semibold uppercase tracking-wider text-fg-muted">
          Account
        </h2>

        {user ? (
          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-surface-muted border border-border flex items-center justify-center text-fg font-semibold text-[14px] shrink-0">
                <User className="w-5 h-5 text-fg-muted" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-fg truncate">
                  {user.email}
                </p>
                <p className="text-[12px] text-fg-muted">Signed in via Supabase</p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSignOut}
              className="min-h-[40px] px-3.5 rounded-xl bg-surface-muted hover:bg-border/60 border border-border text-fg font-semibold text-[12px] flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <LogOut className="w-3.5 h-3.5 text-fg-muted" aria-hidden="true" />
              <span>Sign out</span>
            </button>
          </div>
        ) : (
          <div className="pt-1 space-y-3">
            <p className="text-[14px] text-fg-muted leading-relaxed">
              Sign in to manage incident reports, claim emergency rescues, and verify responder credentials.
            </p>
            <button
              type="button"
              onClick={() => setIsAuthOpen(true)}
              className="w-full min-h-[48px] bg-action hover:opacity-95 text-action-fg font-semibold text-[14px] rounded-xl flex items-center justify-center gap-2 shadow-sm transition-opacity cursor-pointer border-none focus:outline-none focus:ring-2 focus:ring-action"
            >
              <LogIn className="w-4 h-4 text-action-fg" aria-hidden="true" />
              <span>Sign in to KupKop</span>
            </button>
          </div>
        )}
      </section>

      {/* 3. Appearance (3-Option iOS Segmented Control) */}
      <section aria-labelledby="settings-appearance-heading" className="bg-surface rounded-2xl p-4 border border-border shadow-sm space-y-3">
        <h2 id="settings-appearance-heading" className="text-[12px] font-semibold uppercase tracking-wider text-fg-muted">
          Appearance
        </h2>

        <div
          role="radiogroup"
          aria-label="Theme switcher"
          className="grid grid-cols-3 p-1 bg-surface-muted rounded-xl border border-border gap-1"
        >
          <button
            type="button"
            role="radio"
            aria-checked={themeMode === 'system'}
            onClick={() => handleThemeChange('system')}
            className={`min-h-[40px] rounded-lg text-[12px] font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              themeMode === 'system'
                ? 'bg-surface text-fg shadow-sm border border-border'
                : 'text-fg-muted hover:text-fg'
            }`}
          >
            <Laptop className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>System</span>
          </button>

          <button
            type="button"
            role="radio"
            aria-checked={themeMode === 'light'}
            onClick={() => handleThemeChange('light')}
            className={`min-h-[40px] rounded-lg text-[12px] font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              themeMode === 'light'
                ? 'bg-surface text-fg shadow-sm border border-border'
                : 'text-fg-muted hover:text-fg'
            }`}
          >
            <Sun className="w-4 h-4 text-amber-500 shrink-0" aria-hidden="true" />
            <span>Light</span>
          </button>

          <button
            type="button"
            role="radio"
            aria-checked={themeMode === 'dark'}
            onClick={() => handleThemeChange('dark')}
            className={`min-h-[40px] rounded-lg text-[12px] font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              themeMode === 'dark'
                ? 'bg-surface text-fg shadow-sm border border-border'
                : 'text-fg-muted hover:text-fg'
            }`}
          >
            <Moon className="w-4 h-4 text-sky-400 shrink-0" aria-hidden="true" />
            <span>Dark</span>
          </button>
        </div>
      </section>

      {/* 4. DEV ONLY (mock role selector) */}
      {/* DEV ONLY (mock role): In production, role is stored in profiles.role in Supabase Postgres and approved by admin. This selector must be removed before real auth and RLS integration. */}
      <section aria-labelledby="settings-dev-heading" className="bg-surface rounded-2xl p-4 border border-border shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-banner-fg shrink-0" aria-hidden="true" />
          <h2 id="settings-dev-heading" className="text-[12px] font-semibold uppercase tracking-wider text-fg-muted">
            DEV ONLY (mock role)
          </h2>
        </div>

        <p className="text-[12px] text-fg-muted font-normal leading-normal">
          Simulates different permission levels for local prototype validation. Users can never change their own role in production.
        </p>

        <div className="grid grid-cols-2 gap-2 pt-1">
          {(['citizen', 'volunteer', 'facility', 'admin'] as MockRole[]).map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => handleRoleChange(role)}
              className={`min-h-[44px] px-3.5 rounded-xl text-[12px] font-semibold capitalize flex items-center justify-between border transition-all cursor-pointer ${
                mockRole === role
                  ? 'bg-action text-action-fg border-action shadow-sm'
                  : 'bg-surface-muted text-fg border-border hover:bg-border/60'
              }`}
            >
              <span>{role}</span>
              {mockRole === role && <span className="text-[12px] uppercase font-semibold tracking-wider">Active</span>}
            </button>
          ))}
        </div>
      </section>

      {/* 5. About / Prototype Status */}
      <section aria-labelledby="settings-about-heading" className="bg-surface rounded-2xl p-4 border border-border shadow-sm space-y-2">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-fg-muted shrink-0" aria-hidden="true" />
          <h2 id="settings-about-heading" className="text-[12px] font-semibold uppercase tracking-wider text-fg-muted">
            About KupKop
          </h2>
        </div>
        <p className="text-[12px] text-fg-muted leading-relaxed">
          KupKop is a community-driven mobile network for street animal emergencies. Live camera verification, GPS dispatch, claim locking, and 14-day clinic inactivity tracking.
        </p>
        <div className="pt-1 flex items-center justify-between text-[12px] text-fg-muted">
          <span>Version</span>
          <span className="font-semibold text-fg">Phase 0 · Prototype</span>
        </div>
      </section>

      {/* Auth Modal for Magic Link / Google Sign-In */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
      />
    </div>
  );
}
