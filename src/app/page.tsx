'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  Camera,
  MapPin,
  Clock,
  Phone,
  Lock,
  ChevronRight,
  Eye,
  EyeOff,
  Sparkles,
  Building2,
  HeartHandshake,
  Shield,
  Activity,
  Footprints,
  AlertTriangle
} from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';
import type { CaseState, EmergencyUrgency } from '@/types/database';

interface MockEmergency {
  id: string;
  shortId: string;
  animal: string;
  type: string;
  urgency: EmergencyUrgency;
  state: CaseState;
  location: string;
  distance: string;
  timeAgo: string;
  claimedBy?: string;
  blurred: boolean;
}

const initialEmergencies: MockEmergency[] = [
  {
    id: 'case-1',
    shortId: 'KK-4821',
    animal: 'Aspin Dog',
    type: 'Hit-and-run / Bleeding',
    urgency: 'critical',
    state: 'reported',
    location: 'Aurora Blvd',
    distance: '0.8 km',
    timeAgo: '4m ago',
    blurred: true,
  },
  {
    id: 'case-2',
    shortId: 'KK-4822',
    animal: 'Puspin Kitten',
    type: 'Trapped in drain',
    urgency: 'urgent',
    state: 'claimed',
    location: 'E. Rodriguez Sr. Ave',
    distance: '1.4 km',
    timeAgo: '18m ago',
    claimedBy: 'a volunteer',
    blurred: false,
  },
];

