// Fixed-window limiter kept in server memory. On Vercel each server instance has its own memory
// and it resets on cold starts, so this slows down abuse but is not a hard cap.
// A shared store (e.g. Upstash Redis) is needed for a guaranteed limit.
const buckets = new Map<string, number[]>();

export function checkRateLimit(identifier: string, limit = 10, windowMs = 60_000): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const recent = (buckets.get(identifier) || []).filter((t) => now - t < windowMs);

  if (recent.length >= limit) {
    buckets.set(identifier, recent);
    return { allowed: false, remaining: 0 };
  }

  recent.push(now);
  buckets.set(identifier, recent);
  return { allowed: true, remaining: limit - recent.length };
}

/** Caller's IP as Vercel reports it; falls back to one shared bucket locally. */
export function clientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() || request.headers.get('x-real-ip') || '127.0.0.1'
  );
}
