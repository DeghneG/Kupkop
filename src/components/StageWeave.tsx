'use client';

import React, { useEffect, useState } from 'react';

type Stage = 'reported' | 'claimed' | 'admitted' | 'healing' | 'resolved';

const STAGES: { id: Stage; label: string }[] = [
  { id: 'reported', label: 'Reported' },
  { id: 'claimed', label: 'Claimed' },
  { id: 'admitted', label: 'Admitted' },
  { id: 'healing', label: 'Healing' },
  { id: 'resolved', label: 'Resolved' },
];

// Cells reached so far: red while a case still needs a rescuer, indigo/ochre twill once a volunteer
// has it, leaf green once an animal is in a clinic's care. The strip says what the status word says.
function cellClass(stage: Stage, index: number, reached: number): string {
  if (index > reached) return '';
  if (stage === 'reported') return 'r';
  if (stage === 'claimed') return 'w';
  return 'g';
}

export default function StageWeave({
  state,
  blank = false,
  showLabels = false,
  className = '',
}: {
  state?: Stage;
  /** An empty mat: no stage reached. Used where there is nothing to show yet. */
  blank?: boolean;
  /** Names under each cell, for the case sheet; feed rows rely on the status line instead */
  showLabels?: boolean;
  className?: string;
}) {
  const stage: Stage = state ?? 'reported';
  const reached = blank ? -1 : STAGES.findIndex((s) => s.id === stage);

  // When a case advances, the newly reached cells weave in once, one after another. It never plays on
  // first paint, so a long feed does not animate. Reduced motion shortens it (globals.css).
  const [prev, setPrev] = useState(reached);
  const [fresh, setFresh] = useState<number[]>([]);
  if (reached !== prev) {
    setPrev(reached);
    setFresh(reached > prev ? Array.from({ length: reached - prev }, (_, k) => prev + 1 + k) : []);
  }
  useEffect(() => {
    if (fresh.length === 0) return;
    const timer = setTimeout(() => setFresh([]), 900);
    return () => clearTimeout(timer);
  }, [fresh]);

  return (
    <div className={className}>
      <div
        className="weave"
        {...(blank
          ? { 'aria-hidden': true }
          : { role: 'img', 'aria-label': `Stage ${reached + 1} of 5: ${STAGES[reached]?.label ?? stage}` })}
      >
        {STAGES.map((s, i) => {
          const order = fresh.indexOf(i);
          return (
            <i
              key={s.id}
              className={`${cellClass(stage, i, reached)} ${order >= 0 ? 'fresh' : ''}`}
              style={order >= 0 ? { animationDelay: `${order * 110}ms` } : undefined}
            />
          );
        })}
      </div>
      {showLabels && !blank && (
        <div className="mt-1 grid grid-cols-5 text-[12px] text-fg-muted" aria-hidden="true">
          {STAGES.map((s, i) => (
            <span key={s.id} className={i === reached ? 'font-bold text-fg' : ''}>
              {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
