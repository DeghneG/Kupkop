import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cleanAnimalOther } from '@/lib/sos/labels';

// Called by a Supabase Database Webhook on INSERT into sos_reports.
// Alerts every volunteer and admin with the app (except the reporter) about the new case.
// Needs on Vercel: SUPABASE_SERVICE_ROLE_KEY (reads push tokens past RLS) and PUSH_WEBHOOK_SECRET.

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

const TYPE_LABELS: Record<string, string> = {
  hit_and_run: 'Hit-and-run · Critical',
  bleeding: 'Bleeding · Critical',
  fracture: 'Fracture / Trapped',
  trapped_abused: 'Trapped',
  sick_mange: 'Sick / Severe Mange',
};

const ANIMAL_LABELS: Record<string, string> = { dog: 'Injured dog', cat: 'Injured cat' };

type ReportRecord = {
  id: string;
  short_id: string;
  reporter_id: string | null;
  animal_type: string | null;
  animal_other?: string | null;
  emergency_type: string | null;
  location_name: string | null;
};

type ExpoTicket = { status: 'ok' | 'error'; details?: { error?: string } };

function secretMatches(given: string | null, expected: string): boolean {
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const secret = process.env.PUSH_WEBHOOK_SECRET;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!secret || !serviceKey || !url) {
    return NextResponse.json({ error: 'Push is not configured on the server.' }, { status: 503 });
  }
  if (!secretMatches(request.headers.get('x-webhook-secret'), secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  const report = payload?.record as ReportRecord | undefined;
  if (payload?.type !== 'INSERT' || payload?.table !== 'sos_reports' || !report?.id) {
    return NextResponse.json({ skipped: 'Not a new SOS report' });
  }

  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: responders, error: roleError } = await db
    .from('profiles')
    .select('id')
    .in('role', ['volunteer', 'admin']);
  if (roleError) return NextResponse.json({ error: roleError.message }, { status: 500 });

  const ids = (responders ?? []).map((r) => r.id).filter((id) => id !== report.reporter_id);
  if (ids.length === 0) return NextResponse.json({ sent: 0 });

  const { data: rows, error: tokenError } = await db.from('push_tokens').select('token').in('user_id', ids);
  if (tokenError) return NextResponse.json({ error: tokenError.message }, { status: 500 });
  const tokens = [...new Set((rows ?? []).map((r) => r.token))];
  if (tokens.length === 0) return NextResponse.json({ sent: 0 });

  const named = report.animal_type === 'other' ? cleanAnimalOther(report.animal_other) : null;
  const title = `New SOS · ${named ? `Injured ${named}` : (ANIMAL_LABELS[report.animal_type ?? ''] ?? 'Injured animal')}`;
  const typeLabel = TYPE_LABELS[report.emergency_type ?? ''] ?? 'Emergency';
  const place = (report.location_name || 'Pinned location').split(' — ')[0];
  const body = `${typeLabel} · ${place} · #${report.short_id}`;

  // Expo accepts up to 100 messages per request
  let sent = 0;
  const dead: string[] = [];
  for (let i = 0; i < tokens.length; i += 100) {
    const batch = tokens.slice(i, i + 100);
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { accept: 'application/json', 'accept-encoding': 'gzip, deflate', 'content-type': 'application/json' },
      body: JSON.stringify(
        batch.map((to) => ({
          to,
          title,
          body,
          sound: 'default',
          priority: 'high',
          channelId: 'sos',
          data: { reportId: report.id },
        }))
      ),
    });
    const result = (await res.json().catch(() => null)) as { data?: ExpoTicket[] } | null;
    (result?.data ?? []).forEach((ticket, idx) => {
      if (ticket.status === 'ok') sent++;
      else if (ticket.details?.error === 'DeviceNotRegistered') dead.push(batch[idx]);
    });
  }

  // Uninstalled apps: stop sending to them
  if (dead.length) await db.from('push_tokens').delete().in('token', dead);

  return NextResponse.json({ sent, removed: dead.length });
}
