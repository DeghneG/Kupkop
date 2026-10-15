'use client';

import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

// Register GSAP plugins if needed
if (typeof window !== 'undefined') {
  gsap.registerPlugin(useGSAP);
}

/**
 * Executes GSAP animations adhering strictly to KupKop rules:
 * - Only animates transform (x, y, scale) and opacity
 * - Wraps in gsap.matchMedia for prefers-reduced-motion
 * - Auto-clean on unmount handled by useGSAP
 */
export function safeAnimate(
  contextRef: React.RefObject<HTMLElement | null>,
  animationFn: (context: gsap.Context) => void
) {
  const mm = gsap.matchMedia();

  mm.add('(prefers-reduced-motion: no-preference)', (context) => {
    animationFn(context);
  });

  return mm;
}

export { gsap, useGSAP };
