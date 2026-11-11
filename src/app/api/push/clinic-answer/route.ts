import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendWebPush, webPushReady } from '@/lib/push/webPush';
import { checkRateLimit } from '@/lib/rateLimit';
import { clinicAnswerMessage } from '@/lib/sos/clinics';

// Called by the clinic's screen right after it answers a rescuer's heads-up ("expecting" / "can't take it") or confirms the
// animal arrived. It tells the rescuer at once, instead of waiting for the next scheduled run. The server only sends what the
// database confirms, only for staff of the clinic that was told (or an admin), and only ever to the volunteer on that case.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  if (!checkRateLimit(`push-clinic-answer:${user.id}`, 30, 60_000).allowed) {
    return NextResponse.json({ error: 'Too many alerts. Wait a minute.' }, { status: 429 });
  }

  let reportId = '';
  try {
    reportId = String(((await request.json()) as { reportId?: string }).reportId ?? '');
  } catch {
    return NextResponse.json({ error: 'Send the case id.' }, { status: 400 });
  }
  if (!/^[0-9a-f-]{36}$/i.test(reportId)) return NextResponse.json({ error: 'Invalid case id.' }, { status: 400 });

  // Read with the caller's own rights: the case, and who the caller is
  const { data: report } = await supabase
    .from('sos_reports')
    .select('id,short_id,state,claimed_by,facility_id,heads_up_facility_id,heads_up_response,heads_up_response_at,heads_up_note,clinic_received_at')
    .eq('id', reportId)
    .maybeSingle();
  // On the way (an answer), or just handed over (the clinic confirmed it arrived, which admits the case: D-060)
  const handedOver = report?.state === 'admitted' && !!report.clinic_received_at;
  const clinicId = handedOver ? report?.facility_id : report?.heads_up_facility_id;
  if (!report || (report.state !== 'claimed' && !handedOver) || !report.claimed_by || !clinicId) {
    return NextResponse.json({ error: 'Nothing to report on this case.' }, { status: 409 });
  }
  const { data: me } = await supabase.from('profiles').select('role,facility_id').eq('id', user.id).maybeSingle();
  const staffOfThatClinic = me?.role === 'admin' || (me?.role === 'facility' && me.facility_id === clinicId);
  if (!staffOfThatClinic) return NextResponse.json({ error: 'Only staff of the clinic that was told can send this.' }, { status: 403 });

  // The newest thing the clinic did: confirming arrival beats answering
  const event = report.clinic_received_at ? 'received' : report.heads_up_response === 'cannot' ? 'cannot' : report.heads_up_response === 'expecting' ? 'expecting' : null;
  if (!event) return NextResponse.json({ error: 'The clinic has not answered yet.' }, { status: 409 });

  const db = createAdminClient();
  const site = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
  if (!db || !webPushReady(site)) return NextResponse.json({ delivered: 0 });

  // One alert per answer: the scheduled job uses the same key for answers, so the rescuer is never told twice
  const key = event === 'received' ? `clinicreceived:${report.id}:${report.clinic_received_at}` : `headsupanswer:${report.id}:${report.heads_up_response_at}`;
  const { error: logError } = await db.from('push_event_log').insert({ key });
  if (logError) return NextResponse.json({ delivered: 0, duplicate: true });

  const { data: clinic } = await db.from('facilities').select('name').eq('id', clinicId).maybeSingle();
  const message = clinicAnswerMessage({
    event,
    clinicName: clinic?.name ?? 'The clinic',
    shortId: report.short_id,
    note: report.heads_up_note,
  });
  const delivered = await sendWebPush(db, [report.claimed_by], { ...message, url: `/?case=${report.id}`, tag: `case-${report.id}` });
  return NextResponse.json({ delivered });
}
