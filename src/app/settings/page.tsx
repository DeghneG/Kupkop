'use client';

import React, { useState } from 'react';
import { User, Sun, Moon, Laptop, LogOut, LogIn, Eye } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import AuthModal from '@/components/AuthModal';
import RoleApplication from '@/components/RoleApplication';
import { useThemeMode, useViewAs } from '@/lib/storage';
import { useProfile } from '@/lib/supabase/useProfile';

export default function SettingsPage() {
  const [themeMode, handleThemeChange] = useThemeMode();
  const { user, role, realRole } = useProfile();
  const [, setViewAs] = useViewAs();
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  const handleSignOut = async () => {
    await createClient().auth.signOut();
  };

  return (
    <div className="flex flex-col flex-1 px-4 pt-3 pb-8 space-y-6">
      {/* 1. Page Header */}
      <header className="pb-1 border-b border-border">
        <h1 className="text-[22px] font-semibold tracking-tight text-fg font-brand">
          Settings
        </h1>
        <p className="text-[12px] text-fg-muted font-normal mt-0.5">
          Account, appearance, and prototype test controls.
        </p>
      </header>

      {/* 2. Account Section */}
      <section aria-labelledby="settings-account-heading" className="bg-surface rounded-2xl p-4 border border-border shadow-sm space-y-3">
        <h2 id="settings-account-heading" className="text-[12px] font-semibold text-fg-muted">
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
              className="min-h-[40px] px-4 rounded-xl bg-surface-muted hover:bg-border/60 border border-border text-fg font-semibold text-[12px] flex items-center gap-2 transition-colors cursor-pointer shrink-0 focus:outline-none focus:ring-2 focus:ring-accent"
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
        <h2 id="settings-appearance-heading" className="text-[12px] font-semibold text-fg-muted">
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
            className={`min-h-[40px] rounded-lg text-[12px] font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
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
            className={`min-h-[40px] rounded-lg text-[12px] font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              themeMode === 'light'
                ? 'bg-surface text-fg shadow-sm border border-border'
                : 'text-fg-muted hover:text-fg'
            }`}
          >
            <Sun className="w-4 h-4 text-fg-muted shrink-0" aria-hidden="true" />
            <span>Light</span>
          </button>

          <button
            type="button"
            role="radio"
            aria-checked={themeMode === 'dark'}
            onClick={() => handleThemeChange('dark')}
            className={`min-h-[40px] rounded-lg text-[12px] font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              themeMode === 'dark'
                ? 'bg-surface text-fg shadow-sm border border-border'
                : 'text-fg-muted hover:text-fg'
            }`}
          >
            <Moon className="w-4 h-4 text-fg-muted shrink-0" aria-hidden="true" />
            <span>Dark</span>
          </button>
        </div>
      </section>

      {/* 4a. Admin-only preview of other roles (UI only; the database still enforces your real role) */}
      {realRole === 'admin' && (
        <section aria-labelledby="settings-viewas-heading" className="bg-surface rounded-2xl p-4 border border-border shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-fg-muted shrink-0" aria-hidden="true" />
            <h2 id="settings-viewas-heading" className="text-[12px] font-semibold text-fg-muted">
              View as (admin preview)
            </h2>
          </div>
          <p className="text-[12px] text-fg-muted leading-normal">
            See the app as another role. This only changes what is shown; permissions stay tied to your real admin role.
          </p>
          <div role="radiogroup" aria-label="View as role" className="grid grid-cols-2 gap-2">
            {(['citizen', 'volunteer', 'facility', 'admin'] as const).map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={role === r}
                onClick={() => setViewAs(r === 'admin' ? null : r)}
                className={`min-h-[44px] px-3 rounded-xl text-[14px] font-semibold capitalize border transition-colors cursor-pointer ${
                  role === r
                    ? 'bg-action text-action-fg border-action'
                    : 'bg-surface-muted text-fg border-border hover:bg-border/60'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* 4. Volunteer application (role is set by an admin, never by the user) */}
      <RoleApplication
        userId={user?.id ?? null}
        role={role}
        onSignIn={() => setIsAuthOpen(true)}
      />

      <p className="text-[12px] text-fg-muted">KupKop is a prototype. Reports are not sent to real responders.</p>

      {/* Auth Modal for email link / Google / Facebook sign-in; closes itself once signed in */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={() => setIsAuthOpen(false)}
      />
    </div>
  );
}
