import React from 'react';

// The 14-day recovery clock as fourteen woven cells: leaf twill while updates are on time (days 1-10),
// ochre twill when an update is due soon (11-13), dark ochre on day 14 or later (overdue). Red is
// reserved for SOS and Reported, so overdue never uses it. The words beside the strip say the same thing.
export default function DayWeave({ elapsedDays, className = '' }: { elapsedDays: number; className?: string }) {
  const day = Math.min(14, elapsedDays + 1);
  return (
    <div className={className}>
      <div className="weave14" role="img" aria-label={`Day ${day} of 14`}>
        {Array.from({ length: 14 }, (_, i) => {
          const n = i + 1;
          const cls = n > day ? '' : n >= 14 ? 'o' : n >= 11 ? 'w' : 'g';
          return <i key={n} className={cls} />;
        })}
      </div>
    </div>
  );
}
