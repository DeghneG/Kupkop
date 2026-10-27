'use client';

import React from 'react';
import { IncidentCard, IncidentCardProps, IncidentData } from './IncidentCard';

export type { IncidentData, IncidentCardProps };
export { IncidentCard };
export const ListRow = IncidentCard;
export default IncidentCard;

// Multi-Card Skeleton for Loading State
export function ListRowSkeleton() {
  return (
    <div className="space-y-3" aria-label="Loading incidents" role="status">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="w-full bg-surface rounded-2xl p-4 border border-border shadow-sm space-y-3"
        >
          <div className="flex justify-between items-center">
            <div className="flex gap-2">
              <div className="w-20 h-5 rounded-full bg-surface-muted animate-pulse" />
              <div className="w-16 h-5 rounded-full bg-surface-muted animate-pulse" />
            </div>
            <div className="w-14 h-4 rounded bg-surface-muted animate-pulse" />
          </div>
          <div className="flex items-center gap-3.5">
            <div className="w-[60px] h-[60px] rounded-xl bg-surface-muted animate-pulse shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="w-32 h-4 rounded bg-surface-muted animate-pulse" />
              <div className="w-44 h-3.5 rounded bg-surface-muted animate-pulse" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Empty state
export function EmptyIncidentsState() {
  return (
    <div className="bg-surface rounded-2xl p-8 border border-border shadow-sm text-center space-y-1.5">
      <p className="text-[14px] font-semibold text-fg">No active incidents nearby</p>
      <p className="text-[12px] text-fg-muted font-normal max-w-[280px] mx-auto">
        New street emergency reports will appear here automatically.
      </p>
    </div>
  );
}
