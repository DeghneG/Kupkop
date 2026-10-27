'use client';

import React from 'react';
import { Camera, AlertCircle, Lock, HeartPulse, CheckCircle2, MapPin } from 'lucide-react';

export interface IncidentData {
  id: string;
  shortId: string;
  animal: string;
  type: string;
  location: string;
  distance: string;
  timeAgo: string;
  state: 'reported' | 'claimed' | 'admitted' | 'healing' | 'resolved';
  blurred?: boolean;
  photoUrl?: string;
  latitude?: number;
  longitude?: number;
  description?: string;
}

export interface IncidentCardProps {
  incident: IncidentData;
  onClick: () => void;
  isLast?: boolean;
}

export function IncidentCard({ incident, onClick }: IncidentCardProps) {
  // Status indicator config with tinted background pill
  const renderStatus = () => {
    switch (incident.state) {
      case 'claimed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[12px] font-semibold bg-claimed-bg text-claimed-fg shrink-0">
            <Lock className="w-3 h-3 shrink-0" aria-hidden="true" />
            <span>Claimed</span>
          </span>
        );
      case 'healing':
      case 'admitted':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[12px] font-semibold bg-healing-bg text-healing-fg shrink-0">
            <HeartPulse className="w-3 h-3 shrink-0" aria-hidden="true" />
            <span>{incident.state === 'admitted' ? 'Admitted' : 'Healing'}</span>
          </span>
        );
      case 'resolved':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[12px] font-semibold bg-resolved-bg text-resolved-fg shrink-0">
            <CheckCircle2 className="w-3 h-3 shrink-0" aria-hidden="true" />
            <span>Resolved</span>
          </span>
        );
      case 'reported':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[12px] font-semibold bg-reported-bg text-reported-fg shrink-0">
            <AlertCircle className="w-3 h-3 shrink-0" aria-hidden="true" />
            <span>Reported</span>
          </span>
        );
    }
  };

  // Clean triage category (neutral outlined tag per AGENTS.md)
  const formatTriageTag = (type: string) => {
    return type.replace(/\s*[·•]\s*Critical/i, '').trim();
  };

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
      aria-label={`View emergency report for ${incident.animal}, ${incident.type}, ${incident.location}`}
      className="w-full bg-surface rounded-2xl p-4 border border-border shadow-sm hover:border-fg-muted/40 active:scale-[0.99] transition-all cursor-pointer text-left focus:outline-none focus:ring-2 focus:ring-accent/40 space-y-3"
    >
      {/* Top Header Row: Status + Triage on Left, Time & Distance on Right */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {renderStatus()}
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-medium border border-border text-fg-muted bg-surface-muted/50">
            {formatTriageTag(incident.type)}
          </span>
        </div>

        {/* Time and Distance */}
        <div className="flex items-center gap-1.5 text-[12px] text-fg-muted tabular-nums shrink-0">
          <span>{incident.timeAgo}</span>
          <span className="text-border" aria-hidden="true">•</span>
          <span>{incident.distance}</span>
        </div>
      </div>

      {/* Main Body Row: 60px Rounded Thumbnail + Animal & Location */}
      <div className="flex items-center gap-3.5">
        {/* Left: Rounded rectangular photo preview with gentle blur */}
        <div className="w-[60px] h-[60px] rounded-xl overflow-hidden bg-surface-muted border border-border shrink-0 flex items-center justify-center relative">
          {incident.photoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={incident.photoUrl}
              alt={`Evidence for ${incident.animal}`}
              className="w-full h-full object-cover blur-[2px] scale-105"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-surface-muted to-border/40 blur-sm scale-110">
              <Camera className="w-5 h-5 text-fg-muted/50" aria-hidden="true" />
            </div>
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/15">
            <Camera className="w-4 h-4 text-white drop-shadow" aria-hidden="true" />
          </div>
        </div>

        {/* Right Details Column */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-baseline justify-between gap-1">
            <h3 className="text-[16px] font-semibold text-fg truncate tracking-tight leading-snug">
              {incident.animal}
            </h3>
            <span className="font-mono text-[12px] font-normal text-fg-muted tabular-nums shrink-0">
              {incident.shortId}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-[12px] text-fg-muted">
            <MapPin className="w-3.5 h-3.5 text-fg-muted shrink-0" aria-hidden="true" />
            <span className="truncate leading-tight font-normal">{incident.location}</span>
          </div>
        </div>
      </div>

      {/* Optional Scene / Landmark Note */}
      {incident.description && (
        <div className="pt-2 border-t border-border/60 flex items-start gap-1.5 text-[12px] text-fg-muted">
          <span className="font-semibold text-fg shrink-0">Note:</span>
          <span className="truncate">{incident.description}</span>
        </div>
      )}
    </article>
  );
}

export default IncidentCard;
