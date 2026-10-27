'use client';

import React from 'react';
import { IncidentCard, IncidentCardProps, IncidentData } from './IncidentCard';

export type { IncidentData, IncidentCardProps };
export { IncidentCard };
export const ListRow = IncidentCard;
export default IncidentCard;

// Stream Row Skeleton for Loading State
export function ListRowSkeleton() {
  return (
    <div className="divide-y divide-border/60" aria-label="Loading incidents" role="status">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="w-full flex items-start gap-3.5 py-3.5 px-2"
        >
          <div className="w-[72px] h-[72px] rounded-xl bg-surface-muted animate-pulse shrink-0" />
          <div className="flex-1 space-y-2 py-0.5">
            <div className="flex justify-between items-center">
              <div className="w-20 h-4 rounded-full bg-surface-muted animate-pulse" />
              <div className="w-16 h-3.5 rounded bg-surface-muted animate-pulse" />
            </div>
            <div className="w-36 h-4 rounded bg-surface-muted animate-pulse" />
            <div className="w-48 h-3.5 rounded bg-surface-muted animate-pulse" />
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
