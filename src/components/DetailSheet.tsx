'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import {
  X,
  Camera,
  Eye,
  EyeOff,
  AlertCircle,
  Lock,
  HeartPulse,
  CheckCircle2,
  MapPin,
  Clock,
  Phone,
  HeartHandshake,
  Navigation,
  ExternalLink,
  FileText,
} from 'lucide-react';
import { IncidentData } from './ListRow';
import { formatCoordinates } from '@/lib/sos/utils';

interface DetailSheetProps {
  incident: IncidentData | null;
  onClose: () => void;
  mockRole: 'citizen' | 'volunteer' | 'facility' | 'admin';
  triggerElement?: HTMLElement | null;
}

export default function DetailSheet({
  incident,
  onClose,
  mockRole,
  triggerElement,
}: DetailSheetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const [isPhotoRevealed, setIsPhotoRevealed] = useState(false);
  const [callNotice, setCallNotice] = useState<string | null>(null);

  // Reset photo reveal and notice when incident changes (render-phase adjustment without cascading effect)
  const [prevIncidentId, setPrevIncidentId] = useState(incident?.id);
  if (incident?.id !== prevIncidentId) {
    setPrevIncidentId(incident?.id);
    setIsPhotoRevealed(false);
    setCallNotice(null);
  }

  // Animate out and return focus to trigger element
  const handleClose = useCallback(() => {
    if (!sheetRef.current || !backdropRef.current) {
      onClose();
      triggerElement?.focus();
      return;
    }

    const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (isReduced) {
      onClose();
      triggerElement?.focus();
      return;
    }

    gsap.to(backdropRef.current, {
      opacity: 0,
      duration: 0.2,
      ease: 'power2.in',
    });

    gsap.to(sheetRef.current, {
      y: '100%',
      duration: 0.25,
      ease: 'power3.in',
      onComplete: () => {
        onClose();
        triggerElement?.focus();
      },
    });
  }, [onClose, triggerElement]);

  // Handle escape key
  useEffect(() => {
    if (!incident) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [incident, handleClose]);

  // Animate in using GSAP with prefers-reduced-motion check
  useGSAP(
    () => {
      if (!incident || !sheetRef.current || !backdropRef.current) return;

      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: reduce)', () => {
        gsap.set(backdropRef.current, { opacity: 1 });
        gsap.set(sheetRef.current, { y: '0%', opacity: 1 });
      });

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.fromTo(
          backdropRef.current,
          { opacity: 0 },
          { opacity: 1, duration: 0.25, ease: 'power2.out' }
        );
        gsap.fromTo(
          sheetRef.current,
          { y: '100%' },
          { y: '0%', duration: 0.35, ease: 'power3.out' }
        );
      });

      // Move focus into the sheet
      closeButtonRef.current?.focus();

      return () => mm.revert();
    },
    { dependencies: [incident], scope: containerRef }
  );

  if (!incident) return null;

  const mapLat = incident.latitude ?? 14.6198;
  const mapLng = incident.longitude ?? 121.0526;
  const formattedGps = formatCoordinates(mapLat, mapLng);

  const handleCallClick = () => {
    setCallNotice('Test mode: calls disabled.');
    setTimeout(() => setCallNotice(null), 3000);
  };

  const renderStatus = () => {
    switch (incident.state) {
      case 'claimed':
        return (
          <span className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-claimed-fg">
            <Lock className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Claimed</span>
          </span>
        );
      case 'healing':
      case 'admitted':
        return (
          <span className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-healing-fg">
            <HeartPulse className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{incident.state === 'admitted' ? 'Admitted' : 'Healing'}</span>
          </span>
        );
      case 'resolved':
        return (
          <span className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-resolved-fg">
            <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Resolved</span>
          </span>
        );
      case 'reported':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-reported-fg">
            <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Reported</span>
          </span>
        );
    }
  };

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="detail-sheet-title"
      className="fixed inset-0 z-50 flex items-end justify-center"
    >
      {/* Dimmed backdrop */}
      <div
        ref={backdropRef}
        onClick={handleClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm cursor-pointer"
        aria-hidden="true"
      />

      {/* Bottom Sheet */}
      <div
        ref={sheetRef}
        className="relative z-10 w-full max-w-md bg-surface border-t border-border rounded-t-[24px] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col pb-[env(safe-area-inset-bottom,20px)]"
      >
        {/* Drag handle / top bar */}
        <div className="pt-3 pb-2 flex items-center justify-between px-5">
          <div className="w-10 h-1 bg-border rounded-full mx-auto -mr-1" aria-hidden="true" />
          <button
            ref={closeButtonRef}
            type="button"
            onClick={handleClose}
            className="w-10 h-10 min-w-[40px] min-h-[40px] rounded-full bg-surface-muted hover:bg-border/60 text-fg-muted hover:text-fg flex items-center justify-center transition-colors cursor-pointer shrink-0"
            aria-label="Close details"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Sheet Content */}
        <div className="overflow-y-auto px-5 pb-6 space-y-4">
          {/* Large Photo with Reveal Toggle */}
          <div className="relative w-full h-52 rounded-[18px] overflow-hidden bg-surface-muted border border-border flex items-center justify-center">
            {incident.photoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={incident.photoUrl}
                alt={`Live camera snapshot of ${incident.animal}`}
                className={`w-full h-full object-cover transition-all duration-300 ${
                  isPhotoRevealed ? 'blur-0' : 'blur-md scale-105'
                }`}
              />
            ) : (
              <div
                className={`w-full h-full flex flex-col items-center justify-center transition-all duration-300 ${
                  isPhotoRevealed ? 'blur-0' : 'blur-md scale-105'
                }`}
              >
                <Camera className="w-12 h-12 text-fg-muted" aria-hidden="true" />
                <span className="text-[12px] text-fg-muted font-normal mt-1">Live camera snapshot</span>
              </div>
            )}

            {/* Tap to Reveal / Re-blur button */}
            <button
              type="button"
              onClick={() => setIsPhotoRevealed(!isPhotoRevealed)}
              className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 hover:bg-black/40 text-white font-semibold text-[14px] gap-2 transition-colors cursor-pointer"
              aria-label={isPhotoRevealed ? 'Blur photo' : 'Reveal photo'}
            >
              {isPhotoRevealed ? (
                <>
                  <EyeOff className="w-5 h-5 drop-shadow" aria-hidden="true" />
                  <span className="drop-shadow">Tap to blur</span>
                </>
              ) : (
                <>
                  <Eye className="w-5 h-5 drop-shadow" aria-hidden="true" />
                  <span className="drop-shadow">Tap to reveal</span>
                </>
              )}
            </button>
          </div>

          {/* Heading Row: Name, Status & Case ID */}
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <h2 id="detail-sheet-title" className="text-[22px] font-semibold text-fg tracking-tight">
                {incident.animal}
              </h2>
              <span className="font-mono text-[12px] font-semibold text-fg-muted bg-surface-muted px-2.5 py-1 rounded-full border border-border tabular-nums shrink-0">
                {incident.shortId}
              </span>
            </div>

            {/* Status and triage */}
            <div className="flex items-center gap-3 pt-0.5">
              {renderStatus()}
              <span className="text-[14px] text-fg-muted font-normal">•</span>
              <span className="text-[14px] font-normal text-fg-muted">{incident.type}</span>
            </div>
          </div>

          {/* Location & Time details */}
          <div className="bg-surface-muted rounded-[16px] p-3.5 space-y-2 border border-border">
            <div className="flex items-start gap-2 text-[14px] text-fg-muted">
              <MapPin className="w-4 h-4 text-fg-muted shrink-0 mt-0.5" aria-hidden="true" />
              <span className="text-fg font-normal leading-snug">{incident.location}</span>
            </div>
            <div className="flex items-center gap-3 text-[14px] text-fg-muted tabular-nums pl-6">
              <span>{incident.distance} away</span>
              <span>•</span>
              <div className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Reported {incident.timeAgo}</span>
              </div>
            </div>
          </div>

          {/* On-Scene Description & Landmark */}
          {incident.description && (
            <div className="bg-surface-muted rounded-[16px] p-3.5 space-y-1.5 border border-border">
              <div className="flex items-center gap-1.5 text-[12px] font-semibold text-fg-muted uppercase tracking-wider">
                <FileText className="w-3.5 h-3.5 text-fg-muted shrink-0" aria-hidden="true" />
                <span>Scene Details & Landmark</span>
              </div>
              <p className="text-[14px] text-fg font-normal leading-relaxed pl-5">
                {incident.description}
              </p>
            </div>
          )}

          {/* Disabled Notice Toast */}
          {callNotice && (
            <div
              role="alert"
              className="p-3 rounded-[14px] bg-banner-bg text-banner-fg text-[12px] font-semibold text-center border border-border"
            >
              {callNotice}
            </div>
          )}

          {/* Actions Section */}
          <div className="space-y-2.5 pt-2">
            {incident.state === 'reported' ? (
              mockRole === 'citizen' ? (
                <div className="text-center py-2">
                  <button
                    type="button"
                    onClick={() => alert('Volunteer application mock: in prototype, request admin approval in Settings.')}
                    className="text-[14px] font-semibold text-link underline cursor-pointer"
                  >
                    Become a volunteer to claim
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => alert(`Mock: Claimed rescue ${incident.shortId}.`)}
                  className="w-full min-h-[48px] bg-accent hover:opacity-90 active:scale-[0.98] text-accent-fg font-semibold text-[16px] rounded-[14px] flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer border-none"
                >
                  <HeartHandshake className="w-5 h-5" aria-hidden="true" />
                  <span>Claim Rescue</span>
                </button>
              )
            ) : incident.state === 'claimed' ? (
              <div className="w-full min-h-[48px] rounded-[14px] bg-surface-muted border border-border flex items-center justify-center gap-2 text-[14px] text-fg-muted font-normal">
                <Lock className="w-4 h-4 text-claimed-fg" aria-hidden="true" />
                <span>Claimed by a volunteer</span>
              </div>
            ) : (
              <div className="w-full min-h-[48px] rounded-[14px] bg-surface-muted border border-border flex items-center justify-center gap-2 text-[14px] text-fg-muted font-normal capitalize">
                <CheckCircle2 className="w-4 h-4 text-healing-fg" aria-hidden="true" />
                <span>Rescue status: {incident.state}</span>
              </div>
            )}

            {/* Secondary Call button (Disabled in test mode) */}
            <button
              type="button"
              onClick={handleCallClick}
              aria-label="Call clinic (disabled in test mode)"
              className="w-full min-h-[44px] rounded-[14px] border border-border bg-surface hover:bg-surface-muted text-fg font-semibold text-[14px] flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Phone className="w-4 h-4 text-fg-muted" aria-hidden="true" />
              <span>Call</span>
            </button>
          </div>

          {/* Live Incident Scene Map (Under Call Button) */}
          <div className="pt-2 space-y-2 border-t border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[14px] font-semibold text-fg">
                <MapPin className="w-4 h-4 text-fg-muted" aria-hidden="true" />
                <span>Live Scene Location</span>
              </div>
              <span className="font-mono text-[12px] text-fg-muted tabular-nums">
                {formattedGps}
              </span>
            </div>

            {/* Embedded Interactive Map Card */}
            <div className="relative w-full h-48 rounded-[16px] overflow-hidden border border-border bg-surface-muted shadow-sm">
              <iframe
                title={`Live location map for ${incident.animal}`}
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${(mapLng - 0.005).toFixed(4)}%2C${(mapLat - 0.0035).toFixed(4)}%2C${(mapLng + 0.005).toFixed(4)}%2C${(mapLat + 0.0035).toFixed(4)}&layer=mapnik&marker=${mapLat}%2C${mapLng}`}
                className="w-full h-full border-0 select-none"
                loading="lazy"
              />
              {/* GPS status badge */}
              <div className="absolute top-2.5 left-2.5 pointer-events-none">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[12px] font-medium bg-surface/90 text-fg border border-border shadow-xs backdrop-blur-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
                  <span>GPS Active</span>
                </span>
              </div>
            </div>

            {/* Directions Action */}
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${mapLat},${mapLng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full min-h-[44px] rounded-[14px] border border-border bg-surface hover:bg-surface-muted text-fg font-semibold text-[14px] flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Navigation className="w-4 h-4 text-fg-muted" aria-hidden="true" />
              <span>Open in Google Maps / Directions</span>
              <ExternalLink className="w-3.5 h-3.5 text-fg-muted" aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