export default function HomePage() {
  const [emergencies, setEmergencies] = useState<MockEmergency[]>(initialEmergencies);
  
  /**
   * DEV ONLY (mock role selector)
   * Note: This dropdown is for local prototype testing only.
   * MUST be removed before real Supabase authentication & RLS policies go live.
   * Does NOT connect to any real auth/role system.
   */
  const [mockRole, setMockRole] = useState<'citizen' | 'volunteer' | 'facility' | 'admin'>('citizen');
  const [notification, setNotification] = useState<string | null>(null);

  const showDisabledCallNotice = () => {
    setNotification('Test mode: calls disabled.');
    setTimeout(() => setNotification(null), 3000);
  };

  const toggleBlur = (id: string) => {
    setEmergencies((prev) =>
      prev.map((e) => (e.id === id ? { ...e, blurred: !e.blurred } : e))
    );
  };

  return (
    <div className="flex flex-col flex-1 px-4 py-4 space-y-6">
      {/* Test Notice Toast */}
      {notification && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-12 left-1/2 -translate-x-1/2 z-50 bg-fg text-surface px-4 py-2 rounded-xl text-xs font-semibold shadow-md border border-border"
        >
          {notification}
        </div>
      )}

      {/* Header with App Brand, DEV ONLY Role Selector, and 44px Theme Toggle */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-accent text-accent-fg flex items-center justify-center font-semibold text-base shadow-sm">
            K
          </div>
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight leading-none text-fg">
              KupKop
            </h1>
            <p className="text-[12px] text-fg-muted font-normal mt-0.5">
              Street Animal Emergency
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* DEV ONLY (mock role) selector */}
          <div className="flex flex-col items-end">
            <label htmlFor="mock-role-select" className="text-[12px] text-fg-muted font-normal">
              DEV ONLY (mock role)
            </label>
            <select
              id="mock-role-select"
              value={mockRole}
              onChange={(e) => setMockRole(e.target.value as any)}
              className="text-[12px] font-semibold bg-surface-muted text-fg border border-border rounded-xl px-2 py-1 outline-none focus:ring-2 focus:ring-accent cursor-pointer"
            >
              <option value="citizen">Citizen</option>
              <option value="volunteer">Volunteer</option>
              <option value="facility">Facility</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <ThemeToggle />
        </div>
      </header>

      {/* Location Bar: honest "Location not set", no fake GPS claims */}
      <div className="flex items-center justify-between bg-surface-muted border border-border rounded-2xl px-4 py-2 text-[12px]">
        <div className="flex items-center gap-2 text-fg-muted">
          <MapPin className="w-4 h-4 text-fg-muted shrink-0" aria-hidden="true" />
          <span className="font-normal">Location not set</span>
        </div>
        <span className="text-[12px] font-normal text-fg-muted">
          Waiting for capture
        </span>
      </div>

      {/* SOS Hero: ~120px tall, clean, headline + 48px report button + plain line */}
      <section
        aria-labelledby="sos-heading"
        className="rounded-2xl border border-border bg-surface-card p-4 space-y-2 shadow-sm"
      >
        <h2 id="sos-heading" className="text-[16px] font-semibold text-fg">
          Found an injured street animal?
        </h2>

        <Link
          href="/sos"
          id="hero-sos-trigger-button"
          className="w-full min-h-[48px] bg-accent hover:opacity-95 active:scale-[0.99] text-accent-fg font-semibold text-[16px] rounded-xl flex items-center justify-center gap-2 transition-transform shadow-sm focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <Camera className="w-5 h-5 text-accent-fg" aria-hidden="true" />
          <span>Report Emergency</span>
        </Link>

        <p className="text-[12px] text-fg-muted font-normal pt-1">
          Take a live photo. We add your location and time automatically.
        </p>
      </section>

      {/* Rafa: One collapsed row with triage chips */}
      <section
        aria-label="Rafa First-Aid Guidance"
        className="rounded-2xl border border-border bg-surface-card p-4 space-y-3 shadow-sm"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" aria-hidden="true" />
            <h2 className="text-[14px] font-semibold text-fg">
              Rafa first-aid helper
            </h2>
          </div>
          <Link
            href="/rafa"
            className="text-[12px] font-semibold text-fg-muted hover:text-fg flex items-center gap-0.5"
          >
            <span>Ask Rafa</span>
            <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </div>

        {/* Triage chips: Bleeding, Scared/Aggressive Dog, Moving Safely */}
        <div className="flex gap-2 overflow-x-auto pb-1 text-[12px]">
          <Link
            href="/rafa?q=bleeding"
            className="shrink-0 rounded-full border border-border bg-surface-muted px-3 py-1 text-[12px] font-normal text-fg hover:bg-surface transition-colors"
          >
            Bleeding
          </Link>
          <Link
            href="/rafa?q=scared-dog"
            className="shrink-0 rounded-full border border-border bg-surface-muted px-3 py-1 text-[12px] font-normal text-fg hover:bg-surface transition-colors"
          >
            Scared / aggressive dog
          </Link>
          <Link
            href="/rafa?q=moving-safely"
            className="shrink-0 rounded-full border border-border bg-surface-muted px-3 py-1 text-[12px] font-normal text-fg hover:bg-surface transition-colors"
          >
            Moving safely
          </Link>
        </div>
      </section>

      {/* Active Incidents Feed */}
      <section aria-labelledby="feed-heading" className="space-y-3">
        <h2 id="feed-heading" className="text-[16px] font-semibold text-fg">
          Active incidents
        </h2>

        <div className="space-y-3">
          {emergencies.map((incident) => {
            const isClaimed = incident.state === 'claimed';

            return (
              <article
                key={incident.id}
                className="bg-surface-card border border-border rounded-2xl p-4 shadow-sm space-y-3"
              >
                {/* Top Row: Case ID, Neutral Outlined Triage Tag, Status Pill */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-[12px] px-2 py-0.5 rounded-full bg-surface-muted text-fg border border-border">
                      {incident.shortId}
                    </span>
                    {/* Neutral outlined triage tag with SVG icon */}
                    <span className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-0.5 text-[12px] font-normal text-fg">
                      <Activity className="w-3 h-3 text-fg-muted" aria-hidden="true" />
                      <span>{incident.type}</span>
                    </span>
                  </div>

                  {/* Status Pill: Tinted background + readable text + icon */}
                  {isClaimed ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[12px] font-semibold bg-status-claimed-bg text-status-claimed-fg">
                      <Lock className="w-3 h-3" aria-hidden="true" />
                      <span>Claimed</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[12px] font-semibold bg-status-reported-bg text-status-reported-fg">
                      <AlertCircle className="w-3 h-3" aria-hidden="true" />
                      <span>Reported</span>
                    </span>
                  )}
                </div>

                {/* Middle Row: ~80px Thumbnail + Location & Animal Details */}
                <div className="flex gap-3 items-center">
                  {/* ~80px blurred thumbnail with tap to reveal */}
                  <div className="relative w-20 h-20 shrink-0 rounded-xl overflow-hidden bg-surface-muted border border-border flex items-center justify-center">
                    <div
                      className={`w-full h-full bg-surface-muted flex flex-col items-center justify-center transition-all ${
                        incident.blurred ? 'blur-md' : 'blur-0'
                      }`}
                    >
                      <Camera className="w-6 h-6 text-fg-muted" aria-hidden="true" />
                      <span className="text-[12px] text-fg-muted font-normal mt-1">Photo</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleBlur(incident.id)}
                      className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 hover:bg-black/40 text-white focus:outline-none"
                      aria-label={incident.blurred ? 'Reveal photo' : 'Blur photo'}
                    >
                      {incident.blurred ? (
                        <Eye className="w-4 h-4 text-white" aria-hidden="true" />
                      ) : (
                        <EyeOff className="w-4 h-4 text-white" aria-hidden="true" />
                      )}
                    </button>
                  </div>

                  {/* Incident Information */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-[14px] font-semibold text-fg truncate">
                      {incident.animal}
                    </p>
                    <div className="flex items-center gap-1 text-[12px] text-fg-muted truncate">
                      <MapPin className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span className="truncate">{incident.location}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[12px] text-fg-muted">
                      <span>{incident.distance}</span>
                      <span>•</span>
                      <div className="flex items-center gap-0.5">
                        <Clock className="w-3 h-3 shrink-0" aria-hidden="true" />
                        <span>{incident.timeAgo}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Action Row */}
                <div className="pt-2 border-t border-border flex items-center justify-between gap-2">
                  {isClaimed ? (
                    <div className="flex-1 flex items-center gap-1.5 text-[12px] font-normal text-fg-muted">
                      <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Claimed by a volunteer</span>
                    </div>
                  ) : (
                    <>
                      {/* Primary Claim Action or Citizen prompt */}
                      {mockRole === 'citizen' ? (
                        <div className="flex-1 text-[12px] text-fg-muted font-normal">
                          <span className="text-fg-muted">Citizen view: </span>
                          <button
                            type="button"
                            onClick={() => alert('Volunteer application mock: in prototype, request admin role approval.')}
                            className="font-semibold text-fg underline hover:text-accent-text"
                          >
                            Become a volunteer to claim
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => alert(`Mock: Claimed incident ${incident.shortId}.`)}
                          className="flex-1 min-h-[48px] bg-accent text-accent-fg hover:opacity-95 font-semibold text-[14px] rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-opacity focus:outline-none focus:ring-2 focus:ring-accent"
                        >
                          <HeartHandshake className="w-4 h-4" aria-hidden="true" />
                          <span>Claim Rescue</span>
                        </button>
                      )}

                      {/* Secondary Call Action: In TEST MODE calls must not dial */}
                      <button
                        type="button"
                        onClick={showDisabledCallNotice}
                        aria-label="Call clinic (disabled in test mode)"
                        className="min-h-[40px] px-3.5 rounded-xl border border-border bg-surface-card hover:bg-surface-muted text-fg font-semibold text-[12px] flex items-center gap-1.5 transition-colors"
                      >
                        <Phone className="w-3.5 h-3.5 text-fg-muted" aria-hidden="true" />
                        <span>Call</span>
                      </button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Facilities Preview */}
      <section aria-labelledby="facilities-heading" className="space-y-3">
        <h2 id="facilities-heading" className="text-[16px] font-semibold text-fg">
          Partner clinics
        </h2>

        <div className="space-y-3">
          {[
            { id: 'f1', name: 'Test Clinic A', dist: '1.1 km', active: 'Active 2h ago' },
            { id: 'f2', name: 'Test Clinic B', dist: '2.4 km', active: 'Active 1d ago' },
          ].map((fac) => (
            <article
              key={fac.id}
              className="bg-surface-card border border-border rounded-2xl p-4 shadow-sm flex items-center justify-between gap-2"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-[14px] font-semibold text-fg">{fac.name}</h3>
                  <span className="rounded-full bg-surface-muted border border-border px-2 py-0.5 text-[12px] font-normal text-fg-muted">
                    Listed Facility
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[12px] text-fg-muted">
                  <span>{fac.dist}</span>
                  <span>•</span>
                  <span>{fac.active}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={showDisabledCallNotice}
                aria-label={`Call ${fac.name} (disabled in test mode)`}
                className="min-h-[40px] px-3 rounded-xl border border-border bg-surface-card hover:bg-surface-muted text-fg font-semibold text-[12px] flex items-center gap-1.5 transition-colors"
              >
                <Phone className="w-3.5 h-3.5 text-fg-muted" aria-hidden="true" />
                <span>Call</span>
              </button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
