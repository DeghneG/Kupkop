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
      <header className="flex items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-red-600 text-white flex items-center justify-center font-bold text-lg shadow-sm shrink-0">
            K
          </div>
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight leading-none text-zinc-900 dark:text-zinc-50">
              KupKop
            </h1>
            <p className="text-[12px] text-zinc-500 dark:text-zinc-400 font-normal mt-0.5">
              Street Animal Emergency
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Sign In / User Status */}
          {user ? (
            <div className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700">
              <span className="text-[12px] font-semibold text-zinc-800 dark:text-zinc-200 truncate max-w-[85px]">
                {user.email?.split('@')[0]}
              </span>
              <button
                type="button"
                onClick={handleSignOut}
                className="text-[12px] font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 underline cursor-pointer"
              >
                Sign out
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsAuthOpen(true)}
              className="whitespace-nowrap min-h-[40px] px-3.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 font-semibold text-[12px] shadow-sm transition-colors cursor-pointer shrink-0"
            >
              Sign In
            </button>
          )}

          <ThemeToggle />
        </div>
      </header>

      {/* Secondary Utility Row: Location status & DEV role selector */}
      <div className="flex items-center justify-between gap-2 bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/80 rounded-2xl px-3.5 py-2 text-[12px]">
        <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400 truncate">
          <MapPin className="w-4 h-4 text-zinc-400 shrink-0" aria-hidden="true" />
          <span className="font-normal truncate">Location not set</span>
        </div>

        {/* DEV ONLY mock role dropdown */}
        <div className="flex items-center gap-1.5 shrink-0">
          <label htmlFor="mock-role-select" className="text-[11px] text-zinc-500 dark:text-zinc-400 font-normal">
            DEV:
          </label>
          <select
            id="mock-role-select"
            value={mockRole}
            onChange={(e) => setMockRole(e.target.value as any)}
            className="text-[11px] font-semibold bg-white dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-600 rounded-lg px-2 py-0.5 outline-none focus:ring-1 focus:ring-red-500 cursor-pointer"
          >
            <option value="citizen">Citizen</option>
            <option value="volunteer">Volunteer</option>
            <option value="facility">Facility</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>

      {/* SOS Hero: ~120px tall, clean white card base with guaranteed filled red button */}
      <section
        aria-labelledby="sos-heading"
        className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-2.5 shadow-sm"
      >
        <h2 id="sos-heading" className="text-[16px] font-semibold text-zinc-900 dark:text-zinc-50">
          Found an injured street animal?
        </h2>

        {/* Solid Red Filled Emergency Action */}
        <Link
          href="/sos"
          id="hero-sos-trigger-button"
          className="w-full min-h-[48px] bg-red-600 hover:bg-red-700 active:scale-[0.99] text-white font-semibold text-[16px] rounded-xl flex items-center justify-center gap-2 shadow-sm transition-transform border-none focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          <Camera className="w-5 h-5 text-white" aria-hidden="true" />
          <span>Report Emergency</span>
        </Link>

        <p className="text-[12px] text-zinc-500 dark:text-zinc-400 font-normal pt-0.5">
          Take a live photo. We add your location and time automatically.
        </p>
      </section>

      {/* Rafa: One collapsed row with triage chips */}
      <section
        aria-label="Rafa First-Aid Guidance"
        className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-3 shadow-sm"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-teal-600 dark:text-teal-400 shrink-0" aria-hidden="true" />
            <h2 className="text-[14px] font-semibold text-zinc-900 dark:text-zinc-100">
              Rafa first-aid helper
            </h2>
          </div>
          <Link
            href="/rafa"
            className="text-[12px] font-semibold text-teal-700 dark:text-teal-400 hover:underline flex items-center gap-0.5"
          >
            <span>Ask Rafa</span>
            <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </div>

        {/* Triage chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 text-[12px]">
          <Link
            href="/rafa?q=bleeding"
            className="shrink-0 rounded-full border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 hover:bg-zinc-100 dark:hover:bg-zinc-800 px-3 py-1 text-[12px] font-normal text-zinc-700 dark:text-zinc-200 transition-colors"
          >
            Bleeding
          </Link>
          <Link
            href="/rafa?q=scared-dog"
            className="shrink-0 rounded-full border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 hover:bg-zinc-100 dark:hover:bg-zinc-800 px-3 py-1 text-[12px] font-normal text-zinc-700 dark:text-zinc-200 transition-colors"
          >
            Scared / aggressive dog
          </Link>
          <Link
            href="/rafa?q=moving-safely"
            className="shrink-0 rounded-full border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 hover:bg-zinc-100 dark:hover:bg-zinc-800 px-3 py-1 text-[12px] font-normal text-zinc-700 dark:text-zinc-200 transition-colors"
          >
            Moving safely
          </Link>
        </div>
      </section>

      {/* Active Incidents Feed */}
      <section aria-labelledby="feed-heading" className="space-y-3">
        <h2 id="feed-heading" className="text-[16px] font-semibold text-zinc-900 dark:text-zinc-50">
          Active incidents
        </h2>

        <div className="space-y-3">
          {emergencies.map((incident) => {
            const isClaimed = incident.state === 'claimed';

            return (
              <article
                key={incident.id}
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm space-y-3"
              >
                {/* Top Row: Case ID, Neutral Outlined Triage Tag, Colored Status Pill */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-[12px] px-2.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700">
                      {incident.shortId}
                    </span>
                    {/* Neutral outlined triage tag with SVG icon */}
                    <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 px-2.5 py-0.5 text-[12px] font-normal text-zinc-700 dark:text-zinc-300">
                      <Activity className="w-3 h-3 text-zinc-400" aria-hidden="true" />
                      <span>{incident.type}</span>
                    </span>
                  </div>

                  {/* Status Pill: Tinted background + readable text + icon */}
                  {isClaimed ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[12px] font-semibold bg-amber-50 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50">
                      <Lock className="w-3 h-3" aria-hidden="true" />
                      <span>Claimed</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[12px] font-semibold bg-red-50 dark:bg-red-950/70 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/50">
                      <AlertCircle className="w-3 h-3" aria-hidden="true" />
                      <span>Reported</span>
                    </span>
                  )}
                </div>

                {/* Middle Row: ~80px Thumbnail + Location & Animal Details */}
                <div className="flex gap-3 items-center">
                  {/* ~80px blurred thumbnail with tap to reveal */}
                  <div className="relative w-20 h-20 shrink-0 rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center">
                    <div
                      className={`w-full h-full bg-zinc-100 dark:bg-zinc-800 flex flex-col items-center justify-center transition-all ${
                        incident.blurred ? 'blur-md' : 'blur-0'
                      }`}
                    >
                      <Camera className="w-6 h-6 text-zinc-400" aria-hidden="true" />
                      <span className="text-[11px] text-zinc-500 font-normal mt-1">Photo</span>
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
                    <p className="text-[14px] font-semibold text-zinc-900 dark:text-zinc-50 truncate">
                      {incident.animal}
                    </p>
                    <div className="flex items-center gap-1 text-[12px] text-zinc-500 dark:text-zinc-400 truncate">
                      <MapPin className="w-3.5 h-3.5 shrink-0 text-zinc-400" aria-hidden="true" />
                      <span className="truncate">{incident.location}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[12px] text-zinc-500 dark:text-zinc-400">
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
                <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-2">
                  {isClaimed ? (
                    <div className="flex-1 flex items-center gap-1.5 text-[12px] font-normal text-zinc-500 dark:text-zinc-400">
                      <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                      <span>Claimed by a volunteer</span>
                    </div>
                  ) : (
                    <>
                      {/* Primary Claim Action or Citizen prompt */}
                      {mockRole === 'citizen' ? (
                        <div className="flex-1 text-[12px] text-zinc-500 dark:text-zinc-400 font-normal">
                          <span>Citizen view: </span>
                          <button
                            type="button"
                            onClick={() => alert('Volunteer application mock: in prototype, request admin role approval.')}
                            className="font-semibold text-zinc-900 dark:text-zinc-100 underline hover:text-red-600 cursor-pointer"
                          >
                            Become a volunteer to claim
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => alert(`Mock: Claimed incident ${incident.shortId}.`)}
                          className="flex-1 min-h-[44px] bg-red-600 hover:bg-red-700 text-white font-semibold text-[14px] rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer border-none"
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
                        className="min-h-[40px] px-3.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-semibold text-[12px] flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Phone className="w-3.5 h-3.5 text-zinc-400" aria-hidden="true" />
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
        <h2 id="facilities-heading" className="text-[16px] font-semibold text-zinc-900 dark:text-zinc-50">
          Partner clinics
        </h2>

        <div className="space-y-3">
          {[
            { id: 'f1', name: 'Test Clinic A', dist: '1.1 km', active: 'Active 2h ago' },
            { id: 'f2', name: 'Test Clinic B', dist: '2.4 km', active: 'Active 1d ago' },
          ].map((fac) => (
            <article
              key={fac.id}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm flex items-center justify-between gap-2"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-[14px] font-semibold text-zinc-900 dark:text-zinc-50">{fac.name}</h3>
                  <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-2 py-0.5 text-[12px] font-normal text-zinc-600 dark:text-zinc-400">
                    Listed Facility
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[12px] text-zinc-500 dark:text-zinc-400">
                  <span>{fac.dist}</span>
                  <span>•</span>
                  <span>{fac.active}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={showDisabledCallNotice}
                aria-label={`Call ${fac.name} (disabled in test mode)`}
                className="min-h-[40px] px-3.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-semibold text-[12px] flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Phone className="w-3.5 h-3.5 text-zinc-400" aria-hidden="true" />
                <span>Call</span>
              </button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
