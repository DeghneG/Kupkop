'use client';

import React, { useEffect, useState } from 'react';
import { HeartHandshake, Clock, CheckCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { UserRole } from '@/lib/supabase/useProfile';

interface RoleApplicationProps {
  userId: string | null;
  role: UserRole;
  onSignIn: () => void;
}

type ApplicationStatus = 'pending' | 'approved' | 'rejected';

export default function RoleApplication({ userId, role, onSignIn }: RoleApplicationProps) {
  const [status, setStatus] = useState<ApplicationStatus | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Latest application for this user (RLS limits reads to their own rows)
  useEffect(() => {
    if (!userId) return;
    let active = true;
    createClient()
      .from('role_applications')
      .select('status')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (active && data) setStatus(data.status as ApplicationStatus);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setSubmitting(true);
    setError(null);
    const { error: insertError } = await createClient()
      .from('role_applications')
      .insert({ user_id: userId, requested_role: 'volunteer', note: note.trim() });
    setSubmitting(false);
    if (insertError) {
      setError(
        insertError.code === '23505'
          ? 'You already have an application waiting for review.'
          : 'Could not send your application. Please try again.'
      );
      return;
    }
    setStatus('pending');
    setNote('');
  };

  const isResponder = role === 'volunteer' || role === 'admin' || role === 'facility';

  return (
    <section
      id="volunteer"
      aria-labelledby="settings-volunteer-heading"
      className="bg-surface rounded-2xl p-4 border border-border shadow-sm space-y-3"
    >
      <div className="flex items-center gap-2">
        <HeartHandshake className="w-4 h-4 text-fg-muted shrink-0" aria-hidden="true" />
        <h2 id="settings-volunteer-heading" className="text-[12px] font-semibold text-fg-muted">
          Volunteer
        </h2>
      </div>

      {isResponder ? (
        <p className="text-[14px] text-fg flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-healing-fg shrink-0" aria-hidden="true" />
          <span className="capitalize">You are an approved {role}.</span>
        </p>
      ) : !userId ? (
        <div className="space-y-3">
          <p className="text-[14px] text-fg-muted">Sign in to apply as a rescue volunteer.</p>
          <button
            type="button"
            onClick={onSignIn}
            className="w-full min-h-[44px] rounded-xl border border-border bg-surface hover:bg-surface-muted text-fg font-semibold text-[14px] cursor-pointer"
          >
            Sign in
          </button>
        </div>
      ) : status === 'pending' ? (
        <p className="text-[14px] text-fg flex items-center gap-2">
          <Clock className="w-4 h-4 text-claimed-fg shrink-0" aria-hidden="true" />
          <span>Your application is waiting for admin review.</span>
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <p className="text-[14px] text-fg-muted">
            Only approved volunteers can claim a rescue. An admin reviews every application.
            {status === 'rejected' && ' Your last application was not approved; you can apply again.'}
          </p>
          <label className="block space-y-2">
            <span className="text-[12px] font-semibold text-fg">Why do you want to help? (10–500 characters)</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              minLength={10}
              maxLength={500}
              required
              rows={3}
              className="w-full rounded-xl border border-border bg-surface-muted text-fg text-[14px] p-3 focus:outline-none focus:ring-2 focus:ring-action"
            />
          </label>
          {error && (
            <p role="alert" className="text-[14px] text-reported-fg">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting || note.trim().length < 10}
            className="w-full min-h-[48px] bg-action text-action-fg font-semibold text-[14px] rounded-xl shadow-sm cursor-pointer border-none disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Sending…' : 'Apply to be a volunteer'}
          </button>
        </form>
      )}
    </section>
  );
}
