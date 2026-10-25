'use client';

import React from 'react';
import { Camera, AlertCircle, Lock, HeartPulse, CheckCircle2 } from 'lucide-react';

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

interface ListRowProps {
  incident: IncidentData;
  onClick: () => void;
  isLast?: boolean;
}

export function ListRow({ incident, onClick, isLast = false }: ListRowProps) {
  // Status indicator config with tinted background pill
  const renderStatus = () => {
    switch (incident.state) {
      case 'claimed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[12px] font-semibold bg-claimed-bg text-claimed-fg">
            <Lock className="w-3 h-3 shrink-0" aria-hidden="true" />
            <span>Claimed</span>
          </span>
        );
      case 'healing':
      case 'admitted':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[12px] font-semibold bg-healing-bg text-healing-fg">
            <HeartPulse className="w-3 h-3 shrink-0" aria-hidden="true" />
            <span>{incident.state === 'admitted' ? 'Admitted' : 'Healing'}</span>
          </span>
        );
      case 'resolved':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[12px] font-semibold bg-resolved-bg text-resolved-fg">
            <CheckCircle2 className="w-3 h-3 shrink-0" aria-hidden="true" />
            <span>Resolved</span>
          </span>
        );
      case 'reported':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[12px] font-semibold bg-reported-bg text-reported-fg">
            <AlertCircle className="w-3 h-3 shrink-0" aria-hidden="true" />
            <span>Reported</span>
          </span>
        );
    }
  };

  // Renders triage severity with only the word "Critical" in red-700/red-400 font-semibold
  const renderTypeText = (type: string) => {
    if (!type.includes('Critical')) {
      return type;
    }
    const parts = type.split('Critical');
    return (
      <>
        {parts.map((part, index) => (
          <React.Fragment key={index}>
            {part}
            {index < parts.length - 1 && (
              <span className="text-reported-fg font-semibold">Critical</span>
            )}
          </React.Fragment>
        ))}
      </>
    );
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onClick}
        aria-label={`View emergency report for ${incident.animal}`}
        className="w-full min-h-[76px] py-3.5 px-4 flex items-center gap-3.5 text-left hover:bg-surface-muted/40 active:opacity-75 transition-colors cursor-pointer focus:outline-none focus:bg-surface-muted/60"
      >
        {/* Left: 64px rounded rectangular photo preview with emergency blur */}
        <div className="w-16 h-16 rounded-[14px] overflow-hidden bg-surface-muted border border-border shrink-0 flex items-center justify-center relative">
          {incident.photoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={incident.photoUrl}
              alt={`Evidence for ${incident.animal}`}
              className="w-full h-full object-cover blur-[2px] scale-105"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-surface-muted to-border/40 blur-sm scale-110">
              <Camera className="w-5 h-5 text-fg-muted/60" aria-hidden="true" />
            </div>
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/10">
            <Camera className="w-4 h-4 text-white drop-shadow" aria-hidden="true" />
          </div>
        </div>

        {/* Right Details Column */}
        <div className="flex-1 min-w-0 space-y-1">
          {/* Line 1: Animal name with right-aligned timestamp */}
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-[16px] font-semibold text-fg truncate leading-snug">
              {incident.animal}
            </h3>
            <span className="text-[12px] font-normal text-fg-muted tabular-nums shrink-0">
              {incident.timeAgo}
            </span>
          </div>

          {/* Line 2: Plain text triage · distance */}
          <p className="text-[14px] font-normal text-fg-muted truncate leading-snug">
            {renderTypeText(incident.type)} · {incident.distance}
          </p>

          {/* Line 3: Status icon + tinted pill */}
          <div className="pt-0.5 leading-none">
            {renderStatus()}
          </div>
        </div>
      </button>

      {/* iOS Inset Hairline Divider (starts after thumbnail: 16px pad + 64px thumb = 80px) */}
      {!isLast && (
        <div
          className="ml-[80px] border-b border-border"
          aria-hidden="true"
        />
      )}
    </div>
  );
}

// 3-Row Static Skeleton for Loading State
export function ListRowSkeleton() {
  return (
    <div className="space-y-0" aria-label="Loading incidents" role="status">
      {[1, 2, 3].map((i, idx) => (
        <div key={i} className="relative">
          <div className="w-full min-h-[76px] py-3.5 px-4 flex items-center gap-3.5">
            <div className="w-16 h-16 rounded-[14px] bg-surface-muted animate-pulse shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="flex justify-between items-center">
                <div className="w-28 h-4 rounded bg-surface-muted animate-pulse" />
                <div className="w-12 h-3 rounded bg-surface-muted animate-pulse" />
              </div>
              <div className="w-36 h-3.5 rounded bg-surface-muted animate-pulse" />
              <div className="w-20 h-3.5 rounded bg-surface-muted animate-pulse" />
            </div>
          </div>
          {idx < 2 && <div className="ml-[80px] border-b border-border" />}
        </div>
      ))}
    </div>
  );
}

// Empty state
export function EmptyIncidentsState() {
  return (
    <div className="py-12 px-4 text-center space-y-1">
      <p className="text-[14px] font-semibold text-fg">No active incidents nearby</p>
      <p className="text-[12px] text-fg-muted font-normal">
        New street emergency reports will appear here automatically.
      </p>
    </div>
  );
}
