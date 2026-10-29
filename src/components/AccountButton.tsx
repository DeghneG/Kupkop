'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import AuthModal from '@/components/AuthModal';
import { useProfile } from '@/lib/supabase/useProfile';

// Header account control: the user's initial when signed in (opens Settings),
// a "Sign in" button when signed out. Empty while the session loads, so it never flashes "Sign in".
export default function AccountButton() {
  const { user, loading } = useProfile();
  const [authOpen, setAuthOpen] = useState(false);

  if (loading) return <span className="w-11 h-11 shrink-0" aria-hidden="true" />;

  if (user) {
    const email = user.email ?? '';
    const initial = (email.trim()[0] ?? '?').toUpperCase();
    return (
      <Link
        href="/settings"
        aria-label={`Signed in as ${email}. Open account settings`}
        title={email}
        className="w-11 h-11 shrink-0 rounded-full bg-surface-muted border border-border text-fg text-[14px] font-semibold flex items-center justify-center hover:bg-border/60 transition-colors"
      >
        {initial}
      </Link>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAuthOpen(true)}
        className="min-h-[44px] px-4 shrink-0 rounded-xl border border-border bg-surface hover:bg-surface-muted text-fg text-[14px] font-semibold transition-colors cursor-pointer"
      >
        Sign in
      </button>
      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} onSuccess={() => setAuthOpen(false)} />
    </>
  );
}
