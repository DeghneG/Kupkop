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
    <div className="divide-y divide-border" aria-label="Loading incidents" role="status">
      {[1, 2, 3].map((i) => (
        <div key={i} className="w-full flex items-center gap-3 py-3 px-4">
          <div className="w-16 h-16 rounded-xl bg-surface-muted animate-pulse shrink-0" />
          <div className="flex-1 flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <div className="w-40 h-4 rounded bg-surface-muted animate-pulse" />
              <div className="w-10 h-3 rounded bg-surface-muted animate-pulse" />
            </div>
            <div className="w-48 h-3.5 rounded bg-surface-muted animate-pulse" />
            <div className="w-32 h-3 rounded bg-surface-muted animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Empty state
export function EmptyIncidentsState() {
  return (
    <div className="bg-surface rounded-2xl p-6 border border-border shadow-sm text-center space-y-2">
      <p className="text-[14px] font-semibold text-fg">No active incidents nearby</p>
      <p className="text-[12px] text-fg-muted font-normal max-w-[280px] mx-auto">
        New street emergency reports will appear here automatically.
      </p>
    </div>
  );
}
