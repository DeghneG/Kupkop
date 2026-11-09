import { ImageResponse } from 'next/og';

// App icons for the home screen and alerts, drawn from the KupKop mark (same as the header).
// Colors are the shell and shell-fg tokens (globals.css); ImageResponse cannot read CSS variables.
const TILE = '#232D69';
// A 3x3 plait in the weave strands: straw, ochre and leaf on the indigo tile
const STRAW = '#F4EFDB';
const OCHRE = '#D9A21B';
const LEAF = '#2F7D4F';
const PLAIT = [
  [STRAW, OCHRE, STRAW],
  [OCHRE, LEAF, OCHRE],
  [STRAW, OCHRE, STRAW],
];
const SIZES = new Set([96, 180, 192, 512]);

export function GET(request: Request) {
  const asked = Number(new URL(request.url).searchParams.get('size'));
  const size = SIZES.has(asked) ? asked : 192;
  const mark = Math.round(size * 0.62);

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: TILE }}>
        <svg width={mark} height={mark} viewBox="0 0 24 24">
          {PLAIT.map((row, r) =>
            row.map((color, k) => (
              <rect key={`${r}-${k}`} x={1.7 + k * 7.2} y={1.7 + r * 7.2} width={6.2} height={6.2} rx={1.2} fill={color} />
            ))
          )}
        </svg>
      </div>
    ),
    { width: size, height: size, headers: { 'Cache-Control': 'public, max-age=604800, immutable' } }
  );
}
