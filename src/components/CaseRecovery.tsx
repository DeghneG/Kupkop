'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { calculateFacilityInactivity } from '@/lib/sos/escalation';
import { CARE_STATE_LABELS } from '@/lib/sos/labels';
import TriageGlyph from '@/components/icons/TriageGlyph';

type CareState = keyof typeof CARE_STATE_LABELS;
type Update = { id: string; notes: string; state: CareState; created_at: string };

interface CaseRecoveryProps {
  reportId: string;
  state: 'admitted' | 'healing' | 'resolved';
  /** Clinic staff and admins get a shortcut to post the next update */
  canPost: boolean;
}

// Recovery timeline for a case in clinic care. The 14-day clock runs from the newest update.
export default function CaseRecovery({ reportId, state, canPost }: CaseRecoveryProps) {
  const [updates, setUpdates] = useState<Update[] | null>(null);
  const [clinicName, setClinicName] = useState<string | null>(null);
  const [awaitingIntake, setAwaitingIntake] = useState(false);

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    supabase
      .from('recovery_updates')
      .select('id,notes,state,created_at')
      .eq('report_id', reportId)
      .order('created_at', { ascending: false })
      .then(({ data }) => active && setUpdates((data ?? []) as Update[]));
    supabase
      .from('sos_reports')
      .select('*,facilities(name)')
      .eq('id', reportId)
      .maybeSingle()
      .then(({ data }) => {
        const row = data as { facilities: { name: string } | null; intake_confirmed_at?: string | null } | null;
        if (!active) return;
        setClinicName(row?.facilities?.name ?? null);
        // Before the intake migration the column is absent: treat as confirmed
        setAwaitingIntake(state === 'admitted' && !!row && 'intake_confirmed_at' in row && !row.intake_confirmed_at);
      });
    return () => {
      active = false;
    };
  }, [reportId, state]);

  const clock = calculateFacilityInactivity(updates?.[0]?.created_at ?? null);
  const inCare = state !== 'resolved';
  const tone = !inCare
    ? 'bg-resolved-bg text-resolved-fg'
    : clock.status === 'active'
      ? 'bg-healing-bg text-healing-fg'
      : 'bg-claimed-bg text-claimed-fg';

  return (
    <div className={`${tone} rounded-2xl p-4 space-y-3`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-semibold text-[14px]">
          <TriageGlyph state={inCare ? 'healing' : 'resolved'} size={16} className="shrink-0" />
          <span>
            {!inCare
              ? 'Recovery complete'
              : awaitingIntake
                ? `Waiting for ${clinicName ?? 'the clinic'} to confirm it arrived`
                : `In care${clinicName ? ` at ${clinicName}` : ''}`}
          </span>
        </div>
        {inCare && updates && (
          <span className="text-[12px] font-semibold tabular-nums text-right">
            {clock.status === 'alert' ? 'Update overdue' : clock.badgeText}
          </span>
        )}
      </div>

      {updates == null ? (
        <p className="text-[12px]">Loading updates…</p>
      ) : updates.length === 0 ? (
        <p className="text-[12px]">No recovery updates yet.</p>
      ) : (
        <ol className="space-y-2" aria-label="Recovery updates, newest first">
          {updates.slice(0, 5).map((u) => (
            <li key={u.id} className="text-[12px] leading-snug">
              <span className="font-semibold">
                {new Date(u.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ·{' '}
                {CARE_STATE_LABELS[u.state] ?? u.state}
              </span>
              <span className="block">{u.notes}</span>
            </li>
          ))}
        </ol>
      )}

      {inCare && (
        <p className="text-[12px]">Listed clinics post an update at least every 14 days while an animal is in their care.</p>
      )}

      {inCare && canPost && (
        <Link
          href="/care"
          className="w-full min-h-[44px] rounded-xl border border-current/30 bg-surface text-fg font-semibold text-[14px] flex items-center justify-center"
        >
          Post recovery update
        </Link>
      )}
    </div>
  );
}
