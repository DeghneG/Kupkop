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
  RotateCcw,
} from 'lucide-react';
import { IncidentData } from './ListRow';
import { formatCoordinates } from '@/lib/sos/utils';
import { calculateClaimTimer, calculateFacilityInactivity, calculateEscalation } from '@/lib/sos/escalation';
import TriageGlyph from '@/components/icons/TriageGlyph';

interface DetailSheetProps {
  incident: IncidentData | null;
  onClose: () => void;
  mockRole: 'citizen' | 'volunteer' | 'facility' | 'admin';
  triggerElement?: HTMLElement | null;
  onClaim?: (incident: IncidentData) => Promise<void> | void;
  onReleaseClaim?: (incident: IncidentData) => Promise<void> | void;
  onAdmit?: (incident: IncidentData, facilityId?: string) => Promise<void> | void;
}

export default function DetailSheet({
  incident,
  onClose,
  mockRole,
  triggerElement,
  onClaim,
  onReleaseClaim,
  onAdmit,
}: DetailSheetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const [isPhotoRevealed, setIsPhotoRevealed] = useState(false);
  const [callNotice, setCallNotice] = useState<string | null>(null);
  const [, setTicker] = useState(0);

  // Live timer tick for active claim lock countdown
  useEffect(() => {
    if (!incident || (incident.state !== 'claimed' && incident.state !== 'reported')) return;
    const interval = setInterval(() => {
      setTicker((t) => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [incident?.id, incident?.state, incident?.claimedAt]);

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
            <TriageGlyph state="claimed" size={16} className="text-claimed-fg shrink-0" />
            <span>Claimed</span>
          </span>
        );
      case 'healing':
      case 'admitted':
        return (
          <span className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-healing-fg">
            <TriageGlyph state={incident.state} size={16} className="text-healing-fg shrink-0" />
            <span>{incident.state === 'admitted' ? 'Admitted' : 'Healing'}</span>
          </span>
        );
      case 'resolved':
        return (
          <span className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-resolved-fg">
            <TriageGlyph state="resolved" size={16} className="text-resolved-fg shrink-0" />
            <span>Resolved</span>
          </span>
        );
      case 'reported':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-reported-fg">
            <TriageGlyph state="reported" emergencyType={incident.type} size={16} className="text-reported-fg shrink-0" />
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

          {/* Progressive escalation status notice */}
          {incident.state === 'reported' && calculateEscalation(incident.createdAt, incident.type).isWidened && (
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-surface-muted border border-border text-[12px] text-fg-muted font-normal">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  calculateEscalation(incident.createdAt, incident.type).isAlert
                    ? 'bg-reported-fg'
                    : 'bg-fg-muted'
                }`}
                aria-hidden="true"
              />
              <span>
                {calculateEscalation(incident.createdAt, incident.type).isAlert
                  ? 'Urgent: No volunteer responder on scene yet. Sector broadcast widened.'
                  : 'Sector dispatch radius widened to neighboring barangays.'}
              </span>
            </div>
          )}

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
          <div className="space-y-3 pt-2">
            {/* 1. If Claimed: Render Lock Countdown Timer Card */}
            {incident.state === 'claimed' && (
              <div className="bg-claimed-bg text-claimed-fg border border-claimed-fg/20 rounded-2xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-semibold text-[14px]">
                    <TriageGlyph state="claimed" size={16} className="text-claimed-fg shrink-0" />
                    <span>Volunteer Claim Lock</span>
                  </div>
                  <span className="font-mono text-[12px] font-semibold tabular-nums">
                    {calculateClaimTimer(incident.claimedAt).isExpired
                      ? 'Lock Expired'
                      : calculateClaimTimer(incident.claimedAt).formatted}
                  </span>
                </div>
                <div className="w-full bg-claimed-fg/15 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-claimed-fg h-full transition-all duration-1000 rounded-full"
                    style={{
                      width: `${calculateClaimTimer(incident.claimedAt).percentRemaining}%`,
                    }}
                  />
                </div>
                <p className="text-[12px] text-claimed-fg/90 font-normal leading-tight">
                  {calculateClaimTimer(incident.claimedAt).isExpired
                    ? 'The 60-minute claim lock has expired. Incident is eligible for re-dispatch.'
                    : 'Rescue is locked for 60 minutes to prevent duplicate volunteer dispatches.'}
                </p>
              </div>
            )}

            {/* 2. If Admitted/Healing: Render 14-Day Inactivity Clock Card */}
            {(incident.state === 'admitted' || incident.state === 'healing') && (
              <div className="bg-healing-bg text-healing-fg border border-healing-fg/20 rounded-2xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-semibold text-[14px]">
                    <TriageGlyph state="healing" size={16} className="text-healing-fg shrink-0" />
                    <span>14-Day Facility Inactivity Clock</span>
                  </div>
                  <span className="font-mono text-[12px] font-semibold tabular-nums">
                    {calculateFacilityInactivity(incident.claimedAt).badgeText}
                  </span>
                </div>
                <p className="text-[12px] text-healing-fg/90 font-normal leading-tight">
                  Partner facilities must log progress updates within 14 days of admission.
                </p>
              </div>
            )}

            {/* 3. Action Buttons Based on Role and State */}
            <div className="space-y-2 pt-1">
              {incident.state === 'reported' ? (
                mockRole === 'citizen' ? (
                  <div className="text-center py-2 space-y-1">
                    <p className="text-[12px] text-fg-muted font-normal">
                      Field rescues can only be claimed by registered volunteers.
                    </p>
                    <button
                      type="button"
                      onClick={() => alert('Volunteer application mock: in prototype, switch your role to Volunteer in Settings.')}
                      className="text-[14px] font-semibold text-link underline cursor-pointer"
                    >
                      Become a volunteer in Settings
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <button
                      type="button"
                      onClick={() => onClaim ? onClaim(incident) : alert(`Claimed rescue ${incident.shortId}`)}
                      className="w-full min-h-[48px] bg-accent hover:opacity-90 active:scale-[0.98] text-accent-fg font-semibold text-[16px] rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer border-none"
                    >
                      <HeartHandshake className="w-5 h-5" aria-hidden="true" />
                      <span>Claim Rescue (60m Lock)</span>
                    </button>
                    <p className="text-[12px] text-fg-muted text-center font-normal">
                      Locks incident for 60 minutes to prevent duplicate volunteer dispatch.
                    </p>
                  </div>
                )
              ) : incident.state === 'claimed' ? (
                mockRole === 'volunteer' || mockRole === 'admin' ? (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => onAdmit ? onAdmit(incident) : alert(`Admitted ${incident.shortId}`)}
                      className="w-full min-h-[48px] bg-action hover:opacity-90 active:scale-[0.98] text-action-fg font-semibold text-[16px] rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer border-none"
                    >
                      <HeartPulse className="w-5 h-5" aria-hidden="true" />
                      <span>Mark as Admitted (Clinic Handoff)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onReleaseClaim ? onReleaseClaim(incident) : alert(`Released claim on ${incident.shortId}`)}
                      className="w-full min-h-[44px] rounded-xl border border-border bg-surface hover:bg-surface-muted text-fg font-semibold text-[14px] flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4 text-fg-muted" aria-hidden="true" />
                      <span>Release Claim (Cannot Attend)</span>
                    </button>
                  </div>
                ) : (
                  <div className="w-full min-h-[48px] rounded-xl bg-surface-muted border border-border flex items-center justify-center gap-2 text-[14px] text-fg-muted font-normal">
                    <TriageGlyph state="claimed" size={14} className="text-claimed-fg shrink-0" />
                    <span>Rescuer en route ({calculateClaimTimer(incident.claimedAt).remainingMinutes}m lock left)</span>
                  </div>
                )
              ) : (
                <div className="w-full min-h-[48px] rounded-xl bg-surface-muted border border-border flex items-center justify-center gap-2 text-[14px] text-fg-muted font-normal capitalize">
                  <CheckCircle2 className="w-4 h-4 text-healing-fg" aria-hidden="true" />
                  <span>Status: {incident.state}</span>
                </div>
              )}

              {/* Secondary Call button (Disabled in test mode) */}
              <button
                type="button"
                onClick={handleCallClick}
                aria-label="Call clinic (disabled in test mode)"
                className="w-full min-h-[44px] rounded-xl border border-border bg-surface hover:bg-surface-muted text-fg font-semibold text-[14px] flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Phone className="w-4 h-4 text-fg-muted" aria-hidden="true" />
                <span>Call Partner Facility</span>
              </button>
            </div>
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
              {/* GPS status badge without decorative pulse */}
              <div className="absolute top-2.5 left-2.5 pointer-events-none">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[12px] font-medium bg-surface/90 text-fg border border-border shadow-xs backdrop-blur-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
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
