'use client';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import {
  X,
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
import { calculateClaimTimer, calculateFacilityInactivity, calculateEscalation, needsRescuer, formatWaited } from '@/lib/sos/escalation';
import TriageGlyph from '@/components/icons/TriageGlyph';
import CaseRecovery from '@/components/CaseRecovery';
import { useFocusTrap } from '@/lib/useFocusTrap';
import FlagReport from '@/components/FlagReport';
import CasePhoto from '@/components/CasePhoto';
import HandoffPanel from '@/components/HandoffPanel';
import StageWeave from '@/components/StageWeave';
import { createClient } from '@/lib/supabase/client';

interface DetailSheetProps {
  incident: IncidentData | null;
  onClose: () => void;
  role: 'citizen' | 'volunteer' | 'facility' | 'admin';
  /** Signed-in user, for flagging a report */
  userId?: string | null;
  onSignIn?: () => void;
  actionError?: string | null;
  triggerElement?: HTMLElement | null;
  onClaim?: (incident: IncidentData) => Promise<void> | void;
  onReleaseClaim?: (incident: IncidentData) => Promise<void> | void;
  onAdmit?: (incident: IncidentData, facilityId?: string) => Promise<void> | void;
}

export default function DetailSheet({
  incident,
  onClose,
  role,
  userId = null,
  onSignIn,
  actionError,
  triggerElement,
  onClaim,
  onReleaseClaim,
  onAdmit,
}: DetailSheetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  useFocusTrap(sheetRef, !!incident);

  const [callNotice, setCallNotice] = useState<string | null>(null);
  // First name of the rescuer on a claimed case (public_profiles never exposes email)
  const [claimer, setClaimer] = useState<{ id: string; name: string } | null>(null);
  const claimedById = incident?.state === 'claimed' ? incident.claimedBy ?? null : null;

  useEffect(() => {
    if (!claimedById) return;
    let active = true;
    createClient()
      .from('public_profiles')
      .select('full_name')
      .eq('id', claimedById)
      .maybeSingle()
      .then(({ data }) => {
        const first = (data?.full_name ?? '').trim().split(/\s+/)[0];
        if (active) setClaimer({ id: claimedById, name: first });
      });
    return () => {
      active = false;
    };
  }, [claimedById]);
  const claimerName = claimer && claimer.id === claimedById ? claimer.name : '';
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
  // Sample cases ("case-*") have no database row to read updates from or flag
  const isLive = !!incident.id && !incident.id.startsWith('case-');
  // An expired claim is open again for other volunteers
  const open = needsRescuer(incident.state, incident.claimedAt);
  const isMine = !!userId && incident.claimedBy === userId;
  const escalation = calculateEscalation(incident.createdAt, incident.type);

  const handleCallClick = () => {
    setCallNotice('Test mode: calls disabled.');
    setTimeout(() => setCallNotice(null), 3000);
  };

  const renderStatus = () => {
    switch (incident.state) {
      case 'claimed':
        return (
          <span className="inline-flex items-center gap-2 text-[14px] font-semibold text-claimed-fg">
            <TriageGlyph state="claimed" size={16} className="text-claimed-fg shrink-0" />
            <span>Claimed</span>
          </span>
        );
      case 'healing':
      case 'admitted':
        return (
          <span className="inline-flex items-center gap-2 text-[14px] font-semibold text-healing-fg">
            <TriageGlyph state={incident.state} size={16} className="text-healing-fg shrink-0" />
            <span>{incident.state === 'admitted' ? 'Admitted' : 'Healing'}</span>
          </span>
        );
      case 'resolved':
        return (
          <span className="inline-flex items-center gap-2 text-[14px] font-semibold text-resolved-fg">
            <TriageGlyph state="resolved" size={16} className="text-resolved-fg shrink-0" />
            <span>Resolved</span>
          </span>
        );
      case 'reported':
      default:
        return (
          <span className="inline-flex items-center gap-2 text-[14px] font-semibold text-reported-fg">
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
        <div className="selvedge-thin shrink-0" aria-hidden="true" />
        {/* Drag handle / top bar */}
        <div className="relative pt-3 pb-2 flex items-center justify-end px-5">
          <div className="absolute left-1/2 top-3 -translate-x-1/2 w-10 h-1 bg-border rounded-full" aria-hidden="true" />
          <button
            ref={closeButtonRef}
            type="button"
            onClick={handleClose}
            className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-surface-muted hover:bg-border/60 text-fg-muted hover:text-fg flex items-center justify-center transition-colors cursor-pointer shrink-0"
            aria-label="Close details"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Sheet Content */}
        <div className="overflow-y-auto px-4 pb-6 space-y-4">
          {/* The evidence photo: blurred until viewed, clean once shown, expandable */}
          <CasePhoto
            key={incident.id}
            photoUrl={incident.photoUrl}
            alt={`Live camera snapshot of ${incident.animal}`}
            graphic={incident.aiGraphic}
            capturedAt={incident.createdAt}
          />

          {/* Heading Row: Name, Status & Case ID */}
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <h2 id="detail-sheet-title" className="text-[22px] font-semibold text-fg tracking-tight">
                {incident.animal}
              </h2>
              <span className="font-mono text-[12px] font-semibold text-fg-muted bg-surface-muted px-3 py-1 rounded-full border border-border tabular-nums shrink-0">
                {incident.shortId}
              </span>
            </div>

            {/* Status and triage */}
            <div className="flex items-center gap-3 pt-0.5">
              {renderStatus()}
              <span className="text-[14px] text-fg-muted font-normal">•</span>
              <span className="text-[14px] font-normal text-fg-muted">{incident.type}</span>
            </div>
            <StageWeave state={incident.state} showLabels className="pt-3" />
          </div>

          {/* Waiting notice: the escalation stage moves the case up the feed; nothing is broadcast yet */}
          {open && escalation.isWidened && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-muted border border-border text-[12px] text-fg-muted font-normal">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${escalation.isAlert ? 'bg-reported-fg' : 'bg-fg-muted'}`}
                aria-hidden="true"
              />
              <span>
                {escalation.isAlert
                  ? `No volunteer has claimed this for ${formatWaited(escalation.elapsedMinutes)}. It is shown at the top of the feed.`
                  : `Waiting ${formatWaited(escalation.elapsedMinutes)} for a rescuer. It has moved up the feed.`}
              </span>
            </div>
          )}

          {/* Location & Time details */}
          <div className="bg-surface-muted rounded-2xl p-4 space-y-2 border border-border">
            <div className="flex items-start gap-2 text-[14px] text-fg-muted">
              <MapPin className="w-4 h-4 text-fg-muted shrink-0 mt-0.5" aria-hidden="true" />
              <span className="text-fg font-normal leading-snug">{incident.location}</span>
            </div>
            <div className="flex items-center gap-3 text-[14px] text-fg-muted tabular-nums pl-6">
              {incident.distance && (
                <>
                  <span>{incident.distance} away</span>
                  <span aria-hidden="true">•</span>
                </>
              )}
              <div className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Reported {incident.timeAgo}</span>
              </div>
            </div>
          </div>

          {/* On-Scene Description & Landmark */}
          {incident.description && (
            <div className="bg-surface-muted rounded-2xl p-4 space-y-2 border border-border">
              <div className="flex items-center gap-2 text-[12px] font-semibold text-fg-muted">
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
              className="p-3 rounded-2xl bg-banner-bg text-banner-fg text-[12px] font-semibold text-center border border-border"
            >
              {callNotice}
            </div>
          )}

          {/* Actions Section */}
          <div className="space-y-3 pt-2">
            {/* 1. If Claimed: Render Lock Countdown Timer Card */}
            {incident.state === 'claimed' && (
              <div className="bg-claimed-bg text-claimed-fg border border-claimed-fg/20 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-semibold text-[14px]">
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
                    ? 'The 60-minute claim lock has run out. Any volunteer can claim this case now.'
                    : 'Rescue is locked for 60 minutes to prevent duplicate volunteer dispatches.'}
                </p>
              </div>
            )}

            {/* 2. If Admitted/Healing: Render 14-Day Inactivity Clock Card */}
            {/* 2. In clinic care or released: recovery timeline; its 14-day clock runs from the newest update */}
            {isLive && (incident.state === 'admitted' || incident.state === 'healing' || incident.state === 'resolved') && (
              <CaseRecovery
                reportId={incident.id!}
                state={incident.state}
                canPost={role === 'facility' || role === 'admin'}
              />
            )}
            {!isLive && (incident.state === 'admitted' || incident.state === 'healing') && (
              <div className="bg-healing-bg text-healing-fg border border-healing-fg/20 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-semibold text-[14px]">
                    <TriageGlyph state="healing" size={16} className="text-healing-fg shrink-0" />
                    <span>14-Day Facility Inactivity Clock</span>
                  </div>
                  <span className="font-mono text-[12px] font-semibold tabular-nums">
                    {calculateFacilityInactivity(incident.claimedAt).badgeText /* sample case: no updates */}
                  </span>
                </div>
                <p className="text-[12px] text-healing-fg/90 font-normal leading-tight">
                  Partner facilities must log progress updates within 14 days of admission.
                </p>
              </div>
            )}

            {/* 3. Action Buttons Based on Role and State */}
            <div className="space-y-2 pt-1">
              <div className="sticky bottom-0 z-10 -mx-4 px-4 pt-3 pb-3 bg-surface border-t border-border space-y-2">
              {actionError && (
                <p role="alert" className="text-[14px] font-semibold text-fg bg-surface-muted border border-border rounded-xl px-3 py-2">
                  {actionError}
                </p>
              )}
              {open && !(incident.state === 'claimed' && isMine) ? (
                role !== 'volunteer' && role !== 'admin' ? (
                  <div className="text-center py-2 space-y-1">
                    <p className="text-[12px] text-fg-muted font-normal">
                      Field rescues can only be claimed by approved volunteers.
                    </p>
                    {role === 'citizen' && (
                      <Link
                        href="/settings#volunteer"
                        className="min-h-[44px] inline-flex items-center text-[14px] font-semibold text-link underline cursor-pointer"
                      >
                        Apply to become a volunteer
                      </Link>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => onClaim?.(incident)}
                      className="w-full min-h-[48px] bg-accent hover:opacity-90 active:scale-[0.98] text-accent-fg font-semibold text-[16px] rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer border-none"
                    >
                      <HeartHandshake className="w-5 h-5" aria-hidden="true" />
                      <span>{incident.state === 'claimed' ? 'Claim this rescue (lock expired)' : 'Claim Rescue (60m Lock)'}</span>
                    </button>
                    <p className="text-[12px] text-fg-muted text-center font-normal">
                      Locks the case to you for 60 minutes so two volunteers don&apos;t go to the same animal.
                    </p>
                  </div>
                )
              ) : incident.state === 'claimed' ? (
                isMine || role === 'admin' ? (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => onAdmit?.(incident)}
                      className="w-full min-h-[48px] bg-action hover:opacity-90 active:scale-[0.98] text-action-fg font-semibold text-[16px] rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer border-none"
                    >
                      <HeartPulse className="w-5 h-5" aria-hidden="true" />
                      <span>Mark as Admitted (Clinic Handoff)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onReleaseClaim?.(incident)}
                      className="w-full min-h-[44px] rounded-xl border border-border bg-surface hover:bg-surface-muted text-fg font-semibold text-[14px] flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4 text-fg-muted" aria-hidden="true" />
                      <span>{isMine ? 'Release Claim (Cannot Attend)' : 'Release this claim (admin)'}</span>
                    </button>
                  </div>
                ) : (
                  <div className="w-full min-h-[48px] rounded-xl bg-surface-muted border border-border flex items-center justify-center gap-2 text-[14px] text-fg-muted font-normal">
                    <TriageGlyph state="claimed" size={14} className="text-claimed-fg shrink-0" />
                    <span>
                      {claimerName ? `${claimerName} is on the way` : 'A rescuer is on the way'} (
                      {calculateClaimTimer(incident.claimedAt).remainingMinutes}m lock left)
                    </span>
                  </div>
                )
              ) : (
                <div className="w-full min-h-[48px] rounded-xl bg-surface-muted border border-border flex items-center justify-center gap-2 text-[14px] text-fg-muted font-normal capitalize">
                  <CheckCircle2 className="w-4 h-4 text-healing-fg" aria-hidden="true" />
                  <span>Status: {incident.state}</span>
                </div>
              )}

              </div>

              {/* Calling a clinic only makes sense once one has the animal (disabled in test mode) */}
              {incident.facilityId && (
                <button
                  type="button"
                  onClick={handleCallClick}
                  aria-label="Call clinic (disabled in test mode)"
                  className="w-full min-h-[44px] rounded-xl border border-border bg-surface hover:bg-surface-muted text-fg font-semibold text-[14px] flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Phone className="w-4 h-4 text-fg-muted" aria-hidden="true" />
                  <span>Call the clinic</span>
                </button>
              )}

              {isLive && (
                <HandoffPanel
                  key={`handoff-${incident.id}`}
                  reportId={incident.id!}
                  userId={userId}
                  canHandOff={
                    !!userId &&
                    (incident.state === 'reported' || incident.state === 'claimed') &&
                    (incident.reporterId === userId || incident.claimedBy === userId)
                  }
                />
              )}

              {isLive && <FlagReport key={incident.id} reportId={incident.id!} userId={userId} onSignIn={onSignIn} />}
            </div>
          </div>

          {/* Live Incident Scene Map (Under Call Button) */}
          <div className="pt-2 space-y-2 border-t border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[14px] font-semibold text-fg">
                <MapPin className="w-4 h-4 text-fg-muted" aria-hidden="true" />
                <span>Reported location</span>
              </div>
              <span className="font-mono text-[12px] text-fg-muted tabular-nums">
                {formattedGps}
              </span>
            </div>

            {/* Embedded Interactive Map Card */}
            <div className="relative w-full h-48 rounded-2xl overflow-hidden border border-border bg-surface-muted shadow-sm">
              <iframe
                title={`Map of where ${incident.animal} was reported`}
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${(mapLng - 0.005).toFixed(4)}%2C${(mapLat - 0.0035).toFixed(4)}%2C${(mapLng + 0.005).toFixed(4)}%2C${(mapLat + 0.0035).toFixed(4)}&layer=mapnik&marker=${mapLat}%2C${mapLng}`}
                className="w-full h-full border-0 select-none"
                loading="lazy"
              />
            </div>

            {/* Directions Action */}
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${mapLat},${mapLng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full min-h-[44px] rounded-2xl border border-border bg-surface hover:bg-surface-muted text-fg font-semibold text-[14px] flex items-center justify-center gap-2 transition-colors cursor-pointer"
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
