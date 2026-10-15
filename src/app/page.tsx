'use client';

import React, { useState, useEffect } from 'react';
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
  Activity
} from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';
import AuthModal from '@/components/AuthModal';
import { createClient } from '@/lib/supabase/client';
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
  const [user, setUser] = useState<any>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  
  /**
   * DEV ONLY (mock role selector)
   * Note: This dropdown is for local prototype testing only.
   * MUST be removed before real Supabase authentication & RLS policies go live.
   * Does NOT connect to any real auth/role system.
   */
  const [mockRole, setMockRole] = useState<'citizen' | 'volunteer' | 'facility' | 'admin'>('citizen');
  const [notification, setNotification] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

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
    <div className="flex flex-col flex-1 px-4 py-4 space-y-5">
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />

      {/* Test Notice Toast */}
      {notification && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-12 left-1/2 -translate-x-1/2 z-50 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 px-4 py-2 rounded-xl text-xs font-semibold shadow-lg border border-zinc-700"
        >
          {notification}
        </div>
      )}

      {/* Main Header */}
      <header className="flex items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#ff453a] text-white flex items-center justify-center font-bold text-lg shadow-sm shrink-0 font-brand">
            K
          </div>
          <div>
            <h1 className="text-[23px] font-bold tracking-tight leading-none text-[#0b132b] dark:text-white font-brand">
              KupKop
            </h1>
            <p className="text-[12px] text-[#5a6b85] dark:text-[#8e9bb0] font-normal mt-0.5">
              Street Animal Emergency
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Sign In / User Status */}
          {user ? (
            <div className="flex items-center gap-2 bg-[#e2eaf4] dark:bg-[#162138] px-3 py-1.5 rounded-xl border border-[#ccd7e8] dark:border-[#223152]">
              <span className="text-[12px] font-semibold text-[#0b132b] dark:text-white truncate max-w-[85px]">
                {user.email?.split('@')[0]}
              </span>
              <button
                type="button"
                onClick={handleSignOut}
                className="text-[12px] font-semibold text-[#5a6b85] dark:text-[#8e9bb0] hover:text-[#0b132b] dark:hover:text-white underline cursor-pointer"
              >
                Sign out
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsAuthOpen(true)}
              className="whitespace-nowrap min-h-[40px] px-3.5 rounded-xl border border-[#ccd7e8] dark:border-[#223152] bg-white dark:bg-[#162138] hover:bg-[#f0f4fa] dark:hover:bg-[#1e2d4d] text-[#0b132b] dark:text-white font-semibold text-[12px] shadow-[0_1px_2px_rgba(0,0,0,0.04)] active:scale-95 transition-all cursor-pointer shrink-0"
            >
              Sign In
            </button>
          )}

          <ThemeToggle />
        </div>
      </header>

      {/* Secondary Utility Row: Apple Weather Segmented Capsule */}
      <div className="flex items-center justify-between gap-2 bg-[#e2eaf4] dark:bg-[#162138] border border-[#ccd7e8] dark:border-[#223152] rounded-2xl px-3.5 py-2 text-[12px]">
        <div className="flex items-center gap-1.5 text-[#2c3a58] dark:text-[#cdd7e5] truncate">
          <MapPin className="w-4 h-4 text-[#5a6b85] dark:text-[#8e9bb0] shrink-0" aria-hidden="true" />
          <span className="font-normal truncate">Location not set</span>
        </div>

        {/* DEV ONLY mock role dropdown */}
        <div className="flex items-center gap-1.5 shrink-0">
          <label htmlFor="mock-role-select" className="text-[11px] text-[#5a6b85] dark:text-[#8e9bb0] font-normal">
            DEV:
          </label>
          <select
            id="mock-role-select"
            value={mockRole}
            onChange={(e) => setMockRole(e.target.value as any)}
            className="text-[11px] font-semibold bg-white dark:bg-[#1e2d4d] text-[#0b132b] dark:text-white border border-[#ccd7e8] dark:border-[#2a3c63] rounded-lg px-2 py-0.5 outline-none focus:ring-1 focus:ring-[#ff453a] cursor-pointer"
          >
            <option value="citizen">Citizen</option>
            <option value="volunteer">Volunteer</option>
            <option value="facility">Facility</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>

      {/* SOS Hero: Apple Weather Alert Card */}
      <section
        aria-labelledby="sos-heading"
        className="rounded-2xl border border-[#ccd7e8] dark:border-[#223152] bg-white dark:bg-[#162138] p-4 space-y-2.5 shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-none"
      >
        <h2 id="sos-heading" className="text-[16px] font-semibold tracking-[-0.015em] text-[#0b132b] dark:text-white">
          Found an injured street animal?
        </h2>

        {/* Apple Weather Severe Alert Red Button */}
        <Link
          href="/sos"
          id="hero-sos-trigger-button"
          className="w-full min-h-[48px] bg-[#ff453a] hover:bg-[#e03b31] active:scale-[0.98] text-white font-semibold text-[16px] rounded-xl flex items-center justify-center gap-2 shadow-sm transition-transform border-none focus:outline-none focus:ring-2 focus:ring-[#ff453a]"
        >
          <Camera className="w-5 h-5 text-white" aria-hidden="true" />
          <span>Report Emergency</span>
        </Link>

        <p className="text-[12px] text-[#5a6b85] dark:text-[#8e9bb0] font-normal pt-0.5">
          Take a live photo. We add your location and time automatically.
        </p>
      </section>

      {/* Rafa: Apple Inset Grouped Card with Triage Chips */}
      <section
        aria-label="Rafa First-Aid Guidance"
        className="rounded-2xl border border-[#ccd7e8] dark:border-[#223152] bg-white dark:bg-[#162138] p-4 space-y-3 shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-none"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#30b0c7] dark:text-[#40c8e0] shrink-0" aria-hidden="true" />
            <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-[#0b132b] dark:text-white">
              Rafa first-aid helper
            </h2>
          </div>
          <Link
            href="/rafa"
            className="text-[12px] font-semibold text-[#30b0c7] dark:text-[#40c8e0] hover:underline flex items-center gap-0.5"
          >
            <span>Ask Rafa</span>
            <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </div>

        {/* Triage chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 text-[12px]">
          <Link
            href="/rafa?q=bleeding"
            className="shrink-0 rounded-full border border-[#ccd7e8] dark:border-[#223152] bg-[#f0f4fa] dark:bg-[#1e2d4d] hover:bg-[#e2eaf4] dark:hover:bg-[#25375c] px-3 py-1 text-[12px] font-normal text-[#2c3a58] dark:text-[#cdd7e5] transition-colors"
          >
            Bleeding
          </Link>
          <Link
            href="/rafa?q=scared-dog"
            className="shrink-0 rounded-full border border-[#ccd7e8] dark:border-[#223152] bg-[#f0f4fa] dark:bg-[#1e2d4d] hover:bg-[#e2eaf4] dark:hover:bg-[#25375c] px-3 py-1 text-[12px] font-normal text-[#2c3a58] dark:text-[#cdd7e5] transition-colors"
          >
            Scared / aggressive dog
          </Link>
          <Link
            href="/rafa?q=moving-safely"
            className="shrink-0 rounded-full border border-[#ccd7e8] dark:border-[#223152] bg-[#f0f4fa] dark:bg-[#1e2d4d] hover:bg-[#e2eaf4] dark:hover:bg-[#25375c] px-3 py-1 text-[12px] font-normal text-[#2c3a58] dark:text-[#cdd7e5] transition-colors"
          >
            Moving safely
          </Link>
        </div>
      </section>

      {/* Active Incidents Feed */}
      <section aria-labelledby="feed-heading" className="space-y-3">
        <h2 id="feed-heading" className="text-[16px] font-semibold text-[#0b132b] dark:text-white">
          Active incidents
        </h2>

        <div className="space-y-3">
          {emergencies.map((incident) => {
            const isClaimed = incident.state === 'claimed';

            return (
              <article
                key={incident.id}
                className="bg-white dark:bg-[#162138] border border-[#ccd7e8] dark:border-[#223152] rounded-2xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-none space-y-3"
              >
                {/* Top Row: Case ID, Neutral Outlined Triage Tag, Colored Status Pill */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-[12px] tabular-nums px-2.5 py-0.5 rounded-full bg-[#f0f4fa] dark:bg-[#1e2d4d] text-[#0b132b] dark:text-white border border-[#ccd7e8] dark:border-[#2a3c63]">
                      {incident.shortId}
                    </span>
                    {/* Neutral outlined triage tag with SVG icon */}
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#ccd7e8] dark:border-[#2a3c63] bg-[#f0f4fa] dark:bg-[#1e2d4d] px-2.5 py-0.5 text-[12px] font-normal text-[#2c3a58] dark:text-[#cdd7e5]">
                      <Activity className="w-3 h-3 text-[#5a6b85] dark:text-[#8e9bb0]" aria-hidden="true" />
                      <span>{incident.type}</span>
                    </span>
                  </div>

                  {/* Status Pill: Tinted background + readable text + icon */}
                  {isClaimed ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[12px] font-semibold bg-[#fef3c7] dark:bg-[#2b1b06] text-[#d97706] dark:text-[#ff9f0a] border border-[#fcd34d] dark:border-[#523408]">
                      <Lock className="w-3 h-3" aria-hidden="true" />
                      <span>Claimed</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[12px] font-semibold bg-[#fee2e2] dark:bg-[#2e1215] text-[#dc2626] dark:text-[#ff453a] border border-[#fca5a5] dark:border-[#54191e]">
                      <AlertCircle className="w-3 h-3" aria-hidden="true" />
                      <span>Reported</span>
                    </span>
                  )}
                </div>

                {/* Middle Row: ~80px Thumbnail + Location & Animal Details */}
                <div className="flex gap-3 items-center">
                  {/* ~80px blurred thumbnail with tap to reveal */}
                  <div className="relative w-20 h-20 shrink-0 rounded-xl overflow-hidden bg-[#f0f4fa] dark:bg-[#1e2d4d] border border-[#ccd7e8] dark:border-[#2a3c63] flex items-center justify-center">
                    <div
                      className={`w-full h-full bg-[#f0f4fa] dark:bg-[#1e2d4d] flex flex-col items-center justify-center transition-all ${
                        incident.blurred ? 'blur-md' : 'blur-0'
                      }`}
                    >
                      <Camera className="w-6 h-6 text-[#5a6b85] dark:text-[#8e9bb0]" aria-hidden="true" />
                      <span className="text-[11px] text-[#5a6b85] dark:text-[#8e9bb0] font-normal mt-1">Photo</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleBlur(incident.id)}
                      className="absolute inset-0 z-10 flex items-center justify-center bg-black/25 hover:bg-black/35 text-white focus:outline-none cursor-pointer"
                      aria-label={incident.blurred ? 'Reveal photo' : 'Blur photo'}
                    >
                      {incident.blurred ? (
                        <Eye className="w-4 h-4 text-white drop-shadow" aria-hidden="true" />
                      ) : (
                        <EyeOff className="w-4 h-4 text-white drop-shadow" aria-hidden="true" />
                      )}
                    </button>
                  </div>

                  {/* Incident Information */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-[14px] font-semibold text-[#0b132b] dark:text-white truncate">
                      {incident.animal}
                    </p>
                    <div className="flex items-center gap-1 text-[12px] text-[#5a6b85] dark:text-[#8e9bb0] truncate">
                      <MapPin className="w-3.5 h-3.5 shrink-0 text-[#5a6b85] dark:text-[#8e9bb0]" aria-hidden="true" />
                      <span className="truncate">{incident.location}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[12px] text-[#5a6b85] dark:text-[#8e9bb0] tabular-nums">
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
                <div className="pt-2 border-t border-[#ccd7e8] dark:border-[#223152] flex items-center justify-between gap-2">
                  {isClaimed ? (
                    <div className="flex-1 flex items-center gap-1.5 text-[12px] font-normal text-[#5a6b85] dark:text-[#8e9bb0]">
                      <Lock className="w-3.5 h-3.5 text-[#ff9500] dark:text-[#ff9f0a]" aria-hidden="true" />
                      <span>Claimed by a volunteer</span>
                    </div>
                  ) : (
                    <>
                      {/* Primary Claim Action or Citizen prompt */}
                      {mockRole === 'citizen' ? (
                        <div className="flex-1 text-[12px] text-[#5a6b85] dark:text-[#8e9bb0] font-normal">
                          <span>Citizen view: </span>
                          <button
                            type="button"
                            onClick={() => alert('Volunteer application mock: in prototype, request admin role approval.')}
                            className="font-semibold text-[#0b132b] dark:text-white underline hover:text-[#ff453a] cursor-pointer"
                          >
                            Become a volunteer to claim
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => alert(`Mock: Claimed incident ${incident.shortId}.`)}
                          className="flex-1 min-h-[44px] bg-[#ff453a] hover:bg-[#e03b31] text-white font-semibold text-[14px] rounded-xl flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98] transition-transform cursor-pointer border-none"
                        >
                          <HeartHandshake className="w-4 h-4" aria-hidden="true" />
                          <span>Claim Rescue</span>
                        </button>
                      )}

                      {/* Secondary Call Action */}
                      <button
                        type="button"
                        onClick={showDisabledCallNotice}
                        aria-label="Call clinic (disabled in test mode)"
                        className="min-h-[40px] px-3.5 rounded-xl border border-[#ccd7e8] dark:border-[#2a3c63] bg-white dark:bg-[#1e2d4d] hover:bg-[#f0f4fa] dark:hover:bg-[#25375c] text-[#0b132b] dark:text-white font-semibold text-[12px] flex items-center gap-1.5 transition-colors active:scale-95 cursor-pointer"
                      >
                        <Phone className="w-3.5 h-3.5 text-[#5a6b85] dark:text-[#8e9bb0]" aria-hidden="true" />
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
        <h2 id="facilities-heading" className="text-[16px] font-semibold text-[#0b132b] dark:text-white">
          Partner clinics
        </h2>

        <div className="space-y-3">
          {[
            { id: 'f1', name: 'Test Clinic A', dist: '1.1 km', active: 'Active 2h ago' },
            { id: 'f2', name: 'Test Clinic B', dist: '2.4 km', active: 'Active 1d ago' },
          ].map((fac) => (
            <article
              key={fac.id}
              className="bg-white dark:bg-[#162138] border border-[#ccd7e8] dark:border-[#223152] rounded-2xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-none flex items-center justify-between gap-2"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-[14px] font-semibold text-[#0b132b] dark:text-white">{fac.name}</h3>
                  <span className="rounded-full bg-[#f0f4fa] dark:bg-[#1e2d4d] border border-[#ccd7e8] dark:border-[#2a3c63] px-2 py-0.5 text-[12px] font-normal text-[#5a6b85] dark:text-[#8e9bb0]">
                    Listed Facility
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[12px] text-[#5a6b85] dark:text-[#8e9bb0]">
                  <span>{fac.dist}</span>
                  <span>•</span>
                  <span>{fac.active}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={showDisabledCallNotice}
                aria-label={`Call ${fac.name} (disabled in test mode)`}
                className="min-h-[40px] px-3.5 rounded-xl border border-[#ccd7e8] dark:border-[#2a3c63] bg-white dark:bg-[#1e2d4d] hover:bg-[#f0f4fa] dark:hover:bg-[#25375c] text-[#0b132b] dark:text-white font-semibold text-[12px] flex items-center gap-1.5 transition-colors active:scale-95 cursor-pointer"
              >
                <Phone className="w-3.5 h-3.5 text-[#5a6b85] dark:text-[#8e9bb0]" aria-hidden="true" />
                <span>Call</span>
              </button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
