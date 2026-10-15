'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  Camera,
  MapPin,
  Clock,
  ShieldCheck,
  PhoneCall,
  Lock,
  ChevronRight,
  Eye,
  EyeOff,
  Sparkles,
  Building2,
  HeartHandshake
} from 'lucide-react';
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
  imageAlt: string;
}

const mockEmergencies: MockEmergency[] = [
  {
    id: 'case-1',
    shortId: 'KK-4821',
    animal: 'Aspin Dog',
    type: 'Hit-and-Run / Bleeding',
    urgency: 'critical',
    state: 'reported',
    location: 'Aurora Blvd near Katipunan, QC',
    distance: '0.8 km away',
    timeAgo: '4 mins ago',
    blurred: true,
    imageAlt: 'Simulated injury snapshot: canine leg wound on roadside pavement',
  },
  {
    id: 'case-2',
    shortId: 'KK-4822',
    animal: 'Puspin Kitten',
    type: 'Trapped in Storm Drain',
    urgency: 'urgent',
    state: 'claimed',
    location: 'E. Rodriguez Sr. Ave, QC',
    distance: '1.4 km away',
    timeAgo: '18 mins ago',
    claimedBy: 'Volunteer Marco S.',
    blurred: false,
    imageAlt: 'Simulated kitten trapped behind drainage grating',
  },
];

