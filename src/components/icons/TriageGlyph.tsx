import React from 'react';

export type TriageGlyphState = 'reported' | 'claimed' | 'admitted' | 'healing' | 'resolved';

interface TriageGlyphProps {
  state?: TriageGlyphState;
  emergencyType?: string | null;
  className?: string;
  size?: number;
}

/**
 * 1. PulseBeacon: Emergency radio signal pulse for Critical (Hit-and-Run / Arterial Bleeding)
 */
export function PulseBeacon({ size = 14, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="2" fill="currentColor" />
      <path
        d="M4.6 4.6a4.8 4.8 0 0 0 0 6.8M11.4 4.6a4.8 4.8 0 0 1 0 6.8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M2.3 2.3a8.1 8.1 0 0 0 0 11.4M13.7 2.3a8.1 8.1 0 0 1 0 11.4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * 2. BoneSplint: Orthopedic care & support for Fracture / Limping
 */
export function BoneSplint({ size = 14, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Orthopedic Bone silhouette angled across the badge */}
      <path
        d="M4 5.2a1.4 1.4 0 0 1 1.2-.7c.4 0 .7.2.9.5l4.2 4.2c.3.3.7.4 1.1.2a1.4 1.4 0 1 1 1.2 2.2 1.4 1.4 0 0 1-1.2.7c-.4 0-.7-.2-.9-.5L6.3 7.6c-.3-.3-.7-.4-1.1-.2A1.4 1.4 0 1 1 4 5.2z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Stabilization splint cross-bands */}
      <line x1="6" y1="9.5" x2="9.5" y2="6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

/**
 * 3. ExtractionWedge: Enclosure grate with upward rescue hook for Trapped in storm drain
 */
export function ExtractionWedge({ size = 14, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Storm drain grate rim */}
      <rect x="2.5" y="4" width="11" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <line x1="5.7" y1="4" x2="5.7" y2="13" stroke="currentColor" strokeWidth="1.4" />
      <line x1="10.3" y1="4" x2="10.3" y2="13" stroke="currentColor" strokeWidth="1.4" />
      {/* Upward rescue extraction wedge */}
      <path
        d="M8 2.2l-2.2 2.2h4.4L8 2.2z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * 4. CareShield: Medical treatment shield for Sick / Severe Mange
 */
export function CareShield({ size = 14, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M8 2.3l4.5 1.8v3.6c0 3.2-2 5.6-4.5 6.5-2.5-.9-4.5-3.3-4.5-6.5V4.1L8 2.3z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      {/* Clean medical cross */}
      <path
        d="M8 5.5v4m-2-2h4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * 5. ResponderCompass: Tactical field navigation compass for Claimed lock (en route)
 */
export function ResponderCompass({ size = 14, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Outer compass rim */}
      <circle cx="8" cy="8" r="5.8" stroke="currentColor" strokeWidth="1.4" />
      {/* North indicator needle (filled active arrow) */}
      <polygon points="8,3.6 9.8,7.6 8,6.8 6.2,7.6" fill="currentColor" />
      {/* South indicator needle (outlined tail) */}
      <polygon points="8,12.4 9.8,8.4 8,9.2 6.2,8.4" stroke="currentColor" strokeWidth="1" fill="none" />
      <circle cx="8" cy="8" r="0.9" fill="currentColor" />
    </svg>
  );
}

/**
 * 6. SanctuarySprout: Botanical healing sprout for Admitted / Healing in partner facility
 */
export function SanctuarySprout({ size = 14, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Curving healing leaf contour */}
      <path
        d="M3.5 12.8C3.5 8.2 6.8 4.6 12.5 3.2c0 5.7-3.6 9-9 9.6z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      {/* Leaf center spine */}
      <path
        d="M3.5 12.8c2-2.2 4.2-3.8 9-9.6"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * 7. SanctuaryShieldCheck: Grounded sanctuary shield for Resolved cases
 */
export function SanctuaryShieldCheck({ size = 14, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M8 2l4.6 1.8v3.8c0 3.3-2.2 5.8-4.6 6.6C5.6 13.4 3.4 10.9 3.4 7.6V3.8L8 2z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M5.8 7.8l1.6 1.6 3.2-3.2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Master TriageGlyph Component
 * Selects the optimal bespoke SVG based on case state and emergency triage category
 */
export default function TriageGlyph({
  state = 'reported',
  emergencyType,
  className = '',
  size = 14,
}: TriageGlyphProps) {
  // If claimed: show Rescuer Navigation Compass
  if (state === 'claimed') {
    return <ResponderCompass size={size} className={className} />;
  }

  // If in care / healing: show Sanctuary Sprout
  if (state === 'admitted' || state === 'healing') {
    return <SanctuarySprout size={size} className={className} />;
  }

  // If resolved: show Shield Check
  if (state === 'resolved') {
    return <SanctuaryShieldCheck size={size} className={className} />;
  }

  // Otherwise, case is reported: adapt icon dynamically to emergency triage
  const normalized = (emergencyType || '').toLowerCase();

  if (normalized.includes('hit') || normalized.includes('bleed') || normalized.includes('critical')) {
    return <PulseBeacon size={size} className={className} />;
  }

  if (normalized.includes('fracture') || normalized.includes('limp')) {
    return <BoneSplint size={size} className={className} />;
  }

  if (normalized.includes('trap') || normalized.includes('drain')) {
    return <ExtractionWedge size={size} className={className} />;
  }

  if (normalized.includes('sick') || normalized.includes('mange')) {
    return <CareShield size={size} className={className} />;
  }

  // Default reported glyph: Pulse Beacon
  return <PulseBeacon size={size} className={className} />;
}

/**
 * KupkopMark: Bespoke compact brand mark icon depicting a protective shelter arch
 * cradling an animal companion silhouette with geometric precision.
 */
export function KupkopMark({ size = 20, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Protective Sheltering Canopy (Kupkop Arch) */}
      <path
        d="M3 13C3 7.8 7.2 3.5 12 3.5C16.8 3.5 21 7.8 21 13"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Sheltered Companion Paw Center */}
      <path
        d="M12 18.5C10 18.5 8.5 17 8.5 15.2C8.5 13.8 9.8 12.5 12 11.2C14.2 12.5 15.5 13.8 15.5 15.2C15.5 17 14 18.5 12 18.5Z"
        fill="currentColor"
      />
      {/* Surrounding Companion Pads */}
      <circle cx="8" cy="10.2" r="1.4" fill="currentColor" />
      <circle cx="16" cy="10.2" r="1.4" fill="currentColor" />
      <circle cx="12" cy="7.8" r="1.4" fill="currentColor" />
    </svg>
  );
}
