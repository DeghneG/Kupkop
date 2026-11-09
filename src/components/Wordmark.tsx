import React from 'react';

// "KupKop" as two strands over a woven underline: Kup in the shell's ink, Kop in the ochre strand.
// On the pale ground the two strands are ink and indigo. Same face as the rest of the app (Atkinson 700).
export default function Wordmark({ onShell = false, className = '' }: { onShell?: boolean; className?: string }) {
  return (
    <span className={`inline-block font-brand font-bold tracking-tight leading-none ${className}`}>
      <span className={onShell ? 'text-shell-fg' : 'text-fg'}>Kup</span>
      <span className={onShell ? 'text-weave-b' : 'text-action'}>Kop</span>
      <span className="selvedge-thin block mt-1" style={{ height: 3 }} aria-hidden="true" />
    </span>
  );
}
