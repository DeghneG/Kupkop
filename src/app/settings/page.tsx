'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { User, LogOut, LogIn, Eye, ChevronRight, HeartPulse, ShieldCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import AuthModal from '@/components/AuthModal';
import RoleApplication from '@/components/RoleApplication';
import AlertSettings from '@/components/AlertSettings';
import InlineError from '@/components/InlineError';
import RoleSwitcher from '@/components/RoleSwitcher';
import { DemoModeSection } from '@/components/DemoMode';
import { useProfile } from '@/lib/supabase/useProfile';
import ScreenHeader from '@/components/ScreenHeader';

export default function SettingsPage() {
  const { user, role, realRole, facilityId, isPreview } = useProfile();
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  // Alerts stop on this device first, so the next person signing in here never gets this user's alerts
  const handleSignOut = async () => {
    try {
      const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await createClient().from('web_push_subscriptions').delete().eq('endpoint', sub.endpoint);
        await sub.unsubscribe();
      }
    } catch {
      // The server drops dead subscriptions on its own when a push fails
    }
    await createClient().auth.signOut();
  };

  return (
    <div className="flex flex-col flex-1 px-4 pt-3 pb-8 space-y-6">
      {/* 1. Page Header */}
      <ScreenHeader title="Settings" subtitle="Account, role preview, and prototype test controls." className="-mx-4 -mt-3" />

      {/* 2. Account Section */}
      <section aria-labelledby="settings-account-heading" className="bg-surface -mx-4 px-4 py-4 border-y border-border space-y-3">
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
                <p className="text-[12px] text-fg-muted capitalize">Signed in · {realRole}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSignOut}
              className="min-h-[44px] px-4 rounded-xl bg-surface-muted hover:bg-border/60 border border-border text-fg font-semibold text-[12px] flex items-center gap-2 transition-colors cursor-pointer shrink-0 focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <LogOut className="w-3.5 h-3.5 text-fg-muted" aria-hidden="true" />
              <span>Sign out</span>
            </button>
          </div>
        ) : null}
        {user && <DisplayNameField userId={user.id} />}
        {!user && (
          <div className="pt-1 space-y-3">
            <p className="text-[14px] text-fg-muted leading-relaxed">
              Sign in to manage incident reports, claim emergency rescues, and verify responder credentials.
            </p>
            <button
              type="button"
              onClick={() => setIsAuthOpen(true)}
              className="w-full min-h-[48px] bg-surface text-action font-bold text-[14px] rounded-xl flex items-center justify-center gap-2 border-2 border-action cursor-pointer hover:bg-surface-muted focus:outline-none focus:ring-2 focus:ring-action"
            >
              <LogIn className="w-4 h-4 text-action" aria-hidden="true" />
              <span>Sign in to KupKop</span>
            </button>
          </div>
        )}
      </section>

      {user && (role === 'volunteer' || role === 'admin' || (role === 'facility' && (facilityId || isPreview))) && (
        <AlertSettings userId={user.id} showArea={role !== 'facility'} />
      )}

      {/* Role tools: clinic staff log recovery updates, admins review the queue */}
      {(user || isPreview) && (role === 'admin' || (role === 'facility' && (facilityId || isPreview))) && (
        <nav aria-label="Role tools" className="bg-surface -mx-4 border-y border-border divide-y divide-border">
          <ToolLink href="/care" icon={HeartPulse} label="Clinic care" hint="Animals in care and the 14-day clock" />
          {role === 'admin' && (
            <ToolLink href="/admin" icon={ShieldCheck} label="Admin" hint="Applications, flags, users, clinics, handoffs" />
          )}
        </nav>
      )}

      {/* 4. Demo mode: sample cases and the whole flow, played locally */}
      <DemoModeSection />

      {/* 4a. Preview a role: shows the screens each role sees. Display only; nothing here grants access. */}
      <section aria-labelledby="settings-preview-heading" className="bg-surface -mx-4 px-4 py-4 border-y border-border space-y-3">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-fg-muted shrink-0" aria-hidden="true" />
          <h2 id="settings-preview-heading" className="text-[12px] font-semibold text-fg-muted">
            Preview a role
          </h2>
        </div>
        <p className="text-[12px] text-fg-muted leading-normal">
          Tap a role to see the app the way that role sees it. This only changes what is shown; your real account keeps
          its own permissions. A banner stays on screen until you exit.
        </p>
        <RoleSwitcher />
      </section>

      {/* 4. Volunteer application (role is set by an admin, never by the user) */}
      <RoleApplication
        userId={user?.id ?? null}
        role={role}
        onSignIn={() => setIsAuthOpen(true)}
      />

      <p className="text-[12px] text-fg-muted">KupKop is a prototype. Reports are not sent to real responders.</p>

      {/* Auth Modal for email or Google sign-in; closes itself once signed in */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={() => setIsAuthOpen(false)}
      />
    </div>
  );
}

function ToolLink({ href, icon: Icon, label, hint }: { href: string; icon: typeof User; label: string; hint: string }) {
  return (
    <Link href={href} className="min-h-[56px] px-4 py-3 flex items-center gap-3 hover:bg-surface-muted">
      <Icon className="w-5 h-5 text-fg-muted shrink-0" aria-hidden="true" />
      <span className="flex-1 min-w-0">
        <span className="block text-[14px] font-semibold text-fg">{label}</span>
        <span className="block text-[12px] text-fg-muted">{hint}</span>
      </span>
      <ChevronRight className="w-4 h-4 text-fg-muted shrink-0" aria-hidden="true" />
    </Link>
  );
}

// First name shown to others on a case you claim ("Ana is on the way"). Email is never shown publicly.
function DisplayNameField({ userId }: { userId: string }) {
  const [name, setName] = useState('');
  const [saved, setSaved] = useState('');
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  useEffect(() => {
    let active = true;
    createClient()
      .from('profiles')
      .select('full_name')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        setName(data?.full_name ?? '');
        setSaved(data?.full_name ?? '');
      });
    return () => {
      active = false;
    };
  }, [userId]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setState('saving');
    const clean = name.trim().slice(0, 60);
    const { error } = await createClient().from('profiles').update({ full_name: clean }).eq('id', userId);
    if (error) {
      setState('error');
      return;
    }
    setSaved(clean);
    setName(clean);
    setState('saved');
  };

  return (
    <form onSubmit={save} className="pt-3 border-t border-border space-y-2">
      <label htmlFor="display-name" className="block text-[12px] font-semibold text-fg">
        Your name (shown on rescues you claim)
      </label>
      <div className="flex gap-2">
        <input
          id="display-name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setState('idle');
          }}
          maxLength={60}
          autoComplete="given-name"
          placeholder="e.g. Ana"
          className="flex-1 min-w-0 min-h-[44px] rounded-xl border border-border bg-surface-muted text-fg text-[14px] px-3 focus:outline-none focus:ring-2 focus:ring-action"
        />
        <button
          type="submit"
          disabled={state === 'saving' || name.trim() === saved}
          className="min-h-[44px] px-4 rounded-xl border border-border bg-surface hover:bg-surface-muted text-fg font-semibold text-[14px] cursor-pointer disabled:opacity-50"
        >
          {state === 'saving' ? 'Saving…' : 'Save'}
        </button>
      </div>
      {state === 'saved' && (
        <p role="status" className="text-[12px] text-healing-fg">
          Saved.
        </p>
      )}
      {state === 'error' && <InlineError>Could not save your name. Please try again.</InlineError>}
    </form>
  );
}
