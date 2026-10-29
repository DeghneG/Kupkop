'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, HeartPulse, ShieldAlert } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useProfile } from '@/lib/supabase/useProfile';
import { calculateFacilityInactivity, type FacilityClockStatus } from '@/lib/sos/escalation';
import { animalLabel, emergencyLabel, CARE_STATE_LABELS } from '@/lib/sos/labels';

type CareState = keyof typeof CARE_STATE_LABELS;

interface CareUpdate {
  notes: string;
  state: CareState;
  createdAt: string;
}

interface CareCase {
  id: string;
  shortId: string;
  animal: string;
  type: string;
  state: CareState;
  clinicName: string;
  /** Newest first */
  updates: CareUpdate[];
}

type Row = {
  id: string;
  short_id: string;
  animal_type: string | null;
  emergency_type: string | null;
  state: CareState;
  updated_at: string;
  facilities: { name: string } | null;
  recovery_updates: { notes: string; state: CareState; created_at: string }[] | null;
};

const lastUpdateAt = (c: CareCase) => c.updates[0]?.createdAt ?? null;
const STATUS_RANK = { alert: 0, warning: 1, active: 2 } as const;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// Listed clinic staff log how each admitted animal is doing. Every update restarts that case's
// 14-day clock; the database checks that the clinic is the one caring for the animal.
export default function CarePage() {
  const { user, realRole, facilityId, loading } = useProfile();
  const [cases, setCases] = useState<CareCase[] | null>(null);
  const [clinicName, setClinicName] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const isAdmin = realRole === 'admin';
  const isStaff = realRole === 'facility' && !!facilityId;
  const canView = isAdmin || isStaff;

  useEffect(() => {
    if (!canView) return;
    let active = true;
    const supabase = createClient();

    let query = supabase
      .from('sos_reports')
      .select(
        'id,short_id,animal_type,emergency_type,state,updated_at,facilities(name),recovery_updates(notes,state,created_at)'
      )
      .in('state', ['admitted', 'healing', 'resolved'])
      .not('facility_id', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(100);
    if (!isAdmin && facilityId) query = query.eq('facility_id', facilityId);

    query.then(({ data, error }) => {
      if (!active) return;
      if (error) {
        console.error('Failed to load clinic cases:', error.code, error.message);
        setLoadError('Could not load cases. Check your connection and try again.');
        return;
      }
      setLoadError(null);
      const rows = (data ?? []) as unknown as Row[];
      setCases(
        rows.map((r) => ({
          id: r.id,
          shortId: r.short_id,
          animal: animalLabel(r.animal_type),
          type: emergencyLabel(r.emergency_type),
          state: r.state,
          clinicName: r.facilities?.name ?? 'Listed clinic',
          updates: (r.recovery_updates ?? [])
            .map((u) => ({ notes: u.notes, state: u.state, createdAt: u.created_at }))
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        }))
      );
    });

    if (!isAdmin && facilityId) {
      supabase
        .from('facilities')
        .select('name')
        .eq('id', facilityId)
        .maybeSingle()
        .then(({ data }) => active && setClinicName(data?.name ?? null));
    }

    return () => {
      active = false;
    };
  }, [canView, isAdmin, facilityId, reloadKey]);

  const reload = useCallback(() => {
    setOpenId(null);
    setReloadKey((k) => k + 1);
  }, []);

  const inCare = (cases ?? [])
    .filter((c) => c.state !== 'resolved')
    .map((c) => ({ c, clock: calculateFacilityInactivity(lastUpdateAt(c)) }))
    // Most overdue first
    .sort((a, b) => STATUS_RANK[a.clock.status] - STATUS_RANK[b.clock.status] || b.clock.elapsedDays - a.clock.elapsedDays);
  const released = (cases ?? []).filter((c) => c.state === 'resolved').slice(0, 10);
  const overdue = inCare.filter(({ clock }) => clock.status !== 'active').length;

  return (
    <div className="flex flex-col flex-1 px-4 pt-3 pb-8 space-y-6">
      <header className="pb-3 border-b border-border">
        <h1 className="text-[22px] font-semibold tracking-tight text-fg font-brand">Clinic care</h1>
        <p className="text-[12px] text-fg-muted mt-1">
          {isAdmin
            ? 'Every animal in care at Listed clinics. Admins can post updates for any case.'
            : clinicName
              ? `${clinicName} · Listed. Log how each animal is doing at least every 14 days.`
              : 'Log how each animal is doing at least every 14 days.'}
        </p>
      </header>

      {loading ? (
        <p className="text-[14px] text-fg-muted">Loading…</p>
      ) : !user ? (
        <Notice title="Sign in to see your clinic's cases">
          <Link href="/settings" className="text-[14px] font-semibold text-link underline underline-offset-4">
            Go to Settings to sign in
          </Link>
        </Notice>
      ) : !canView ? (
        <Notice title="This page is for Listed clinic staff">
          <p className="text-[14px] text-fg-muted">
            {realRole === 'facility'
              ? 'Your account is not linked to a clinic yet. Ask an admin to link it.'
              : 'Work at a Listed clinic? Apply as clinic staff in Settings and an admin will review it.'}
          </p>
          {realRole !== 'facility' && (
            <Link href="/settings#volunteer" className="text-[14px] font-semibold text-link underline underline-offset-4">
              Apply in Settings
            </Link>
          )}
        </Notice>
      ) : loadError ? (
        <Notice title="Could not load cases">
          <p className="text-[14px] text-fg-muted">{loadError}</p>
          <button
            type="button"
            onClick={reload}
            className="min-h-[44px] px-4 rounded-xl border border-border bg-surface hover:bg-surface-muted text-fg font-semibold text-[14px] cursor-pointer"
          >
            Try again
          </button>
        </Notice>
      ) : cases == null ? (
        <p role="status" className="text-[14px] text-fg-muted">
          Loading cases…
        </p>
      ) : (
        <>
          <dl className="grid grid-cols-2 divide-x divide-border border-y border-border">
            <div className="py-3 pr-3 flex flex-col gap-1">
              <dt className="text-[12px] text-fg-muted">In care</dt>
              <dd className="text-[16px] font-semibold tabular-nums text-fg">{inCare.length}</dd>
            </div>
            <div className="py-3 pl-3 flex flex-col gap-1">
              <dt className="text-[12px] text-fg-muted">Update due or overdue</dt>
              <dd className={`text-[16px] font-semibold tabular-nums ${overdue > 0 ? 'text-claimed-fg' : 'text-fg'}`}>
                {overdue}
              </dd>
            </div>
          </dl>

          <section aria-labelledby="in-care-heading" className="space-y-2">
            <h2 id="in-care-heading" className="text-[16px] font-semibold text-fg">
              In care
            </h2>
            {inCare.length === 0 ? (
              <p className="text-[14px] text-fg-muted">
                No animals in care right now. Cases appear here when a rescuer admits one to{' '}
                {isAdmin ? 'a Listed clinic' : 'your clinic'}.
              </p>
            ) : (
              <ul className="divide-y divide-border border-y border-border">
                {inCare.map(({ c, clock }) => (
                  <li key={c.id} className="py-3 space-y-2">
                    <CaseSummary c={c} clock={clock} showClinic={isAdmin} />
                    {openId === c.id ? (
                      <UpdateForm c={c} onCancel={() => setOpenId(null)} onPosted={reload} />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setOpenId(c.id)}
                        className="w-full min-h-[44px] rounded-xl border border-border bg-surface hover:bg-surface-muted text-fg font-semibold text-[14px] cursor-pointer"
                      >
                        Post recovery update
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {released.length > 0 && (
            <section aria-labelledby="released-heading" className="space-y-2">
              <h2 id="released-heading" className="text-[16px] font-semibold text-fg">
                Recently released
              </h2>
              <ul className="divide-y divide-border border-y border-border">
                {released.map((c) => (
                  <li key={c.id} className="py-3">
                    <p className="text-[14px] font-semibold text-fg">
                      {c.animal} <span className="font-mono text-[12px] text-fg-muted">#{c.shortId}</span>
                    </p>
                    <p className="text-[12px] text-fg-muted">
                      {isAdmin ? `${c.clinicName} · ` : ''}
                      {lastUpdateAt(c) ? `Released ${formatDate(lastUpdateAt(c)!)}` : 'Released'}
                      {c.updates[0] ? ` · ${c.updates[0].notes}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-5 border border-border space-y-2">
      <p className="text-[14px] font-semibold text-fg">{title}</p>
      {children}
    </div>
  );
}

function ClockBadge({ clock }: { clock: FacilityClockStatus }) {
  const tone =
    clock.status === 'alert'
      ? 'bg-reported-bg text-reported-fg'
      : clock.status === 'warning'
        ? 'bg-claimed-bg text-claimed-fg'
        : 'bg-healing-bg text-healing-fg';
  const Icon = clock.status === 'alert' ? ShieldAlert : clock.status === 'warning' ? AlertCircle : HeartPulse;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[12px] font-semibold ${tone}`}>
      <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      {clock.status === 'alert' ? 'Update overdue · welfare check' : clock.badgeText}
    </span>
  );
}

function CaseSummary({ c, clock, showClinic }: { c: CareCase; clock: FacilityClockStatus; showClinic: boolean }) {
  const latest = c.updates[0];
  return (
    <div className="space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-fg">
            {c.animal} <span className="font-mono text-[12px] text-fg-muted">#{c.shortId}</span>
          </p>
          <p className="text-[12px] text-fg-muted">
            {CARE_STATE_LABELS[c.state]} · {c.type}
            {showClinic ? ` · ${c.clinicName}` : ''}
          </p>
        </div>
        <ClockBadge clock={clock} />
      </div>
      {latest && (
        <p className="text-[12px] text-fg-muted">
          <span className="font-semibold text-fg">Last update {formatDate(latest.createdAt)}:</span> {latest.notes}
        </p>
      )}
    </div>
  );
}

function UpdateForm({ c, onCancel, onPosted }: { c: CareCase; onCancel: () => void; onPosted: () => void }) {
  // Healing never goes back to admitted; the database enforces the same rule
  const options: CareState[] = c.state === 'healing' ? ['healing', 'resolved'] : ['admitted', 'healing', 'resolved'];
  const [state, setState] = useState<CareState>(c.state);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { data, error: rpcError } = await createClient().rpc('post_recovery_update', {
      p_report_id: c.id,
      p_notes: notes.trim(),
      p_state: state,
    });
    setBusy(false);
    if (rpcError || !data?.success) {
      setError(data?.error || rpcError?.message || 'Could not post the update. Please try again.');
      return;
    }
    onPosted();
  };

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl bg-surface-muted p-3">
      <fieldset className="space-y-2">
        <legend className="text-[12px] font-semibold text-fg">Status</legend>
        <div className="flex flex-wrap gap-2">
          {options.map((s) => (
            <label
              key={s}
              className={`min-h-[44px] px-3 inline-flex items-center gap-2 rounded-xl border text-[14px] cursor-pointer ${
                state === s ? 'border-fg text-fg font-semibold bg-surface' : 'border-border text-fg-muted bg-surface'
              }`}
            >
              <input
                type="radio"
                name={`state-${c.id}`}
                value={s}
                checked={state === s}
                onChange={() => setState(s)}
                className="accent-[var(--action)]"
              />
              {s === c.state ? `Still ${CARE_STATE_LABELS[s].toLowerCase()}` : CARE_STATE_LABELS[s]}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block space-y-2">
        <span className="text-[12px] font-semibold text-fg">How is the animal doing? (5–500 characters)</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          minLength={5}
          maxLength={500}
          required
          rows={3}
          className="w-full rounded-xl border border-border bg-surface text-fg text-[14px] p-3 focus:outline-none focus:ring-2 focus:ring-action"
        />
      </label>
      {state === 'resolved' && (
        <p className="text-[12px] text-fg-muted">Marks the case resolved: released, adopted, or returned. This closes it.</p>
      )}
      {error && (
        <p role="alert" className="text-[12px] text-reported-fg">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="min-h-[44px] px-4 rounded-xl border border-border bg-surface hover:bg-surface-muted text-fg font-semibold text-[14px] cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy || notes.trim().length < 5}
          className="flex-1 min-h-[48px] rounded-xl bg-action text-action-fg font-semibold text-[14px] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? 'Posting…' : 'Post update'}
        </button>
      </div>
    </form>
  );
}
