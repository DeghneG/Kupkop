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
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[12px] font-semibold bg-claimed-bg text-claimed-fg shrink-0 border border-claimed-fg/20">
            <Lock className="w-3 h-3 shrink-0" aria-hidden="true" />
            <span>Claimed</span>
          </span>
        );
      case 'healing':
      case 'admitted':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[12px] font-semibold bg-healing-bg text-healing-fg shrink-0 border border-healing-fg/20">
            <HeartPulse className="w-3 h-3 shrink-0" aria-hidden="true" />
            <span>{incident.state === 'admitted' ? 'Admitted' : 'Healing'}</span>
          </span>
        );
      case 'resolved':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[12px] font-semibold bg-resolved-bg text-resolved-fg shrink-0 border border-resolved-fg/20">
            <CheckCircle2 className="w-3 h-3 shrink-0" aria-hidden="true" />
            <span>Resolved</span>
          </span>
        );
      case 'reported':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[12px] font-semibold bg-reported-bg text-reported-fg shrink-0 border border-reported-fg/20">
            <AlertCircle className="w-3 h-3 shrink-0" aria-hidden="true" />
            <span>Reported</span>
          </span>
        );
    }
  };

  // Clean triage category formatting
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
      className="group w-full flex items-start gap-3.5 py-3.5 px-2 -mx-2 rounded-xl transition-all cursor-pointer text-left border-b border-border/70 hover:bg-surface-muted/50 active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-action"
    >
      {/* Left: 72px Clean Rounded Thumbnail with subtle blur & lens icon, NO watermark text */}
      <div className="w-[72px] h-[72px] min-w-[72px] min-h-[72px] rounded-xl overflow-hidden bg-surface-muted border border-border shrink-0 flex items-center justify-center relative group-hover:border-fg-muted/40 transition-colors">
        {incident.photoUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={incident.photoUrl}
            alt={`Evidence for ${incident.animal}`}
            className="w-full h-full object-cover blur-[1.5px] scale-105"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-surface-muted">
            <Camera className="w-5 h-5 text-fg-muted/40" aria-hidden="true" />
          </div>
        )}
        {/* Subtle, Understated Lens Overlay (No bulky EVIDENCE text badge) */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/15 group-hover:bg-black/25 transition-colors">
          <div className="w-7 h-7 rounded-full bg-black/40 backdrop-blur-xs flex items-center justify-center">
            <Camera className="w-3.5 h-3.5 text-white/90 drop-shadow" aria-hidden="true" />
          </div>
        </div>
      </div>

      {/* Right Details Column: Pure Typographic Hierarchy */}
      <div className="flex-1 min-w-0 space-y-1">
        {/* Top Meta Line: Single Status Pill + Timestamp & Distance */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {renderStatus()}
            <span className="font-mono text-[12px] font-normal text-fg-muted/80 tabular-nums">
              #{incident.shortId}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[12px] text-fg-muted tabular-nums shrink-0">
            <span>{incident.timeAgo}</span>
            <span className="text-border" aria-hidden="true">•</span>
            <span className="font-medium text-fg-muted">{incident.distance}</span>
          </div>
        </div>

        {/* Primary Headline: Animal + Triage Category unified seamlessly */}
        <h3 className="text-[16px] font-semibold text-fg tracking-tight leading-snug group-hover:text-action transition-colors truncate">
          <span>{incident.animal}</span>
          <span className="text-fg-muted font-normal text-[14px]"> · {formatTriageTag(incident.type)}</span>
        </h3>

        {/* Location / Street Landmark */}
        <div className="flex items-center gap-1.5 text-[12px] text-fg-muted">
          <MapPin className="w-3.5 h-3.5 text-fg-muted shrink-0" aria-hidden="true" />
          <span className="truncate leading-tight font-normal">{incident.location}</span>
        </div>

        {/* Optional Field Note */}
        {incident.description && (
          <p className="text-[12px] text-fg-muted/80 truncate pt-0.5">
            {incident.description}
          </p>
        )}
      </div>
    </article>
  );
}

export default IncidentCard;

