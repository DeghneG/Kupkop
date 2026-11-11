'use client';

import React from 'react';
import { ArrowUp } from 'lucide-react';
import {
  calculateEscalation,
  calculateClaimTimer,
  claimWindowMinutes,
  getEscalationTier,
  needsRescuer as isWaiting,
} from '@/lib/sos/escalation';
import TriageGlyph from '@/components/icons/TriageGlyph';
import StageWeave from '@/components/StageWeave';
import AnimalGlyph, { animalKind } from '@/components/AnimalGlyph';

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
  reporterId?: string | null;
  /** dog, cat or other, from the report; sample cases fall back to the label */
  animalType?: 'dog' | 'cat' | 'other' | null;
  claimedAt?: string | null;
  createdAt?: string | null;
  facilityId?: string | null;
  /** When the clinic confirmed the animal arrived; null while an admitted case still waits for it */
  intakeConfirmedAt?: string | null;
  /** When the clinic that was told confirmed the animal is there (Admit stays locked until then) */
  clinicReceivedAt?: string | null;
  facilityName?: string | null;
  /** The scheduler has alerted every volunteer about this case */
  alertWidened?: boolean;
  /** The AI photo check found graphic injuries; the photo stays blurred until revealed */
  aiGraphic?: boolean;
  /** Named by the rescuer, the clinic or an admin ("Bob") */
  animalName?: string | null;
  /** When the case last changed; a released case reads this as the moment it opened again */
  updatedAt?: string | null;
  /** The rescuer's last check-in on this claim */
  checkinKind?: 'on_my_way' | 'arrived' | null;
  checkinAt?: string | null;
  /** The clinic the rescuer told they are coming, and its answer */
  headsUpFacilityId?: string | null;
  headsUpFacilityName?: string | null;
  headsUpEtaMinutes?: number | null;
  headsUpResponse?: 'expecting' | 'cannot' | null;
  headsUpNote?: string | null;
  /** Volunteers who said "I'm available" on a claimed case. Only responders can read this list. */
  standby?: { volunteerId: string; joinedAt: string }[];
}

export interface IncidentCardProps {
  incident: IncidentData;
  onClick: () => void;
  isLast?: boolean;
  /** Shown only for responders on open cases; claims without opening the sheet. */
  onClaim?: () => void;
  claiming?: boolean;
  /** The case is open again but held for the first volunteer on standby; the button is off for everyone else. */
  claimHeld?: boolean;
}

// Status reads as colored text, not a filled pill, so a full feed stays inside the color budget
function getStatus(incident: IncidentData): { label: string; tone: string } {
  switch (incident.state) {
    case 'claimed': {
      const timer = calculateClaimTimer(incident.claimedAt, claimWindowMinutes(incident.type, incident.checkinKind ?? null, incident.headsUpResponse !== 'cannot', incident.headsUpEtaMinutes));
      if (timer.isExpired) return { label: 'Claim expired · needs a rescuer', tone: 'text-reported-fg' };
      if (!timer.isClaimed) return { label: 'Claimed', tone: 'text-claimed-fg' };
      const left = timer.remainingMinutes > 0 ? `${timer.remainingMinutes}m` : `${timer.remainingSeconds}s`;
      if (incident.headsUpFacilityId && incident.headsUpResponse !== 'cannot') return { label: `Claimed · on the way to a clinic · ${left} left`, tone: 'text-claimed-fg' };
      const standby = incident.standby?.length ? ` · ${incident.standby.length} on standby` : '';
      return { label: `Claimed · ${left} lock${standby}`, tone: 'text-claimed-fg' };
    }
    case 'admitted':
      return { label: 'Admitted', tone: 'text-healing-fg' };
    case 'healing':
      return { label: 'Healing', tone: 'text-healing-fg' };
    case 'resolved':
      return { label: 'Resolved', tone: 'text-resolved-fg' };
    case 'reported':
    default: {
      // How long it has waited. Nothing is broadcast yet, so the label only says what is true;
      // the escalation stage still decides the feed order.
      const escalation = calculateEscalation(incident.createdAt, incident.type);
      if (!incident.createdAt) return { label: 'Reported', tone: 'text-reported-fg' };
      if (escalation.stage === 'alert') {
        return { label: `No responder yet`, tone: 'text-reported-fg' };
      }
      if (escalation.stage === 'widened') {
        return {
          label: incident.alertWidened
            ? `Alert sent to all volunteers`
            : `Waiting for a rescuer`,
          tone: 'text-reported-fg',
        };
      }
      return { label: 'Reported', tone: 'text-reported-fg' };
    }
  }
}

