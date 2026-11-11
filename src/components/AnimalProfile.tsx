'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { animalLabel, emergencyLabel } from '@/lib/sos/labels';
import { calculateFacilityInactivity } from '@/lib/sos/escalation';
import ScreenHeader from '@/components/ScreenHeader';
import StageWeave from '@/components/StageWeave';
import DayWeave from '@/components/DayWeave';
import AnimalGlyph, { animalKind } from '@/components/AnimalGlyph';
import { useDemoData, useDemoMode } from '@/lib/demo/demo';
import UpdateDetails, { type DocumentedUpdate } from '@/components/UpdateDetails';

type State = 'reported' | 'claimed' | 'admitted' | 'healing' | 'resolved';

interface Report {
  id: string;
  short_id: string;
  animal_type: string | null;
  emergency_type: string | null;
  state: State;
  location_name: string | null;
  created_at: string;
  animal_name?: string | null;
  facilities: { name: string } | null;
}

interface Update extends DocumentedUpdate {
  id: string;
  notes: string;
  state: State;
  created_at: string;
}

const STATE_WORDS: Record<State, string> = {
  reported: 'Reported',
  claimed: 'A rescuer took the case',
  admitted: 'Admitted to a clinic',
  healing: 'Healing',
  resolved: 'Resolved',
};

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// One animal's page: its name, where it is now, and the whole story from report to recovery.
// Public, like the Feed: it shows what the case already shows, never who reported it.
export default function AnimalProfile() {
  const { id } = useParams<{ id: string }>();
  const [fetchedReport, setReport] = useState<Report | null | undefined>(undefined);
  const [fetchedUpdates, setUpdates] = useState<Update[]>([]);
  const demoOn = useDemoMode();
  const demo = useDemoData();

  useEffect(() => {
    if (!id || demoOn) return;
    let active = true;
    const supabase = createClient();
    Promise.all([
      supabase.from('sos_reports').select('*,facilities(name)').eq('id', id).maybeSingle(),
      (async () => {
        const cols = 'id,notes,state,created_at';
        const order = { ascending: true };
        const full = await supabase.from('recovery_updates').select(`${cols},photo_url,treatment,medication,weight_kg,next_checkup_on`).eq('report_id', id).order('created_at', order);
        // Before the documentation migration runs the new columns are absent: show the plain updates
        return full.error ? supabase.from('recovery_updates').select(cols).eq('report_id', id).order('created_at', order) : full;
      })(),
    ]).then(([r, u]) => {
      if (!active) return;
      setReport(r.error ? null : ((r.data as Report | null) ?? null));
      setUpdates((u.data ?? []) as Update[]);
    });
    return () => {
      active = false;
    };
  }, [id, demoOn]);

  // Demo mode reads the sample case instead of the database
  const demoRow = demoOn ? demo.reports.find((r) => r.id === id) : undefined;
  const report: Report | null | undefined = demoOn
    ? demoRow
      ? {
          id: demoRow.id,
          short_id: demoRow.short_id,
          animal_type: demoRow.animal_type,
          emergency_type: demoRow.emergency_type,
          state: demoRow.state,
          location_name: demoRow.location_name,
          created_at: demoRow.created_at,
          animal_name: demoRow.animal_name,
          facilities: demo.clinics.find((c) => c.id === demoRow.facility_id) ? { name: demo.clinics.find((c) => c.id === demoRow.facility_id)!.name } : null,
        }
      : null
    : fetchedReport;
  const updates: Update[] = demoOn
    ? demo.updates.filter((u) => u.report_id === id).sort((a, b) => a.created_at.localeCompare(b.created_at))
    : fetchedUpdates;

  const header = (title: string, subtitle?: string) => (
    <ScreenHeader title={title} subtitle={subtitle} className="-mx-4 -mt-3" />
  );
  const back = (
    <Link href="/" className="min-h-[44px] inline-flex items-center gap-1 text-[14px] font-semibold text-link underline underline-offset-4">
      <ChevronLeft className="w-4 h-4" aria-hidden="true" />
      Back to the Feed
    </Link>
  );

  if (report === undefined) {
    return (
      <div className="flex flex-col flex-1 px-4 pt-3 pb-8 space-y-4">
        {header('Animal')}
        <p role="status" className="text-[14px] text-fg-muted">
          Loading…
        </p>
      </div>
    );
  }

  if (report === null) {
    return (
      <div className="flex flex-col flex-1 px-4 pt-3 pb-8 space-y-4">
        {header('Animal')}
        <p className="text-[14px] font-semibold text-fg">We could not find this animal.</p>
        <p className="text-[12px] text-fg-muted">The link may be wrong, or the report was removed.</p>
        {back}
      </div>
    );
  }

  const name = report.animal_name?.trim() || null;
  const kind = animalLabel(report.animal_type);
  const inCare = report.state === 'admitted' || report.state === 'healing';
  const lastUpdate = updates.length ? updates[updates.length - 1].created_at : null;
  const clock = inCare ? calculateFacilityInactivity(lastUpdate) : null;
  const clinic = report.facilities?.name ?? null;

  // The story, oldest first: the report itself, then every update
  const story: { key: string; when: string; title: string; notes?: string; update?: Update }[] = [
    {
      key: 'reported',
      when: report.created_at,
      title: 'Reported',
      notes: `${emergencyLabel(report.emergency_type)}${report.location_name ? ` · ${report.location_name.split(' — ')[0]}` : ''}`,
    },
    ...updates.map((u) => ({ key: u.id, when: u.created_at, title: STATE_WORDS[u.state] ?? u.state, notes: u.notes, update: u })),
  ];

  return (
    <div className="flex flex-col flex-1 px-4 pt-3 pb-8 space-y-6">
      {header(name ?? kind, `Case #${report.short_id}`)}

      <div className="flex items-center gap-4">
        <div className="w-[72px] h-[72px] rounded-2xl bg-surface border border-border shrink-0 flex items-center justify-center">
          <AnimalGlyph kind={animalKind(report.animal_type as 'dog' | 'cat' | 'other' | null, kind)} size={54} />
        </div>
        <div className="min-w-0 space-y-0.5">
          <p className="text-[16px] font-semibold text-fg">{name ? `${name} · ${kind}` : kind}</p>
          <p className="text-[14px] text-fg-muted">{emergencyLabel(report.emergency_type)}</p>
          <p className="text-[12px] font-semibold text-fg">
            {STATE_WORDS[report.state]}
            {clinic && report.state !== 'reported' && report.state !== 'claimed' ? ` · ${clinic}` : ''}
          </p>
        </div>
      </div>

      <StageWeave state={report.state} showLabels />

      {clock && (
        <section aria-label="Recovery clock" className="space-y-2">
          <p className={`text-[12px] font-bold ${clock.status === 'active' ? 'text-healing-fg' : 'text-claimed-fg'}`}>
            {clock.status === 'alert' ? 'An update is overdue' : clock.badgeText}
          </p>
          <DayWeave elapsedDays={clock.elapsedDays} />
          <p className="text-[12px] text-fg-muted">The clinic posts an update at least every 14 days while an animal is in its care.</p>
        </section>
      )}

      {report.state === 'reported' || report.state === 'claimed' ? (
        <p className="text-[14px] text-fg-muted">
          {name ?? 'This animal'} has not reached a clinic yet. Once it does, every recovery update will appear below.
        </p>
      ) : null}

      <section aria-labelledby="story-heading" className="space-y-3">
        <h2 id="story-heading" className="text-[16px] font-semibold text-fg">
          {name ? `${name}’s story` : 'The story so far'}
        </h2>
        <ol className="space-y-3 border-l-2 border-border pl-4">
          {story.map((item) => (
            <li key={item.key} className="space-y-0.5">
              <p className="text-[14px] font-semibold text-fg">{item.title}</p>
              <p className="text-[12px] text-fg-muted tabular-nums">{formatDay(item.when)}</p>
              {item.notes && <p className="text-[14px] text-fg leading-snug">{item.notes}</p>}
              {item.update && <UpdateDetails update={item.update} alt={`${STATE_WORDS[item.update.state] ?? 'Update'} photo, ${formatDay(item.when)}`} />}
            </li>
          ))}
        </ol>
      </section>

      <p className="text-[12px] text-fg-muted">Prototype: every case here is made up. Clinics are “Listed”, not verified.</p>
      {back}
    </div>
  );
}
