'use client';

import React from 'react';
import { projectToBox, type TrackPoint } from '@/lib/sos/rescuer';

const W = 320;
const H = 190;

interface LiveTrackMapProps {
  /** Where the animal is */
  scene: { lat: number; lng: number };
  /** The volunteer's recent positions, oldest first; the last one is where they are now */
  trail: TrackPoint[];
  arrived: boolean;
  /** Said to screen readers, since the picture itself is decoration for them */
  summary: string;
}

// A small map in the style of a ride or delivery app: the volunteer's marker moves along its trail toward the animal.
// It is drawn here (no map service, no tiles), so it works offline and sends nothing anywhere. The streets are only a
// backdrop, not real roads: the dashed line is the straight way to the animal, the solid line is where they have been.
export default function LiveTrackMap({ scene, trail, arrived, summary }: LiveTrackMapProps) {
  const now = trail[trail.length - 1];
  const { xy, project } = projectToBox([scene, ...trail], W, H, 0.22);
  const dest = xy[0];
  const here = now ? project(now) : dest;
  const trailPath = trail.map((p) => project(p)).map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  // Which way the marker faces: along the last bit of the trail, else toward the animal
  const prev = trail.length > 1 ? project(trail[trail.length - 2]) : null;
  const from = prev ?? here;
  const dx = (prev ? here.x - prev.x : dest.x - here.x) || 0;
  const dy = (prev ? here.y - prev.y : dest.y - here.y) || 0;
  void from;
  const heading = dx === 0 && dy === 0 ? 0 : (Math.atan2(dx, -dy) * 180) / Math.PI;

  const street = 'var(--surface)';
  return (
    <div className="rounded-xl overflow-hidden border border-border">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary} className="block w-full h-auto" style={{ background: 'var(--surface-muted)' }}>
        {/* Backdrop streets (sample, not real roads) */}
        <g aria-hidden="true">
          {[28, 78, 126, 168].map((y) => (
            <rect key={`h${y}`} x="0" y={y - 6} width={W} height="12" fill={street} />
          ))}
          {[40, 112, 196, 270].map((x) => (
            <rect key={`v${x}`} x={x - 6} y="0" width="12" height={H} fill={street} />
          ))}
          <rect x="140" y="0" width="8" height={H} fill={street} transform="rotate(18 144 95)" opacity="0.7" />
        </g>

        {/* Where they have been, and the way still to go */}
        {trail.length > 1 && <polyline points={trailPath} fill="none" stroke="var(--action)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />}
        {!arrived && <line x1={here.x} y1={here.y} x2={dest.x} y2={dest.y} stroke="var(--fg-muted)" strokeWidth="3" strokeDasharray="2 7" strokeLinecap="round" />}

        {/* The animal: the emergency pin */}
        <g transform={`translate(${dest.x} ${dest.y})`} aria-hidden="true">
          <circle r="15" fill="var(--accent)" opacity="0.18" />
          <circle r="9" fill="var(--accent)" stroke="#fff" strokeWidth="3" />
          <circle r="2.6" fill="#fff" />
        </g>

        {/* The volunteer: slides to each new position (the page's reduced-motion rule makes it jump instead) */}
        {now && (
          <g aria-hidden="true" style={{ transform: `translate(${here.x}px, ${here.y}px)`, transition: 'transform 1.8s linear' }}>
            <circle r="16" fill="var(--action)" opacity="0.15" />
            <circle r="11" fill="var(--action)" stroke="#fff" strokeWidth="3" />
            <polygon points="0,-6 4.5,5 0,2.5 -4.5,5" fill="#fff" transform={`rotate(${heading.toFixed(0)})`} />
          </g>
        )}
      </svg>
    </div>
  );
}
