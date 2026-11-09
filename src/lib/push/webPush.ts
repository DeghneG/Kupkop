import 'server-only';
import webpush from 'web-push';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface PushPayload {
  title: string;
  body: string;
  /** Page opened when the alert is tapped, e.g. /?case=<id> */
  url: string;
  /** Alerts with the same tag replace each other (one per case) */
  tag?: string;
}

let configured: boolean | null = null;

/** VAPID keys from the environment; false (and no alerts) until they are set. */
export function webPushReady(siteUrl: string): boolean {
  if (configured !== null) return configured;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  configured = Boolean(pub && priv);
  // The subject identifies the sender to browser push services; the site address is enough
  if (configured) webpush.setVapidDetails(process.env.VAPID_SUBJECT || siteUrl, pub!, priv!);
  return configured;
}

/** Sends one alert to every browser these users turned alerts on in. Returns how many were delivered. */
export async function sendWebPush(db: SupabaseClient, userIds: string[], payload: PushPayload): Promise<number> {
  if (userIds.length === 0) return 0;
  const { data: subs, error } = await db
    .from('web_push_subscriptions')
    .select('endpoint,p256dh,auth')
    .in('user_id', [...new Set(userIds)]);
  if (error || !subs?.length) return 0;

  const body = JSON.stringify(payload);
  const dead: string[] = [];
  let delivered = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, {
          TTL: 60 * 30,
          urgency: 'high',
        });
        delivered++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        // 404/410: the browser dropped the subscription (alerts turned off, site data cleared)
        if (status === 404 || status === 410) dead.push(s.endpoint);
        else console.warn('Web push failed:', status ?? (e as Error).message);
      }
    })
  );
  if (dead.length) await db.from('web_push_subscriptions').delete().in('endpoint', dead);
  return delivered;
}
