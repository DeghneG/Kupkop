'use client';

import React from 'react';
import { ArrowUp } from 'lucide-react';
import type { IncidentData } from '@/components/IncidentCard';
import StageWeave from '@/components/StageWeave';
import AnimalGlyph, { animalKind } from '@/components/AnimalGlyph';
import { getEscalationTier } from '@/lib/sos/escalation';

// getDirectionalBearing returns one of these, clockwise from north; drawn as a rotated arrow
const BEARING_ARROWS = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];

interface FeaturedCaseProps {
  incident: IncidentData;
  onOpen: () => void;
  /** Volunteers and admins can claim straight from the card */
  onClaim?: () => void;
  claiming?: boolean;
  /** Open again but held for the first volunteer on standby */
  claimHeld?: boolean;
}

// The case that has waited longest for a rescuer, given the room it deserves at the top of the list.
// One focal point instead of a column of equal rows.
export default function FeaturedCase({ incident, onOpen, onClaim, claiming, claimHeld }: FeaturedCaseProps) {
  const tier = getEscalationTier(incident.type);
  const tag = tier === 'critical' ? 'Critical' : tier === 'urgent' ? 'Urgent' : null;
  const type = incident.type.replace(/\s*[·•]\s*Critical/i, '').trim();
  const arrowIndex = incident.bearing ? BEARING_ARROWS.indexOf(incident.bearing) : -1;

  return (
    <section
      aria-label="The case that needs a rescuer first"
      className="mx-4 mt-4 rounded-2xl bg-open-bg border border-border shadow-sm p-4 space-y-3"
    >
      <div className="flex gap-3">
        <div className="w-[72px] h-[72px] rounded-2xl bg-surface border border-border shrink-0 flex items-center justify-center">
          <AnimalGlyph kind={animalKind(incident.animalType, incident.animal)} size={54} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-[22px] font-bold leading-tight tracking-tight text-fg truncate">
              {incident.animalName ? `${incident.animalName} · ${incident.animal}` : incident.animal}
            </h2>
            <span className="text-[12px] font-bold tabular-nums text-fg shrink-0">{incident.timeAgo}</span>
          </div>
          <p className="flex items-baseline gap-2 min-w-0">
            <span className="text-[16px] font-semibold text-fg">{type}</span>
            {tag && (
              <span
                className={`text-[12px] font-bold uppercase tracking-wide ${
                  tier === 'critical' ? 'text-reported-fg' : 'text-claimed-fg'
                }`}
              >
                {tag}
              </span>
            )}
          </p>
          <p className="flex items-center gap-1.5 text-[14px] text-fg-muted min-w-0">
            <span className="truncate">{incident.location}</span>
            {incident.distance && (
              <span className="inline-flex items-center gap-1 shrink-0 font-semibold text-fg tabular-nums">
                · {arrowIndex >= 0 && (
                  <ArrowUp className="w-3 h-3" style={{ transform: `rotate(${arrowIndex * 45}deg)` }} aria-hidden="true" />
                )}
                {incident.distance}
              </span>
            )}
          </p>
        </div>
      </div>

      <div>
        <StageWeave state={incident.state} />
        <p className="mt-1.5 text-[12px] font-bold text-reported-fg">No responder yet · #{incident.shortId}</p>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onOpen}
          className="flex-1 min-h-[48px] rounded-xl border border-border bg-surface hover:bg-surface-muted text-fg font-semibold text-[14px] cursor-pointer"
        >
          View case
        </button>
        {onClaim && (
          <button
            type="button"
            onClick={onClaim}
            disabled={claiming || claimHeld}
            className="flex-1 min-h-[48px] rounded-xl border-2 border-action bg-surface hover:bg-surface-muted text-action font-bold text-[14px] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {claiming ? 'Claiming…' : claimHeld ? 'Held for next in line' : 'Claim this rescue'}
          </button>
        )}
      </div>
    </section>
  );
}