export default function HomePage() {
  const [emergencies, setEmergencies] = useState<MockEmergency[]>(mockEmergencies);
  const [selectedRole, setSelectedRole] = useState<'citizen' | 'volunteer' | 'facility' | 'admin'>('citizen');

  const toggleBlur = (id: string) => {
    setEmergencies((prev) =>
      prev.map((e) => (e.id === id ? { ...e, blurred: !e.blurred } : e))
    );
  };

  return (
    <div className="flex flex-col flex-1 px-4 py-4 space-y-5">
      {/* App Header & Role Context */}
      <header className="flex items-center justify-between pt-1">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-rose-600 flex items-center justify-center text-white shadow-sm font-black text-lg">
              K
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight leading-none text-zinc-900 dark:text-zinc-50">
                KupKop
              </h1>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
                Street Animal Emergency Network
              </p>
            </div>
          </div>
        </div>

        {/* Role Selector pill for prototype testing */}
        <div className="flex flex-col items-end">
          <label htmlFor="role-select" className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
            Test Role
          </label>
          <select
            id="role-select"
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value as any)}
            className="text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-700 rounded-md px-2 py-1 outline-none focus:ring-1 focus:ring-rose-500 cursor-pointer"
          >
            <option value="citizen">Citizen</option>
            <option value="volunteer">Volunteer (Approved)</option>
            <option value="facility">Facility (Listed)</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </header>

      {/* GPS Status Indicator */}
      <div className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs">
        <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
          <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
          <span className="font-medium truncate">Quezon City, Metro Manila</span>
        </div>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          GPS Active
        </span>
      </div>

      {/* Primary Emergency SOS Hero Action */}
      <section
        aria-labelledby="sos-hero-heading"
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-rose-600 via-rose-700 to-rose-900 text-white p-5 shadow-lg shadow-rose-900/20"
      >
        <div className="relative z-10 space-y-3">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-white/20 backdrop-blur-sm text-white uppercase tracking-wider">
              <AlertCircle className="w-3.5 h-3.5" />
              Emergency SOS
            </span>
            <span className="text-[11px] font-medium text-rose-100">
              3 Taps • ~15s
            </span>
          </div>

          <div>
            <h2 id="sos-hero-heading" className="text-xl font-black tracking-tight leading-tight">
              Found an Injured Street Animal?
            </h2>
            <p className="text-xs text-rose-100 mt-1 leading-relaxed">
              Camera-only capture with locked GPS & server timestamp alerts responders immediately.
            </p>
          </div>

          <Link
            href="/sos"
            id="hero-sos-trigger-button"
            className="w-full min-h-[52px] bg-white text-rose-700 hover:bg-rose-50 active:scale-[0.98] transition-all font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-md focus:outline-none focus:ring-4 focus:ring-white/40"
          >
            <Camera className="w-5 h-5 text-rose-600" />
            <span>REPORT EMERGENCY (LIVE CAMERA)</span>
          </Link>
        </div>

        {/* Decorative background glow */}
        <div className="absolute -bottom-8 -right-8 w-36 h-36 bg-rose-500/20 rounded-full blur-2xl pointer-events-none" />
      </section>

      {/* Rafa AI Assistant Quick Prompt */}
      <section
        aria-label="Rafa First Aid Assistant"
        className="rounded-2xl border border-teal-200 dark:border-teal-900/60 bg-teal-50/70 dark:bg-teal-950/30 p-4 space-y-2.5"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-teal-600 text-white flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-teal-950 dark:text-teal-100 flex items-center gap-1.5">
                Rafa — First-Aid & Rules
                <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-teal-200/60 dark:bg-teal-900 text-teal-900 dark:text-teal-300">
                  EN / FIL
                </span>
              </h3>
              <p className="text-[11px] text-teal-800 dark:text-teal-300">
                Calm guidance while responders are on the way.
              </p>
            </div>
          </div>
          <Link
            href="/rafa"
            className="text-xs font-bold text-teal-700 dark:text-teal-400 hover:underline flex items-center"
          >
            Chat <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 pt-0.5 text-xs scrollbar-none">
          <Link
            href="/rafa?q=bleeding"
            className="shrink-0 bg-white dark:bg-zinc-900 border border-teal-200 dark:border-teal-900/80 rounded-lg px-2.5 py-1.5 text-zinc-700 dark:text-zinc-300 hover:border-teal-400 text-[11px] font-medium"
          >
            🩸 How to stop bleeding
          </Link>
          <Link
            href="/rafa?q=heatstroke"
            className="shrink-0 bg-white dark:bg-zinc-900 border border-teal-200 dark:border-teal-900/80 rounded-lg px-2.5 py-1.5 text-zinc-700 dark:text-zinc-300 hover:border-teal-400 text-[11px] font-medium"
          >
            ☀️ Signs of heatstroke
          </Link>
          <Link
            href="/rafa?q=rules"
            className="shrink-0 bg-white dark:bg-zinc-900 border border-teal-200 dark:border-teal-900/80 rounded-lg px-2.5 py-1.5 text-zinc-700 dark:text-zinc-300 hover:border-teal-400 text-[11px] font-medium"
          >
            📋 Claim lock rules
          </Link>
        </div>
      </section>

      {/* Active Incident Feed Preview */}
      <section aria-labelledby="live-feed-heading" className="space-y-3 pt-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 id="live-feed-heading" className="text-sm font-black uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
              Active Street Incidents
            </h2>
            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 rounded">
              2 Nearby
            </span>
          </div>
          <span className="text-[11px] text-zinc-500 font-medium">Real-time sync</span>
        </div>

        <div className="space-y-3">
          {emergencies.map((incident) => {
            const isCritical = incident.urgency === 'critical';
            const isClaimed = incident.state === 'claimed';

            return (
              <article
                key={incident.id}
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm space-y-3"
              >
                {/* Header: Short ID, Urgency, State Pill */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700">
                        {incident.shortId}
                      </span>
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          isCritical
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        }`}
                      >
                        {incident.type}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 mt-1">
                      {incident.animal}
                    </p>
                  </div>

                  {/* Status Pill */}
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full ${
                      isClaimed
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                        : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                    }`}
                  >
                    {isClaimed ? <Lock className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                    {incident.state.toUpperCase()}
                  </span>
                </div>

                {/* Photo with Graphic Injury Blur Protection */}
                <div className="relative rounded-xl overflow-hidden bg-zinc-200 dark:bg-zinc-800 aspect-[16/9] flex items-center justify-center">
                  <div
                    className={`w-full h-full bg-zinc-800 flex items-center justify-center transition-all duration-300 ${
                      incident.blurred ? 'blur-lg scale-105' : 'blur-0 scale-100'
                    }`}
                  >
                    <div className="text-center p-4">
                      <Camera className="w-8 h-8 text-zinc-500 mx-auto mb-1" />
                      <p className="text-xs text-zinc-400 font-mono">[Live Camera Snap — Authenticated]</p>
                    </div>
                  </div>

                  {/* Blur Reveal Toggle */}
                  <button
                    type="button"
                    onClick={() => toggleBlur(incident.id)}
                    className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/40 hover:bg-black/50 text-white font-medium text-xs gap-1.5 focus:outline-none"
                    aria-label={incident.blurred ? 'Reveal graphic photo' : 'Hide graphic photo'}
                  >
                    {incident.blurred ? (
                      <>
                        <Eye className="w-5 h-5" />
                        <span className="bg-black/60 px-3 py-1 rounded-full text-[11px] font-bold">
                          Tap to reveal injury photo
                        </span>
                      </>
                    ) : (
                      <span className="absolute top-2 right-2 bg-black/60 px-2.5 py-1 rounded-full text-[10px] font-medium flex items-center gap-1">
                        <EyeOff className="w-3.5 h-3.5" /> Tap to re-blur
                      </span>
                    )}
                  </button>
                </div>

                {/* Location, Distance, and Escalation Time */}
                <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 pt-1">
                  <div className="flex items-center gap-1 truncate">
                    <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    <span className="truncate">{incident.location}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 font-medium">
                    <span>{incident.distance}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {incident.timeAgo}
                    </span>
                  </div>
                </div>

                {/* Action Row */}
                <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex gap-2">
                  {isClaimed ? (
                    <div className="flex-1 bg-zinc-100 dark:bg-zinc-800/80 rounded-xl px-3 py-2 text-xs flex items-center justify-between">
                      <span className="text-zinc-600 dark:text-zinc-400 font-medium flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-blue-500" />
                        Claimed by {incident.claimedBy}
                      </span>
                      <Link
                        href={`/case/${incident.shortId}`}
                        className="text-blue-600 dark:text-blue-400 font-bold hover:underline"
                      >
                        Track
                      </Link>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => alert(`Prototype: Claim locked for ${incident.shortId}. You have 30 mins to arrive.`)}
                        className="flex-1 min-h-[48px] bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <HeartHandshake className="w-4 h-4" />
                        CLAIM CASE (LOCK)
                      </button>
                      <a
                        href="tel:09170000000"
                        className="min-h-[48px] px-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold hover:bg-emerald-100 transition-colors"
                        aria-label="Call clinic directly"
                      >
                        <PhoneCall className="w-4 h-4 text-emerald-600" />
                        <span>Call Clinic</span>
                      </a>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Facilities Preview ("Listed", never "Verified") */}
      <section
        aria-labelledby="facilities-heading"
        className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 p-4 space-y-3"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-zinc-500" />
            <h2 id="facilities-heading" className="text-xs font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
              Nearby Listed Facilities
            </h2>
          </div>
          <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
            Rule: Labeled &quot;Listed&quot; Only
          </span>
        </div>

        <div className="space-y-2 text-xs">
          <div className="bg-white dark:bg-zinc-900 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
            <div>
              <p className="font-bold text-zinc-900 dark:text-zinc-100">QC Animal Care Clinic</p>
              <p className="text-[11px] text-zinc-500">Katipunan Ave • 1.1 km</p>
              <span className="inline-block mt-1 text-[10px] font-bold px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                Listed Facility
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold block">
                Active 2h ago
              </span>
              <a
                href="tel:09171234567"
                className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-zinc-700 dark:text-zinc-300 hover:text-zinc-950"
              >
                <PhoneCall className="w-3 h-3 text-emerald-500" /> Call
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
