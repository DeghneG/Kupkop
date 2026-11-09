import React from 'react';
import { AlertCircle } from 'lucide-react';

// Error messages read in normal text with an amber icon. Coral stays reserved for emergency
// actions and the Reported status (AGENTS.md design floor).
export default function InlineError({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <p role="alert" className={`flex items-start gap-2 text-[12px] font-semibold text-fg ${className}`}>
      <AlertCircle className="w-4 h-4 mt-px shrink-0 text-claimed-fg" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}
