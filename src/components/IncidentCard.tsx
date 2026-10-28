'use client';

import React from 'react';
import { ArrowUp, Camera } from 'lucide-react';
import { calculateEscalation, calculateClaimTimer } from '@/lib/sos/escalation';
import TriageGlyph from '@/components/icons/TriageGlyph';

export interface IncidentData {
  id: string;
  shortId: string;
  animal: string;
  type: string;
  location: string;
  /** Set only when the device position is known. */
  distance?: string;
  bearing?: string;
  timeAgo: string;
  state: 'reported' | 'claimed' | 'admitted' | 'healing' | 'resolved';
  blurred?: boolean;
  photoUrl?: string;
  latitude?: number;
  longitude?: number;
  description?: string;
  claimedBy?: string | null;
  claimedAt?: string | null;
  createdAt?: string | null;
  facilityId?: string | null;
  facilityName?: string | null;
}

export interface IncidentCardProps {
  incident: IncidentData;
  onClick: () => void;
  isLast?: boolean;
}

// Status reads as colored text, not a filled pill, so a full feed stays inside the color budget
function getStatus(incident: IncidentData): { label: string; tone: string } {
  switch (incident.state) {
    case 'claimed': {
      const timer = calculateClaimTimer(incident.claimedAt);
      if (!timer.isClaimed || timer.isExpired) return { label: 'Claimed', tone: 'text-claimed-fg' };
      const left = timer.remainingMinutes > 0 ? `${timer.remainingMinutes}m` : `${timer.remainingSeconds}s`;
      return { label: `Claimed · ${left} lock`, tone: 'text-claimed-fg' };
    }
    case 'admitted':
      return { label: 'Admitted', tone: 'text-healing-fg' };
    case 'healing':
      return { label: 'Healing', tone: 'text-healing-fg' };
    case 'resolved':
      return { label: 'Resolved', tone: 'text-resolved-fg' };
    case 'reported':
    default: {
      const escalated = calculateEscalation(incident.createdAt, incident.type)?.stage === 'alert';
      return { label: escalated ? 'Needs rescuer' : 'Reported', tone: 'text-reported-fg' };
    }
  }
}

// getDirectionalBearing returns one of these, clockwise from north; drawn as a rotated icon
const BEARING_ARROWS = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];

// Drop the "· Critical" suffix; the status line already carries urgency
const formatTriageTag = (type: string) => type.replace(/\s*[·•]\s*Critical/i, '').trim();

export function IncidentCard({ incident, onClick }: IncidentCardProps) {
  const status = getStatus(incident);

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      aria-label={`${status.label}: ${incident.animal}, ${incident.type}, ${incident.location}`}
      className="w-full flex items-center gap-3 py-3 px-4 cursor-pointer text-left transition-colors hover:bg-surface-muted/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-action"
    >
      {/* Thumbnail is blurred so graphic injuries are not shown until the case is opened */}
      <div className="w-16 h-16 rounded-xl overflow-hidden bg-surface-muted shrink-0 flex items-center justify-center">
        {incident.photoUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={incident.photoUrl} alt="" className="w-full h-full object-cover blur-md scale-110" />
        ) : (
          <Camera className="w-5 h-5 text-fg-muted" aria-hidden="true" />
        )}
      </div>

      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-[16px] font-semibold text-fg tracking-tight leading-snug truncate">
            {incident.animal}
            <span className="text-fg-muted font-normal text-[14px]"> · {formatTriageTag(incident.type)}</span>
          </h3>
          <span className="text-[12px] text-fg-muted tabular-nums shrink-0">{incident.timeAgo}</span>
        </div>

        <p className="text-[14px] text-fg-muted truncate leading-snug">{incident.location}</p>

        <div className="flex items-center gap-2 text-[12px] text-fg-muted tabular-nums min-w-0">
          <span className={`inline-flex items-center gap-1 font-semibold shrink-0 ${status.tone}`}>
            <TriageGlyph state={incident.state} emergencyType={incident.type} size={13} className="shrink-0" />
            {status.label}
          </span>
          {incident.distance && (
            <>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1 shrink-0">
                {incident.bearing && BEARING_ARROWS.includes(incident.bearing) && (
                  <ArrowUp
                    className="w-3 h-3"
                    style={{ transform: `rotate(${BEARING_ARROWS.indexOf(incident.bearing) * 45}deg)` }}
                    aria-hidden="true"
                  />
                )}
                {incident.distance}
              </span>
            </>
          )}
          <span aria-hidden="true">·</span>
          <span className="truncate">#{incident.shortId}</span>
        </div>
      </div>
    </article>
  );
}

export default IncidentCard;
