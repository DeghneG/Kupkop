'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, Eye, EyeOff, Maximize2, X } from 'lucide-react';
import { useFocusTrap } from '@/lib/useFocusTrap';

interface CasePhotoProps {
  photoUrl?: string;
  alt: string;
  /** The AI photo check found graphic injuries */
  graphic?: boolean;
  /** Server timestamp of the report (the live-camera evidence stamp) */
  capturedAt?: string | null;
}

function formatStamp(iso: string): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay ? time : `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${time}`;
}

// The evidence photo of a case. Blurred until someone chooses to look (it may show injuries); once
// shown it is left clean: no dimming, no label on the subject. Controls sit in the corners, the
// live-camera stamp says where the photo came from, and tapping the photo opens it full-screen.
// The blur is a crossfade between two layers, so only opacity animates.
export default function CasePhoto({ photoUrl, alt, graphic = false, capturedAt }: CasePhotoProps) {
  const [revealed, setRevealed] = useState(false);
  const [viewing, setViewing] = useState(false);
  const stamp = capturedAt ? `Live camera · ${formatStamp(capturedAt)}` : null;

  const frame = 'relative w-full aspect-[16/10] max-h-60 rounded-2xl overflow-hidden bg-surface-muted border border-border';

  // Sample cases and reports without a photo
  if (!photoUrl) {
    return (
      <div className={`${frame} flex flex-col items-center justify-center gap-1 text-fg-muted`}>
        <Camera className="w-8 h-8" aria-hidden="true" />
        <span className="text-[12px]">Live camera snapshot</span>
      </div>
    );
  }

  const chip =
    'bg-black/70 text-white text-[12px] font-bold rounded-full px-3 min-h-[28px] inline-flex items-center gap-1.5';
  const roundButton =
    'w-11 h-11 rounded-full bg-black/70 text-white flex items-center justify-center cursor-pointer hover:bg-black/85';

  return (
    <>
      <div className={frame}>
        {/* Sharp layer, always underneath */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photoUrl} alt={alt} className="absolute inset-0 w-full h-full object-cover" />

        {/* Blur layer: fades out to show the photo, so only opacity animates */}
        <div
          aria-hidden="true"
          className={`absolute inset-0 transition-opacity duration-300 ${revealed ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoUrl} alt="" className="w-full h-full object-cover blur-2xl scale-110" />
          <div className="absolute inset-0 bg-black/45" />
        </div>

        {revealed ? (
          <>
            {/* Tapping the clean photo opens it large */}
            <button
              type="button"
              onClick={() => setViewing(true)}
              aria-label="Open the photo full screen"
              className="absolute inset-0 cursor-zoom-in"
            />
            <div className="absolute top-2 right-2 flex gap-2">
              <button type="button" onClick={() => setViewing(true)} aria-label="Expand photo" className={roundButton}>
                <Maximize2 className="w-5 h-5" aria-hidden="true" />
              </button>
              <button type="button" onClick={() => setRevealed(false)} aria-label="Blur photo again" className={roundButton}>
                <EyeOff className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
            {stamp && (
              <span className={`${chip} absolute left-2 bottom-2 pointer-events-none`}>
                <Camera className="w-3.5 h-3.5" aria-hidden="true" />
                {stamp}
              </span>
            )}
          </>
        ) : (
          <button
            type="button"
            onClick={() => setRevealed(true)}
            aria-label={graphic ? 'Show photo (graphic injury)' : 'Show photo'}
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 cursor-pointer"
          >
            <span className="w-12 h-12 rounded-full bg-black/70 text-white flex items-center justify-center">
              <Eye className="w-6 h-6" aria-hidden="true" />
            </span>
            <span className="rounded-xl bg-black/70 text-white px-4 py-2 text-center">
              <span className="block text-[14px] font-bold">{graphic ? 'Graphic injury' : 'Sensitive photo'}</span>
              <span className="block text-[12px]">Tap to view. It may show injuries.</span>
            </span>
          </button>
        )}
      </div>

      {viewing && <PhotoViewer src={photoUrl} alt={alt} stamp={stamp} onClose={() => setViewing(false)} />}
    </>
  );
}

// Full-screen view on a black ground. Rendered in the page body so the sheet's own transform
// cannot trap it, and Escape closes only the viewer (not the sheet behind it).
function PhotoViewer({ src, alt, stamp, onClose }: { src: string; alt: string; stamp: string | null; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useFocusTrap(panelRef, true);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      onClose();
    };
    // Capture phase: runs before the case sheet's own Escape handler
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return createPortal(
    <div ref={panelRef} role="dialog" aria-modal="true" aria-label="Photo viewer" className="fixed inset-0 z-[70] bg-black flex items-center justify-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="max-w-full max-h-full object-contain" />
      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        aria-label="Close photo viewer"
        className="absolute top-3 right-3 w-11 h-11 rounded-full bg-black/70 text-white border border-white/30 flex items-center justify-center cursor-pointer"
      >
        <X className="w-5 h-5" aria-hidden="true" />
      </button>
      {stamp && (
        <span className="absolute left-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom,0px))] bg-black/70 text-white text-[12px] font-bold rounded-full px-3 min-h-[28px] inline-flex items-center gap-1.5">
          <Camera className="w-3.5 h-3.5" aria-hidden="true" />
          {stamp}
        </span>
      )}
    </div>,
    document.body
  );
}
