import React from 'react';

export type AnimalKind = 'dog' | 'cat' | 'other';

/** Which drawing a case gets: the report's animal type, else a guess from the label (sample cases). */
export function animalKind(animalType?: string | null, label?: string): AnimalKind {
  if (animalType === 'dog' || animalType === 'cat' || animalType === 'other') return animalType;
  if (/dog|puppy|aspin/i.test(label ?? '')) return 'dog';
  if (/cat|kitten|puspin/i.test(label ?? '')) return 'cat';
  return 'other';
}

const fill = (token: string) => ({ fill: `var(--${token})` });
const line = (token: string) => ({ stroke: `var(--${token})`, fill: 'none' });

// Flat drawings in the weave strands: a dog (aspin), a cat (puspin) and a paw for anything else.
// Decorative: the status words carry the meaning.
export default function AnimalGlyph({ kind, size = 40, className = '' }: { kind: AnimalKind; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className={className} aria-hidden="true">
      {kind === 'dog' && (
        <>
          <path d="M12 12C5 13 3 26 8 35C12 31 14 24 15 17Z" style={fill('weave-a')} />
          <path d="M36 12C43 13 45 26 40 35C36 31 34 24 33 17Z" style={fill('weave-a')} />
          <rect x="11" y="9" width="26" height="28" rx="13" style={fill('weave-b')} />
          <ellipse cx="24" cy="31" rx="8.5" ry="6.5" style={fill('surface')} />
          <ellipse cx="24" cy="28" rx="3.2" ry="2.3" style={fill('fg')} />
          <circle cx="18" cy="21" r="2" style={fill('fg')} />
          <circle cx="30" cy="21" r="2" style={fill('fg')} />
          <path d="M24 30.5V33.5M20.5 34C22 35.8 26 35.8 27.5 34" strokeWidth="1.3" strokeLinecap="round" style={line('fg')} />
        </>
      )}
      {kind === 'cat' && (
        <>
          <path d="M9 22L12 5L23 13Z" style={fill('weave-a')} />
          <path d="M39 22L36 5L25 13Z" style={fill('weave-a')} />
          <ellipse cx="24" cy="28" rx="15" ry="13" strokeWidth="1.5" style={{ fill: 'var(--straw)', stroke: 'var(--weave-b)' }} />
          <ellipse cx="18" cy="26" rx="2.6" ry="3" style={fill('weave-c')} />
          <ellipse cx="30" cy="26" rx="2.6" ry="3" style={fill('weave-c')} />
          <ellipse cx="18" cy="26" rx="0.9" ry="2.2" style={fill('fg')} />
          <ellipse cx="30" cy="26" rx="0.9" ry="2.2" style={fill('fg')} />
          <path d="M22.3 31h3.4L24 33.2Z" style={fill('fg')} />
          <path d="M24 33.2V35.5M21 36C22.5 37.4 25.5 37.4 27 36" strokeWidth="1.2" strokeLinecap="round" style={line('fg')} />
          <path d="M9 30L16 31M9 34L16 33M39 30L32 31M39 34L32 33" strokeWidth="1" strokeLinecap="round" style={line('fg')} />
        </>
      )}
      {kind === 'other' && (
        <>
          <ellipse cx="24" cy="31" rx="10" ry="8" style={fill('weave-a')} />
          <circle cx="13" cy="22" r="3.6" style={fill('weave-a')} />
          <circle cx="20" cy="14" r="3.8" style={fill('weave-a')} />
          <circle cx="28" cy="14" r="3.8" style={fill('weave-a')} />
          <circle cx="35" cy="22" r="3.6" style={fill('weave-a')} />
        </>
      )}
    </svg>
  );
}