// getDirectionalBearing returns one of these, clockwise from north; drawn as a rotated icon
const BEARING_ARROWS = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];

// Drop the "· Critical" suffix; the status line already carries urgency
const formatTriageTag = (type: string) => type.replace(/\s*[·•]\s*Critical/i, '').trim();

export function IncidentCard({ incident, onClick, onClaim, claiming, claimHeld }: IncidentCardProps) {
  const status = getStatus(incident);
  const needsRescuer = isWaiting(incident.state, incident.claimedAt, incident.type, incident.checkinKind ?? null, incident.headsUpResponse !== 'cannot', incident.headsUpEtaMinutes);
  const tier = getEscalationTier(incident.type);

  const showClaim = !!onClaim && needsRescuer;

  // The row and the Claim button are siblings so no control is nested inside another
  return (
    <div
      className={`w-full flex items-center gap-2 transition-colors ${showClaim ? 'pr-4' : ''} ${
        needsRescuer ? 'bg-open-bg hover:bg-open-bg/70' : 'bg-surface hover:bg-surface-muted'
      }`}
    >
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
      className={`flex-1 min-w-0 flex items-center gap-3 py-3 pl-4 ${showClaim ? '' : 'pr-4'} cursor-pointer text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-action`}
    >
      {/* A drawn animal, not a photo: the evidence photo stays in the case sheet, behind its reveal */}
      <div className="w-16 h-16 rounded-xl bg-surface border border-border shrink-0 flex items-center justify-center">
        <AnimalGlyph kind={animalKind(incident.animalType, incident.animal)} size={44} />
      </div>

      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div className="flex items-baseline justify-between gap-3">
          <div className="flex items-baseline gap-2 min-w-0">
            <h3 className="text-[16px] font-bold text-fg tracking-tight leading-snug truncate">
              {incident.animalName ? `${incident.animalName} · ${incident.animal}` : incident.animal}
            </h3>
                      </div>
          {/* How long it has waited is the most urgent fact: strong while a rescuer is needed, quiet after */}
          <span className={`text-[12px] tabular-nums shrink-0 ${needsRescuer ? 'font-bold text-fg' : 'text-fg-muted'}`}>
            {incident.timeAgo}
          </span>
        </div>

        <p className="flex gap-1 text-[14px] leading-snug min-w-0">
          <span className="font-semibold text-fg shrink-0">{formatTriageTag(incident.type)}</span>
          {needsRescuer && tier !== 'moderate' && (
            <span
              className={`shrink-0 text-[12px] font-bold uppercase tracking-wide self-center ${
                tier === 'critical' ? 'text-reported-fg' : 'text-claimed-fg'
              }`}
            >
              {tier === 'critical' ? 'Critical' : 'Urgent'}
            </span>
          )}
          <span className="text-fg-muted truncate">· {incident.location}</span>
        </p>

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
        <StageWeave state={incident.state} className="mt-1.5" />
      </div>
    </article>

      {showClaim && (
        <button
          type="button"
          disabled={claiming || claimHeld}
          onClick={onClaim}
          aria-label={claimHeld ? `Case #${incident.shortId} is held for the next volunteer in line` : `Claim case #${incident.shortId}`}
          className="shrink-0 h-11 px-4 rounded-xl border border-border bg-surface text-[14px] font-semibold text-fg cursor-pointer hover:bg-surface-muted disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {claiming ? 'Claiming…' : claimHeld ? 'Held' : 'Claim'}
        </button>
      )}
    </div>
  );
}

export default IncidentCard;
