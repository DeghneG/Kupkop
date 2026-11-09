import { ImageResponse } from 'next/og';

// App icons for the home screen and alerts, drawn from the KupKop mark (same as the header).
// Colors are the page and fg tokens (globals.css); ImageResponse cannot read CSS variables.
const TILE = '#0E1411';
const MARK = '#F6F4EE';
const SIZES = new Set([96, 180, 192, 512]);

export function GET(request: Request) {
  const asked = Number(new URL(request.url).searchParams.get('size'));
  const size = SIZES.has(asked) ? asked : 192;
  const mark = Math.round(size * 0.62);

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: TILE }}>
        <svg width={mark} height={mark} viewBox="0 0 24 24" fill="none">
          <path d="M3 13C3 7.8 7.2 3.5 12 3.5C16.8 3.5 21 7.8 21 13" stroke={MARK} strokeWidth="2" strokeLinecap="round" />
          <path
            d="M12 18.5C10 18.5 8.5 17 8.5 15.2C8.5 13.8 9.8 12.5 12 11.2C14.2 12.5 15.5 13.8 15.5 15.2C15.5 17 14 18.5 12 18.5Z"
            fill={MARK}
          />
          <circle cx="8" cy="10.2" r="1.4" fill={MARK} />
          <circle cx="16" cy="10.2" r="1.4" fill={MARK} />
        </svg>
      </div>
    ),
    { width: size, height: size, headers: { 'Cache-Control': 'public, max-age=604800, immutable' } }
  );
}
