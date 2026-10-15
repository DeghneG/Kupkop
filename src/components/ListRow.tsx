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
}

interface ListRowProps {
  incident: IncidentData;
  onClick: () => void;
  isLast?: boolean;
}

export function ListRow({ incident, onClick, isLast = false }: ListRowProps) {
  // Status indicator config
  const renderStatus = () => {
    switch (incident.state) {
      case 'claimed':
        return (
          <span className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-claimed-fg">
            <Lock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Claimed</span>
          </span>
        );
      case 'healing':
      case 'admitted':
        return (
          <span className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-healing-fg">
            <HeartPulse className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>{incident.state === 'admitted' ? 'Admitted' : 'Healing'}</span>
          </span>
        );
      case 'resolved':
        return (
          <span className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-resolved-fg">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Resolved</span>
          </span>
        );
      case 'reported':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-reported-fg">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Reported</span>
          </span>
        );
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onClick}
        aria-label={`View emergency report for ${incident.animal}`}
        className="w-full min-h-[72px] py-3.5 px-4 flex items-center gap-3.5 text-left active:opacity-60 transition-opacity cursor-pointer focus:outline-none focus:bg-surface-muted/50"
      >
        {/* Left: 56px circular blurred thumbnail */}
        <div className="w-14 h-14 rounded-full overflow-hidden bg-surface-muted border border-border shrink-0 flex items-center justify-center relative">
          <div className="w-full h-full flex flex-col items-center justify-center blur-sm scale-110">
            <Camera className="w-5 h-5 text-fg-muted" aria-hidden="true" />
          </div>
        </div>

        {/* Right Details Column (3 lines) */}
        <div className="flex-1 min-w-0 space-y-0.5">
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
            {incident.type} · {incident.distance}
          </p>

          {/* Line 3: Status icon + text */}
          <div className="pt-0.5 leading-none">
            {renderStatus()}
          </div>
        </div>
      </button>

      {/* iOS Inset Hairline Divider (starts after thumbnail) */}
      {!isLast && (
        <div
          className="ml-[74px] border-b border-border"
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
          <div className="w-full min-h-[72px] py-3.5 px-4 flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-full bg-surface-muted animate-pulse shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="flex justify-between items-center">
                <div className="w-28 h-4 rounded bg-surface-muted animate-pulse" />
                <div className="w-12 h-3 rounded bg-surface-muted animate-pulse" />
              </div>
              <div className="w-36 h-3.5 rounded bg-surface-muted animate-pulse" />
              <div className="w-20 h-3.5 rounded bg-surface-muted animate-pulse" />
            </div>
          </div>
          {idx < 2 && <div className="ml-[74px] border-b border-border" />}
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
