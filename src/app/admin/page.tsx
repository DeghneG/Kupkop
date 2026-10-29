'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useProfile } from '@/lib/supabase/useProfile';
import { animalLabel, emergencyLabel, FLAG_REASON_LABELS } from '@/lib/sos/labels';
import type { FlagReason } from '@/types/database';

type Tab = 'applications' | 'flags' | 'clinics';

interface Application {
  id: string;
  role: 'volunteer' | 'facility';
  note: string;
  createdAt: string;
  email: string;
  clinicName: string | null;
}

interface FlaggedReport {
  reportId: string;
  shortId: string;
  title: string;
  location: string;
  photoUrl: string | null;
  /** One open flag to act on; reviewing it closes every open flag on the report */
  flagId: string;
  reasons: { reason: FlagReason; note: string | null; email: string }[];
}

function timeAgo(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 60) return `${Math.max(1, minutes)}m ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
}

// Admin tools. The page is only a convenience: every action is a database function that checks is_admin().
export default function AdminPage() {
  const { user, realRole, loading } = useProfile();
  const [tab, setTab] = useState<Tab>('applications');

  if (loading) return <p className="px-4 pt-6 text-[14px] text-fg-muted">Loading…</p>;

  if (!user || realRole !== 'admin') {
    return (
      <div className="px-4 pt-6 space-y-2">
        <p className="text-[14px] font-semibold text-fg">Admins only</p>
        <Link href="/" className="text-[14px] font-semibold text-link underline underline-offset-4">
          Back to the feed
        </Link>
      </div>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'applications', label: 'Applications' },
    { id: 'flags', label: 'Flags' },
    { id: 'clinics', label: 'Add clinic' },
  ];

  return (
    <div className="flex flex-col flex-1 px-4 pt-3 pb-8 space-y-4">
      <header className="pb-1">
        <h1 className="text-[22px] font-semibold tracking-tight text-fg font-brand">Admin</h1>
        <p className="text-[12px] text-fg-muted mt-1">Review volunteers and clinic staff, flagged reports, and Listed clinics.</p>
      </header>

      <div role="tablist" aria-label="Admin sections" className="flex gap-5 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`relative h-11 text-[14px] cursor-pointer ${tab === t.id ? 'text-fg font-semibold' : 'text-fg-muted hover:text-fg'}`}
          >
            {t.label}
            {tab === t.id && <span aria-hidden="true" className="absolute left-0 right-0 -bottom-px h-0.5 rounded-full bg-fg" />}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {tab === 'applications' && <Applications />}
        {tab === 'flags' && <Flags />}
        {tab === 'clinics' && <AddClinic />}
      </div>
    </div>
  );
}

function useLoader<T>(load: () => PromiseLike<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.resolve(load()).then(
      (result) => {
        if (!active) return;
        setError(null);
        setData(result);
      },
      (e: unknown) => {
        console.error('Admin load failed:', e);
        if (active) setError('Could not load. Check your connection, and that the latest database migration has run.');
      }
    );
    return () => {
      active = false;
    };
  }, [load, key]);

  const reload = useCallback(() => setKey((k) => k + 1), []);
  return { data, error, reload };
}

function Applications() {
  const load = useCallback(async (): Promise<Application[]> => {
    const { data, error } = await createClient()
      .from('role_applications')
      .select('id,requested_role,note,created_at,profiles!role_applications_user_id_fkey(email),facilities(name)')
      .eq('status', 'pending')
      .order('created_at');
    if (error) throw error;
    type Row = {
      id: string;
      requested_role: 'volunteer' | 'facility';
      note: string;
      created_at: string;
      profiles: { email: string } | null;
      facilities: { name: string } | null;
    };
    return ((data ?? []) as unknown as Row[]).map((r) => ({
      id: r.id,
      role: r.requested_role,
      note: r.note,
      createdAt: r.created_at,
      email: r.profiles?.email ?? 'Unknown account',
      clinicName: r.facilities?.name ?? null,
    }));
  }, []);
  const { data, error, reload } = useLoader(load);

  return (
    <ReviewList
      items={data}
      error={error}
      empty="No applications waiting for review."
      render={(a) => (
        <>
          <p className="text-[14px] font-semibold text-fg break-all">{a.email}</p>
          <p className="text-[12px] text-fg-muted">
            {a.role === 'facility' ? `Clinic staff · ${a.clinicName ?? 'clinic not found'}` : 'Volunteer'} · applied{' '}
            {timeAgo(a.createdAt)}
          </p>
          <p className="text-[14px] text-fg">“{a.note}”</p>
        </>
      )}
      actions={(a) => [
        { label: 'Approve', primary: true, run: () => rpc('review_role_application', { p_application_id: a.id, p_approve: true }) },
        { label: 'Reject', run: () => rpc('review_role_application', { p_application_id: a.id, p_approve: false }) },
      ]}
      onDone={reload}
    />
  );
}

function Flags() {
  const load = useCallback(async (): Promise<FlaggedReport[]> => {
    const { data, error } = await createClient()
      .from('report_flags')
      .select(
        'id,reason,note,created_at,profiles!report_flags_flagged_by_fkey(email),sos_reports(id,short_id,animal_type,emergency_type,location_name,photo_url)'
      )
      .eq('status', 'open')
      .order('created_at');
    if (error) throw error;
    type Row = {
      id: string;
      reason: FlagReason;
      note: string | null;
      profiles: { email: string } | null;
      sos_reports: {
        id: string;
        short_id: string;
        animal_type: string | null;
        emergency_type: string | null;
        location_name: string | null;
        photo_url: string | null;
      } | null;
    };
    // Group flags by report so each report is reviewed once
    const byReport = new Map<string, FlaggedReport>();
    for (const r of (data ?? []) as unknown as Row[]) {
      const report = r.sos_reports;
      if (!report) continue;
      const entry = byReport.get(report.id) ?? {
        reportId: report.id,
        shortId: report.short_id,
        title: `${animalLabel(report.animal_type)} · ${emergencyLabel(report.emergency_type)}`,
        location: (report.location_name || 'Pinned location').split(' — ')[0],
        photoUrl: report.photo_url,
        flagId: r.id,
        reasons: [],
      };
      entry.reasons.push({ reason: r.reason, note: r.note, email: r.profiles?.email ?? 'Unknown account' });
      byReport.set(report.id, entry);
    }
    return [...byReport.values()];
  }, []);
  const { data, error, reload } = useLoader(load);

  return (
    <ReviewList
      items={data}
      error={error}
      empty="No flagged reports."
      render={(f) => (
        <div className="flex gap-3">
          {f.photoUrl && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={f.photoUrl} alt="" className="w-16 h-16 rounded-xl object-cover blur-sm shrink-0" />
          )}
          <div className="min-w-0 space-y-1">
            <p className="text-[14px] font-semibold text-fg">
              {f.title} <span className="font-mono text-[12px] text-fg-muted">#{f.shortId}</span>
            </p>
            <p className="text-[12px] text-fg-muted">{f.location}</p>
            <ul className="space-y-1">
              {f.reasons.map((r, i) => (
                <li key={i} className="text-[12px] text-fg">
                  <span className="font-semibold">{FLAG_REASON_LABELS[r.reason]}</span>
                  {r.note ? `: ${r.note}` : ''} <span className="text-fg-muted break-all">({r.email})</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      actions={(f) => [
        { label: 'Hide report', primary: true, run: () => rpc('review_report_flag', { p_flag_id: f.flagId, p_hide_report: true }) },
        { label: 'Keep, dismiss flag', run: () => rpc('review_report_flag', { p_flag_id: f.flagId, p_hide_report: false }) },
      ]}
      onDone={reload}
    />
  );
}

async function rpc(fn: string, args: Record<string, unknown>): Promise<string | null> {
  const { data, error } = await createClient().rpc(fn, args);
  if (error || !data?.success) return data?.error || error?.message || 'Something went wrong. Please try again.';
  return null;
}

interface Action {
  label: string;
  primary?: boolean;
  /** Resolves to an error message, or null on success */
  run: () => Promise<string | null>;
}

function ReviewList<T extends { id?: string; reportId?: string }>({
  items,
  error,
  empty,
  render,
  actions,
  onDone,
}: {
  items: T[] | null;
  error: string | null;
  empty: string;
  render: (item: T) => React.ReactNode;
  actions: (item: T) => Action[];
  onDone: () => void;
}) {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{ key: string; message: string } | null>(null);

  if (error) return <p role="alert" className="text-[14px] text-reported-fg">{error}</p>;
  if (items == null) return <p role="status" className="text-[14px] text-fg-muted">Loading…</p>;
  if (items.length === 0) return <p className="text-[14px] text-fg-muted">{empty}</p>;

  return (
    <ul className="divide-y divide-border border-y border-border">
      {items.map((item) => {
        const key = item.id ?? item.reportId ?? '';
        return (
          <li key={key} className="py-3 space-y-3">
            <div className="space-y-1">{render(item)}</div>
            {actionError?.key === key && (
              <p role="alert" className="text-[12px] text-reported-fg">
                {actionError.message}
              </p>
            )}
            <div className="flex gap-2">
              {actions(item).map((a) => (
                <button
                  key={a.label}
                  type="button"
                  disabled={busyKey === key}
                  onClick={async () => {
                    setBusyKey(key);
                    setActionError(null);
                    const message = await a.run();
                    setBusyKey(null);
                    if (message) setActionError({ key, message });
                    else onDone();
                  }}
                  className={
                    a.primary
                      ? 'flex-1 min-h-[44px] rounded-xl bg-fg text-page font-semibold text-[14px] cursor-pointer disabled:opacity-50'
                      : 'flex-1 min-h-[44px] rounded-xl border border-border bg-surface hover:bg-surface-muted text-fg font-semibold text-[14px] cursor-pointer disabled:opacity-50'
                  }
                >
                  {a.label}
                </button>
              ))}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function AddClinic() {
  const [form, setForm] = useState({ name: '', address: '', phone: '', latitude: '', longitude: '' });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [locating, setLocating] = useState(false);

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const useHere = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setForm((f) => ({ ...f, latitude: pos.coords.latitude.toFixed(6), longitude: pos.coords.longitude.toFixed(6) }));
      },
      () => {
        setLocating(false);
        setMessage({ ok: false, text: 'Could not get your location. Type the coordinates instead.' });
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const lat = Number(form.latitude);
  const lng = Number(form.longitude);
  const valid =
    form.name.trim().length >= 3 &&
    form.address.trim().length >= 5 &&
    form.phone.trim().length >= 7 &&
    form.latitude !== '' &&
    form.longitude !== '' &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    setMessage(null);
    const { error } = await createClient()
      .from('facilities')
      .insert({
        name: form.name.trim(),
        address: form.address.trim(),
        phone: form.phone.trim(),
        latitude: lat,
        longitude: lng,
        status: 'Listed',
      });
    setBusy(false);
    if (error) {
      setMessage({ ok: false, text: error.message });
      return;
    }
    setMessage({ ok: true, text: `${form.name.trim()} is now Listed.` });
    setForm({ name: '', address: '', phone: '', latitude: '', longitude: '' });
  };

  const field = 'w-full min-h-[44px] rounded-xl border border-border bg-surface-muted text-fg text-[14px] px-3 focus:outline-none focus:ring-2 focus:ring-action';

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-[12px] text-fg-muted">Prototype rule: clinics are shown as “Listed”, never “Verified”.</p>
      {(
        [
          ['name', 'Clinic name', 'text'],
          ['address', 'Address', 'text'],
          ['phone', 'Phone', 'tel'],
        ] as const
      ).map(([key, label, type]) => (
        <label key={key} className="block space-y-1">
          <span className="text-[12px] font-semibold text-fg">{label}</span>
          <input type={type} value={form[key]} onChange={set(key)} required className={field} />
        </label>
      ))}
      <div className="grid grid-cols-2 gap-2">
        <label className="block space-y-1">
          <span className="text-[12px] font-semibold text-fg">Latitude</span>
          <input inputMode="decimal" value={form.latitude} onChange={set('latitude')} required className={field} />
        </label>
        <label className="block space-y-1">
          <span className="text-[12px] font-semibold text-fg">Longitude</span>
          <input inputMode="decimal" value={form.longitude} onChange={set('longitude')} required className={field} />
        </label>
      </div>
      <button
        type="button"
        onClick={useHere}
        disabled={locating}
        className="w-full min-h-[44px] rounded-xl border border-border bg-surface hover:bg-surface-muted text-fg font-semibold text-[14px] cursor-pointer disabled:cursor-wait"
      >
        {locating ? 'Locating…' : "I'm at the clinic: use my location"}
      </button>
      {message && (
        <p role={message.ok ? 'status' : 'alert'} className={`text-[14px] ${message.ok ? 'text-healing-fg' : 'text-reported-fg'}`}>
          {message.text}
        </p>
      )}
      <button
        type="submit"
        disabled={!valid || busy}
        className="w-full min-h-[48px] rounded-xl bg-action text-action-fg font-semibold text-[14px] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {busy ? 'Saving…' : 'Add Listed clinic'}
      </button>
    </form>
  );
}
