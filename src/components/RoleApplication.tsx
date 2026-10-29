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
type RequestedRole = 'volunteer' | 'facility';

export default function RoleApplication({ userId, role, onSignIn }: RoleApplicationProps) {
  const [status, setStatus] = useState<ApplicationStatus | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickedRole, setRequestedRole] = useState<RequestedRole>('volunteer');
  const requestedRole: RequestedRole = role === 'volunteer' ? 'facility' : pickedRole;
  const [clinicId, setClinicId] = useState('');
  const [clinics, setClinics] = useState<{ id: string; name: string }[]>([]);

  // Clinic staff say which Listed clinic they work at
  useEffect(() => {
    if (requestedRole !== 'facility' || clinics.length > 0) return;
    let active = true;
    createClient()
      .from('facilities')
      .select('id,name')
      .eq('status', 'Listed')
      .order('name')
      .then(({ data }) => active && setClinics(data ?? []));
    return () => {
      active = false;
    };
  }, [requestedRole, clinics.length]);

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
      .insert({
        user_id: userId,
        requested_role: requestedRole,
        note: note.trim(),
        ...(requestedRole === 'facility' ? { facility_id: clinicId } : {}),
      });
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

  const isResponder = role === 'admin' || role === 'facility';

  return (
    <section
      id="volunteer"
      aria-labelledby="settings-volunteer-heading"
      className="bg-surface rounded-2xl p-4 border border-border shadow-sm space-y-3"
    >
      <div className="flex items-center gap-2">
        <HeartHandshake className="w-4 h-4 text-fg-muted shrink-0" aria-hidden="true" />
        <h2 id="settings-volunteer-heading" className="text-[12px] font-semibold text-fg-muted">
          Volunteer or clinic staff
        </h2>
      </div>

      {role === 'volunteer' && (
        <p className="text-[14px] text-fg flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-healing-fg shrink-0" aria-hidden="true" />
          <span>You are an approved volunteer.</span>
        </p>
      )}

      {isResponder ? (
        <p className="text-[14px] text-fg flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-healing-fg shrink-0" aria-hidden="true" />
          <span className="capitalize">You are an approved {role}.</span>
        </p>
      ) : !userId ? (
        <div className="space-y-3">
          <p className="text-[14px] text-fg-muted">Sign in to apply as a rescue volunteer or clinic staff.</p>
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
            {role === 'volunteer'
              ? 'Work at a Listed clinic? Apply as clinic staff to log recovery updates. Clinic staff accounts cannot claim rescues. '
              : 'Volunteers claim rescues from the feed. Clinic staff log recovery updates for animals in their care. '}
            An admin reviews every application.
            {status === 'rejected' && ' Your last application was not approved; you can apply again.'}
          </p>
          {role !== 'volunteer' && (
          <div role="radiogroup" aria-label="Apply as" className="grid grid-cols-2 p-1 bg-surface-muted rounded-xl border border-border gap-1">
            {(
              [
                ['volunteer', 'Volunteer'],
                ['facility', 'Clinic staff'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={requestedRole === value}
                onClick={() => setRequestedRole(value)}
                className={`min-h-[44px] rounded-lg text-[14px] font-semibold cursor-pointer ${
                  requestedRole === value ? 'bg-surface text-fg shadow-sm border border-border' : 'text-fg-muted hover:text-fg'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          )}
          {requestedRole === 'facility' && (
            <label className="block space-y-2">
              <span className="text-[12px] font-semibold text-fg">Which Listed clinic do you work at?</span>
              <select
                value={clinicId}
                onChange={(e) => setClinicId(e.target.value)}
                required
                className="w-full min-h-[44px] rounded-xl border border-border bg-surface-muted text-fg text-[14px] px-3 focus:outline-none focus:ring-2 focus:ring-action"
              >
                <option value="">Choose a clinic</option>
                {clinics.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="block space-y-2">
            <span className="text-[12px] font-semibold text-fg">
              {requestedRole === 'facility'
                ? 'Your role at the clinic, and how we can confirm it (10–500 characters)'
                : 'Why do you want to help? (10–500 characters)'}
            </span>
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
            disabled={submitting || note.trim().length < 10 || (requestedRole === 'facility' && !clinicId)}
            className="w-full min-h-[48px] bg-action text-action-fg font-semibold text-[14px] rounded-xl shadow-sm cursor-pointer border-none disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Sending…' : requestedRole === 'facility' ? 'Apply as clinic staff' : 'Apply to be a volunteer'}
          </button>
        </form>
      )}
    </section>
  );
}
