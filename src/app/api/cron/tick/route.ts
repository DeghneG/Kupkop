import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendWebPush, webPushReady } from '@/lib/push/webPush';
import { checkReportPhoto } from '@/lib/gemini/photoCheck';
import {
  alertMessage,
  alertRecipients,
  currentAlertStage,
  planAlertStages,
  reporterNoResponderMessage,
  type AlertArea,
  type AlertStage,
} from '@/lib/sos/alerts';
import { ESCALATION_CONFIG, claimLockEndsAt, needsRescuer } from '@/lib/sos/escalation';
import { headsUpMessage, rankClinics } from '@/lib/sos/clinics';
import { claimPhase, standbyQueue } from '@/lib/sos/standby';
import { animalLabel, emergencyLabel } from '@/lib/sos/labels';

// Called every minute by the Supabase scheduler (pg_cron + pg_net), see supabase/setup/cron_tick.sql.
// Each job is idempotent: logs decide what was already done, so a missed or doubled tick is harmless.

const DAY_MS = 86_400_000;

function secretMatches(given: string | null, expected: string): boolean {
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const db = createAdminClient();
  if (!secret || !db) {
    return NextResponse.json({ error: 'Scheduler is not configured on the server.' }, { status: 503 });
  }
  if (!secretMatches(request.headers.get('x-cron-secret'), secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const site = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
  const pushReady = webPushReady(site);

  const result: Record<string, unknown> = { pushReady };
  for (const [name, job] of [
    ['escalation', escalate],
    ['care', overdueCare],
    ['declines', declinedAdmissions],
    ['clinicHeadsUps', clinicHeadsUps],
    ['headsUpAnswers', headsUpAnswers],
    ['standby', standbyTurns],
    ['assignments', adminAssignments],
    ['photos', photoChecks],
  ] as const) {
    try {
      result[name] = await job(db, pushReady);
    } catch (e) {
      // One failing job never stops the others
      console.error(`cron ${name} failed:`, e);
      result[name] = { error: e instanceof Error ? e.message : 'failed' };
    }
  }
  return NextResponse.json(result);
}

async function responderTargets(db: SupabaseClient) {
  const [{ data: people }, { data: areas }] = await Promise.all([
    db.from('profiles').select('id,role').in('role', ['volunteer', 'admin']),
    db.from('responder_alert_prefs').select('user_id,latitude,longitude,radius_km'),
  ]);
  return {
    volunteerIds: (people ?? []).filter((p) => p.role === 'volunteer').map((p) => p.id as string),
    adminIds: (people ?? []).filter((p) => p.role === 'admin').map((p) => p.id as string),
    areas: (areas ?? []).map(
      (a): AlertArea => ({ userId: a.user_id, latitude: a.latitude, longitude: a.longitude, radiusKm: Number(a.radius_km) })
    ),
  };
}

/** SOS escalation: area alert at once, everyone at the widen time, admins at "no responder". */
async function escalate(db: SupabaseClient, pushReady: boolean) {
  // Open reports from the last 3 hours; the longest tier ("no responder" at 60 min) fits inside it
  const since = new Date(Date.now() - 3 * 3_600_000).toISOString();
  const { data: rows, error } = await db
    .from('sos_reports')
    .select(
      'id,short_id,reporter_id,animal_type,emergency_type,location_name,latitude,longitude,created_at,state,claimed_at,checkin_kind,heads_up_response,heads_up_eta_minutes,sos_alert_log(stage)'
    )
    .in('state', ['reported', 'claimed'])
    .is('hidden_at', null)
    .gte('created_at', since);
  if (error) throw error;
  // A claim that lapsed (no "On my way" within the minute, or the lock ran out) stays 'claimed' in the row but is open again,
  // so it keeps escalating like any open case. A claim that is still held does not.
  const reports = (rows ?? []).filter((r) =>
    needsRescuer(r.state, r.claimed_at, r.emergency_type, r.checkin_kind ?? null, r.heads_up_response === 'expecting', r.heads_up_eta_minutes ?? null)
  );
  if (!reports.length) return { sent: 0 };

  const targets = await responderTargets(db);
  let sent = 0;
  for (const r of reports) {
    const already = ((r.sos_alert_log as { stage: AlertStage }[] | null) ?? []).map((l) => l.stage);
    const plan = planAlertStages(currentAlertStage(r.created_at, r.emergency_type), already);
    if (!plan.send) continue;

    const recipients = alertRecipients(plan.send, { lat: r.latitude, lng: r.longitude }, { ...targets, reporterId: r.reporter_id });
    // Claim the stage first; a parallel tick that loses the insert sends nothing
    const rows = [
      ...plan.skip.map((stage) => ({ report_id: r.id, stage, recipients: 0 })),
      { report_id: r.id, stage: plan.send, recipients: recipients.length },
    ];
    const { error: logError } = await db.from('sos_alert_log').insert(rows);
    if (logError) continue;

    if (pushReady && recipients.length) {
      const minutes = Math.floor((Date.now() - new Date(r.created_at).getTime()) / 60_000);
      const msg = alertMessage(plan.send, {
        animal: animalLabel(r.animal_type),
        type: emergencyLabel(r.emergency_type),
        place: (r.location_name || 'Pinned location').split(' — ')[0],
        shortId: r.short_id,
        minutes,
      });
      sent += await sendWebPush(db, recipients, { ...msg, url: `/?case=${r.id}`, tag: `case-${r.id}` });
    }

    // Nobody has responded: the person standing next to the animal gets something to do and a clinic to call
    if (plan.send === 'no_responder' && pushReady && r.reporter_id) {
      const clinic = await nearestOpenClinic(db, { lat: r.latitude, lng: r.longitude });
      const msg = reporterNoResponderMessage({ shortId: r.short_id, clinicName: clinic?.name ?? null, clinicPhone: clinic?.phone ?? null });
      sent += await sendWebPush(db, [r.reporter_id], { ...msg, url: '/rafa', tag: `noresponder-${r.id}` });
    }
  }
  return { sent };
}

/** The nearest Listed clinic that has not reported itself full. The status columns arrive with the D-042 migration. */
async function nearestOpenClinic(db: SupabaseClient, near: { lat: number; lng: number }) {
  const basic = 'id,name,phone,latitude,longitude';
  const full = await db.from('facilities').select(`${basic},availability,availability_set_at`).eq('status', 'Listed');
  const rows: Record<string, unknown>[] = full.error
    ? ((await db.from('facilities').select(basic).eq('status', 'Listed')).data ?? [])
    : (full.data ?? []);
  const clinics = rows.map((f) => ({
    id: f.id as string,
    name: f.name as string,
    phone: (f.phone as string | null) ?? null,
    latitude: f.latitude as number,
    longitude: f.longitude as number,
    availability: (f as { availability?: string | null }).availability ?? null,
    availabilitySetAt: (f as { availability_set_at?: string | null }).availability_set_at ?? null,
  }));
  return rankClinics(clinics, near).find((r) => r.suggested)?.clinic ?? null;
}

/** Everyone who works at a clinic, so a heads-up reaches whoever is on duty. */
async function clinicStaffIds(db: SupabaseClient, facilityId: string): Promise<string[]> {
  const { data } = await db.from('profiles').select('id').eq('role', 'facility').eq('facility_id', facilityId);
  return (data ?? []).map((s) => s.id as string);
}

/** A rescuer told a clinic they are coming: the clinic's staff are notified once per heads-up. */
async function clinicHeadsUps(db: SupabaseClient, pushReady: boolean) {
  if (!pushReady) return { sent: 0 };
  const since = new Date(Date.now() - 30 * 60_000).toISOString();
  const { data: reports, error } = await db
    .from('sos_reports')
    .select('id,short_id,animal_type,emergency_type,heads_up_facility_id,heads_up_eta_minutes,heads_up_at')
    .eq('state', 'claimed')
    .not('heads_up_facility_id', 'is', null)
    .is('heads_up_response', null)
    .gte('heads_up_at', since);
  if (error) return { sent: 0, skipped: 'D-042 migration not run yet' };

  let sent = 0;
  for (const r of reports ?? []) {
    const { error: logError } = await db.from('push_event_log').insert({ key: `headsup:${r.id}:${r.heads_up_at}` });
    if (logError) continue;
    const msg = headsUpMessage({
      animal: animalLabel(r.animal_type),
      type: emergencyLabel(r.emergency_type),
      etaMinutes: r.heads_up_eta_minutes ?? null,
      shortId: r.short_id,
    });
    sent += await sendWebPush(db, await clinicStaffIds(db, r.heads_up_facility_id as string), { ...msg, url: '/care', tag: `headsup-${r.id}` });
  }
  return { sent };
}

/** The clinic answered: the rescuer hears "expecting you" or "choose another clinic" right away. */
async function headsUpAnswers(db: SupabaseClient, pushReady: boolean) {
  if (!pushReady) return { sent: 0 };
  const since = new Date(Date.now() - 30 * 60_000).toISOString();
  const { data: reports, error } = await db
    .from('sos_reports')
    .select('id,short_id,claimed_by,heads_up_facility_id,heads_up_response,heads_up_response_at,heads_up_note')
    .eq('state', 'claimed')
    .not('heads_up_response', 'is', null)
    .gte('heads_up_response_at', since);
  if (error) return { sent: 0, skipped: 'D-042 migration not run yet' };

  let sent = 0;
  for (const r of reports ?? []) {
    if (!r.claimed_by) continue;
    const { error: logError } = await db.from('push_event_log').insert({ key: `headsupanswer:${r.id}:${r.heads_up_response_at}` });
    if (logError) continue;
    const { data: clinic } = await db.from('facilities').select('name').eq('id', r.heads_up_facility_id).maybeSingle();
    const name = clinic?.name ?? 'The clinic';
    const expecting = r.heads_up_response === 'expecting';
    sent += await sendWebPush(db, [r.claimed_by as string], {
      title: expecting ? `${name} is expecting you · #${r.short_id}` : `Choose another clinic · #${r.short_id}`,
      body: expecting
        ? 'Keep going. They will confirm when the animal arrives.'
        : `${name} cannot take the animal now${r.heads_up_note ? `: ${r.heads_up_note}` : ''}. Pick another clinic.`,
      url: `/?case=${r.id}`,
      tag: `case-${r.id}`,
    });
  }
  return { sent };
}

/**
 * Standby: when a lock ends (or a rescuer releases), the first volunteer in line is told they have a head start.
 * If they do not claim within the grace window, the rest of the line is told the case is open.
 */
async function standbyTurns(db: SupabaseClient, pushReady: boolean) {
  if (!pushReady) return { sent: 0 };
  const { data: rows, error } = await db
    .from('claim_standby')
    .select('report_id,volunteer_id,created_at,sos_reports(id,short_id,state,claimed_at,checkin_kind,heads_up_response,heads_up_eta_minutes,updated_at,emergency_type,hidden_at)');
  if (error) return { sent: 0, skipped: 'D-042 migration not run yet' };

  type Report = { id: string; short_id: string; state: string; claimed_at: string | null; checkin_kind: 'on_my_way' | 'arrived' | null; heads_up_response: 'expecting' | 'cannot' | null; heads_up_eta_minutes: number | null; updated_at: string; emergency_type: string; hidden_at: string | null };
  const byReport = new Map<string, { report: Report; entries: { volunteerId: string; joinedAt: string }[] }>();
  for (const row of rows ?? []) {
    const report = row.sos_reports as unknown as Report | null;
    if (!report || report.hidden_at) continue;
    const group = byReport.get(report.id) ?? { report, entries: [] };
    group.entries.push({ volunteerId: row.volunteer_id as string, joinedAt: row.created_at as string });
    byReport.set(report.id, group);
  }

  let sent = 0;
  for (const { report, entries } of byReport.values()) {
    // Only a case that is open again: released, or its lock ran out
    const open =
      report.state === 'reported' ||
      (report.state === 'claimed' && (claimLockEndsAt(report.claimed_at, report.emergency_type, report.checkin_kind ?? null, report.heads_up_response === 'expecting', report.heads_up_eta_minutes ?? null) ?? Infinity) <= Date.now());
    if (!open) continue;
    const marker = report.state === 'claimed' ? report.claimed_at : report.updated_at;
    const queue = standbyQueue(entries);
    const phase = claimPhase({
      state: report.state,
      claimedAt: report.claimed_at,
      type: report.emergency_type,
      checkinKind: report.checkin_kind ?? null,
      clinicExpecting: report.heads_up_response === 'expecting',
      etaMinutes: report.heads_up_eta_minutes ?? null,
      releasedAt: report.updated_at,
      standby: entries,
    });

    if (phase.phase === 'reserved') {
      const { error: logError } = await db.from('push_event_log').insert({ key: `standby:${report.id}:${marker}` });
      if (logError) continue;
      sent += await sendWebPush(db, [queue[0].volunteerId], {
        title: `It’s open, you’re next · #${report.short_id}`,
        body: 'The rescuer’s lock ended. You have two minutes to claim it before everyone else can.',
        url: `/?case=${report.id}`,
        tag: `case-${report.id}`,
      });
    } else if (phase.phase === 'open' && queue.length > 1) {
      const { error: logError } = await db.from('push_event_log').insert({ key: `standbyopen:${report.id}:${marker}` });
      if (logError) continue;
      sent += await sendWebPush(db, queue.slice(1).map((e) => e.volunteerId), {
        title: `Still open · #${report.short_id}`,
        body: 'Nobody has claimed it yet. You said you were available.',
        url: `/?case=${report.id}`,
        tag: `case-${report.id}`,
      });
    }
  }
  return { sent };
}

/** An admin assigned a volunteer to a case nobody had taken: tell the volunteer. */
async function adminAssignments(db: SupabaseClient, pushReady: boolean) {
  if (!pushReady) return { sent: 0 };
  const since = new Date(Date.now() - 15 * 60_000).toISOString();
  const { data: reports, error } = await db
    .from('sos_reports')
    .select('id,short_id,claimed_by,admin_assigned_at,location_name')
    .eq('state', 'claimed')
    .not('claimed_by', 'is', null)
    .not('admin_assigned_at', 'is', null)
    .gte('admin_assigned_at', since);
  if (error) return { sent: 0, skipped: 'D-042 migration not run yet' };

  let sent = 0;
  for (const r of reports ?? []) {
    const { error: logError } = await db.from('push_event_log').insert({ key: `assigned:${r.id}:${r.admin_assigned_at}` });
    if (logError) continue;
    sent += await sendWebPush(db, [r.claimed_by as string], {
      title: `An admin assigned you · #${r.short_id}`,
      body: `${(r.location_name || 'Pinned location').split(' — ')[0]}. It is held for you: open it and tap “I’ve arrived” when you get there.`,
      url: `/?case=${r.id}`,
      tag: `case-${r.id}`,
    });
  }
  return { sent };
}

/** 14-day clock: an in-care case with no update for 14 days pauses (delists) its clinic and alerts staff and admins. */
async function overdueCare(db: SupabaseClient, pushReady: boolean) {
  const { data: cases, error } = await db
    .from('sos_reports')
    .select('id,short_id,facility_id,updated_at,recovery_updates(created_at),facilities(name,status)')
    .in('state', ['admitted', 'healing'])
    .not('facility_id', 'is', null);
  if (error) throw error;

  let paused = 0;
  for (const c of cases ?? []) {
    const last =
      ((c.recovery_updates as { created_at: string }[] | null) ?? []).map((u) => u.created_at).sort().at(-1) ?? c.updated_at;
    if (Date.now() - new Date(last).getTime() < ESCALATION_CONFIG.facilityInactivityMaxDays * DAY_MS) continue;

    // Once per missed update: a new update gives a new last_update_at and a fresh 14 days
    const { error: logError } = await db.from('care_alert_log').insert({ report_id: c.id, last_update_at: last });
    if (logError) continue;

    const clinic = c.facilities as unknown as { name: string; status: string } | null;
    if (clinic?.status === 'Listed') {
      await db
        .from('facilities')
        .update({ status: 'Paused', paused_at: new Date().toISOString(), paused_reason: `No update on case #${c.short_id} for 14 days` })
        .eq('id', c.facility_id);
      paused++;
    }

    if (pushReady) {
      const { data: staff } = await db.from('profiles').select('id').or(`role.eq.admin,and(role.eq.facility,facility_id.eq.${c.facility_id})`);
      await sendWebPush(
        db,
        (staff ?? []).map((s) => s.id as string),
        {
          title: `Recovery update overdue · #${c.short_id}`,
          body: `${clinic?.name ?? 'The clinic'} has not posted an update for 14 days and is paused until an admin lists it again.`,
          url: '/care',
          tag: `care-${c.id}`,
        }
      );
    }
  }
  return { paused };
}

/** "Can't accept": tell the rescuer to pick another clinic. */
async function declinedAdmissions(db: SupabaseClient, pushReady: boolean) {
  if (!pushReady) return { sent: 0 };
  const since = new Date(Date.now() - 30 * 60_000).toISOString();
  const { data: updates, error } = await db
    .from('recovery_updates')
    .select('id,notes,report_id,sos_reports(short_id,claimed_by,state)')
    .eq('state', 'claimed')
    .gte('created_at', since);
  if (error) throw error;

  let sent = 0;
  for (const u of updates ?? []) {
    const report = u.sos_reports as unknown as { short_id: string; claimed_by: string | null; state: string } | null;
    if (!report?.claimed_by || report.state !== 'claimed') continue;
    const { error: logError } = await db.from('push_event_log').insert({ key: `declined:${u.id}` });
    if (logError) continue;
    sent += await sendWebPush(db, [report.claimed_by], {
      title: `Choose another clinic · #${report.short_id}`,
      body: u.notes,
      url: `/?case=${u.report_id}`,
      tag: `case-${u.report_id}`,
    });
  }
  return { sent };
}

/** AI check of new report photos: no animal or a photo of a screen goes to the admin flag queue. */
async function photoChecks(db: SupabaseClient) {
  if (!process.env.GEMINI_API_KEY) return { checked: 0, skipped: 'no GEMINI_API_KEY' };
  const since = new Date(Date.now() - 2 * DAY_MS).toISOString();
  const { data: reports, error } = await db
    .from('sos_reports')
    .select('id,photo_url')
    .is('ai_checked_at', null)
    .gte('created_at', since)
    .order('created_at')
    .limit(3);
  if (error) throw error;

  let flagged = 0;
  for (const r of reports ?? []) {
    const check = await checkReportPhoto(r.photo_url).catch(() => null);
    await db
      .from('sos_reports')
      .update({
        ai_checked_at: new Date().toISOString(),
        ai_has_animal: check?.hasAnimal ?? null,
        ai_graphic: check?.graphic ?? null,
        ai_note: check ? check.note : 'Photo could not be checked',
      })
      .eq('id', r.id);
    if (check && (!check.hasAnimal || check.isScreen)) {
      await db.from('report_flags').insert({
        report_id: r.id,
        flagged_by: null,
        source: 'ai',
        reason: 'fake',
        note: `AI check: ${check.isScreen ? 'looks like a photo of a screen. ' : ''}${check.hasAnimal ? '' : 'no animal visible. '}${check.note}`.slice(0, 300),
      });
      flagged++;
    }
  }
  return { checked: reports?.length ?? 0, flagged };
}
