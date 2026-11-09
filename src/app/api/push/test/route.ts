import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendWebPush, webPushReady } from '@/lib/push/webPush';
import { checkRateLimit } from '@/lib/rateLimit';

// "Send me a test alert" in Settings: alerts only the signed-in caller's own browsers.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  if (!checkRateLimit(`push-test:${user.id}`, 3, 60_000).allowed) {
    return NextResponse.json({ error: 'Wait a minute before sending another test.' }, { status: 429 });
  }

  const db = createAdminClient();
  const site = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
  if (!db || !webPushReady(site)) {
    return NextResponse.json({ error: 'Alerts are not set up on the server yet.' }, { status: 503 });
  }

  const delivered = await sendWebPush(db, [user.id], {
    title: 'KupKop test alert',
    body: 'Alerts work on this device. New SOS reports in your area will look like this.',
    url: '/settings',
    tag: 'test',
  });
  return NextResponse.json({ delivered });
}
