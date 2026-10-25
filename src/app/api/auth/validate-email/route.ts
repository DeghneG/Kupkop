import { NextResponse } from 'next/server';
import dns from 'dns/promises';

// Standard RFC email syntax validation
const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = body?.email;

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { valid: false, reason: 'Email address is required.' },
        { status: 400 }
      );
    }

    const trimmed = email.trim().toLowerCase();

    // 1. Basic format validation
    if (!EMAIL_REGEX.test(trimmed) || trimmed.length > 254) {
      return NextResponse.json(
        { valid: false, reason: 'Please enter a valid email address format.' },
        { status: 400 }
      );
    }

    const [, domain] = trimmed.split('@');
    if (!domain || !domain.includes('.')) {
      return NextResponse.json(
        { valid: false, reason: 'Please enter a valid email domain (e.g., gmail.com).' },
        { status: 400 }
      );
    }

    // 2. DNS MX and A record verification (checks if domain exists and can receive email)
    try {
      const mxRecords = await dns.resolveMx(domain);
      if (!mxRecords || mxRecords.length === 0) {
        // Fallback: check if domain has an A record (RFC 5321 fallback)
        const aRecords = await dns.resolve4(domain);
        if (!aRecords || aRecords.length === 0) {
          return NextResponse.json(
            {
              valid: false,
              reason: `The domain "@${domain}" does not exist or cannot receive email.`,
            },
            { status: 400 }
          );
        }
      }
    } catch (dnsErr: unknown) {
      const err = dnsErr as { code?: string };
      if (err.code === 'ENOTFOUND' || err.code === 'ENODATA' || err.code === 'SERVFAIL') {
        return NextResponse.json(
          {
            valid: false,
            reason: `The email domain "@${domain}" does not exist. Please check your spelling.`,
          },
          { status: 400 }
        );
      }
      // If network DNS resolution times out in local sandbox, allow to fall through to Supabase
    }

    return NextResponse.json({ valid: true, email: trimmed });
  } catch {
    return NextResponse.json(
      { valid: false, reason: 'Could not validate email. Please try again.' },
      { status: 500 }
    );
  }
}
