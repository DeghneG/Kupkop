import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendWebPush, webPushReady } from '@/lib/push/webPush';
import { checkRateLimit } from '@/lib/rateLimit';

type CaseEvent = 'claimed' | 'on_my_way' | 'arrived' | 'told_clinic' | 'admitted';
const EVENTS: CaseEvent[] = ['claimed', 'on_my_way', 'arrived', 'told_clinic', 'admitted'];

// Called by the app right after the volunteer on a case takes a step: tells the person who reported it.
// The server only believes a step that the database confirms, and only the volunteer who holds the case can trigger it.
// It only ever alerts that case's reporter.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  if (!checkRateLimit(`push-case-update:${user.id}`, 30, 60_000).allowed) {
    return NextResponse.json({ error: 'Too many alerts. Wait a minute.' }, { status: 429 });
  }

  let reportId = '';
  let event = '';
  try {
    const body = (await request.json()) as { reportId?: string; event?: string };
    reportId = String(body.reportId ?? '');
    event = String(body.event ?? '');
  } catch {
    return NextResponse.json({ error: 'Send the case id and the step.' }, { status: 400 });
  }
  if (!/^[0-9a-f-]{36}$/i.test(reportId) || !EVENTS.includes(event as CaseEvent)) {
    return NextResponse.json({ error: 'Invalid case or step.' }, { status: 400 });
  }

  // Read with the caller's own rights
  const { data: report } = await supabase
    .from('sos_reports')
    .select('id,short_id,reporter_id,state,claimed_by,checkin_kind,heads_up_facility_id,facility_id')
    .eq('id', reportId)
    .maybeSingle();
  if (!report || report.claimed_by !== user.id) {
    return NextResponse.json({ error: 'You do not hold this case.' }, { status: 403 });
  }
  if (!report.reporter_id || report.reporter_id === user.id) return NextResponse.json({ delivered: 0 });

  // Did the step really happen?
  const happened: Record<CaseEvent, boolean> = {
    claimed: report.state === 'claimed',
    on_my_way: report.state === 'claimed' && (report.checkin_kind === 'on_my_way' || report.checkin_kind === 'arrived'),
    arrived: report.state === 'claimed' && report.checkin_kind === 'arrived',
    told_clinic: report.state === 'claimed' && !!report.heads_up_facility_id,
    admitted: report.state === 'admitted' && !!report.facility_id,
  };
  if (!happened[event as CaseEvent]) return NextResponse.json({ error: 'That step has not happened.' }, { status: 409 });

  const clinicId = event === 'admitted' ? report.facility_id : event === 'told_clinic' ? report.heads_up_facility_id : null;
  let clinicName = 'a clinic';
  if (clinicId) {
    const { data: clinic } = await supabase.from('facilities').select('name').eq('id', clinicId).maybeSingle();
    if (clinic?.name) clinicName = clinic.name;
  }

  const code = `Case #${report.short_id}`;
  const messages: Record<CaseEvent, { title: string; body: string }> = {
    claimed: { title: 'A volunteer took your report', body: `${code}: help is being arranged. Open it to see who it is.` },
    on_my_way: { title: 'Your volunteer is on the way', body: `${code}: they are heading to the animal. Open it to see where they are.` },
    arrived: { title: 'Your volunteer has arrived', body: `${code}: they are with the animal now.` },
    told_clinic: { title: `Taking it to ${clinicName}`, body: `${code}: your volunteer told ${clinicName} they are bringing the animal.` },
    admitted: { title: `Admitted to ${clinicName}`, body: `${code}: the clinic has the animal. Open it to follow its recovery.` },
  };

  const db = createAdminClient();
  const site = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
  if (!db || !webPushReady(site)) return NextResponse.json({ delivered: 0 });

  const delivered = await sendWebPush(db, [report.reporter_id], {
    ...messages[event as CaseEvent],
    url: '/',
    tag: `case-${report.id}`,
  });
  return NextResponse.json({ delivered });
}
