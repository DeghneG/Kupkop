'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { Camera, ArrowRight } from 'lucide-react';
import AuthPanel from '@/components/AuthPanel';
import { IncidentCard, IncidentData } from '@/components/IncidentCard';
import { KupkopMark } from '@/components/icons/TriageGlyph';
import { useProfile } from '@/lib/supabase/useProfile';
import { WELCOME_SEEN_KEY } from '@/lib/storage';

// Preview rows reuse the real feed row. No timestamps, so labels stay static ("widens in 3m", "Claimed").
const PREVIEW_CASES: IncidentData[] = [
  {
    id: 'preview-1',
    shortId: 'KK-4821',
    animal: 'Aspin Dog',
    type: 'Hit-and-run · Critical',
    state: 'reported',
    location: 'Aurora Blvd near EDSA, Cubao',
    timeAgo: '2m ago',
  },
  {
    id: 'preview-2',
    shortId: 'KK-4822',
    animal: 'Puspin Kitten',
    type: 'Trapped in storm drain',
    state: 'claimed',
    location: 'E. Rodriguez Sr. Ave, New Manila',
    timeAgo: '14m ago',
  },
];

// A real sequence, so the numbers carry meaning. Wording matches what the app does today.
const STEPS = [
  {
    title: 'You report it',
    body: 'Live camera photo, your GPS, and a server timestamp. No gallery uploads, so reports are real and current.',
  },
  {
    title: 'One volunteer claims it',
    body: 'The claim locks the case for an hour, so two people never race to the same animal.',
  },
  {
    title: 'Everyone sees the recovery',
    body: 'Listed clinics must post a recovery update within 14 days of admitting the animal.',
  },
];

export default function WelcomePage() {
  const router = useRouter();
  const profile = useProfile();
  const rootRef = useRef<HTMLDivElement>(null);

  // Shown once per device; after that the feed opens directly
  useEffect(() => {
    try {
      localStorage.setItem(WELCOME_SEEN_KEY, '1');
    } catch {
      // Private mode: the page still works, it may just show again next time
    }
  }, []);

  // Already signed in (including the return from an email link or Google/Facebook): go to the feed
  useEffect(() => {
    if (!profile.loading && profile.user) router.replace('/');
  }, [profile.loading, profile.user, router]);

  // One entrance: the hero settles in, then the preview rows arrive like new reports.
  // Content is visible by default; motion only runs when the user allows it.
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap
          .timeline({ defaults: { ease: 'expo.out', duration: 0.7 } })
          .from('[data-reveal]', { y: 12, opacity: 0, stagger: 0.06 })
          .from('[data-preview-row]', { y: 16, opacity: 0, stagger: 0.12, duration: 0.6 }, '-=0.35');
      });
      return () => mm.revert();
    },
    { scope: rootRef }
  );

  return (
    <div ref={rootRef} className="flex flex-col flex-1 pb-10">
      <header className="flex items-center justify-between gap-3 px-4 pt-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-fg flex items-center justify-center shrink-0">
            <KupkopMark size={22} className="text-page" />
          </div>
          <span className="text-[22px] font-semibold tracking-tight leading-none text-fg font-brand">KupKop</span>
        </div>
        <a
          href="#account"
          className="min-h-[44px] px-3 inline-flex items-center rounded-xl text-[14px] font-semibold text-fg hover:bg-surface-muted"
        >
          Log in
        </a>
      </header>

      {/* Hero: what it is, and the one emergency action */}
      <section aria-labelledby="welcome-heading" className="px-4 pt-10">
        <h1
          id="welcome-heading"
          data-reveal
          className="text-[22px] leading-tight font-semibold tracking-tight text-fg font-brand max-w-[18ch]"
        >
          See a hurt street animal? Get it help in three taps.
        </h1>
        <p data-reveal className="mt-3 text-[14px] text-fg-muted leading-relaxed max-w-[38ch]">
          KupKop connects people who find injured aspins and puspins with rescue volunteers and partner clinics.
        </p>

        <div data-reveal className="mt-6">
          <Link
            href="/sos"
            className="w-full min-h-[48px] rounded-xl bg-accent text-accent-fg font-semibold text-[14px] flex items-center justify-center gap-2 hover:opacity-95"
          >
            <Camera className="w-5 h-5" aria-hidden="true" />
            Report an emergency now
          </Link>
          <p className="mt-2 text-[12px] text-fg-muted text-center">
            No account needed to start. You sign in just before the report is sent.
          </p>
        </div>
      </section>

      {/* Preview: the real feed row, with sample cases, so people see what responders see */}
      <section aria-labelledby="preview-heading" className="mt-10">
        <div className="px-4 flex items-baseline justify-between gap-3">
          <h2 id="preview-heading" className="text-[16px] font-semibold text-fg">
            What responders see
          </h2>
          <span className="text-[12px] text-fg-muted">Sample cases</span>
        </div>
        <div className="mt-3 mx-4 rounded-2xl border border-border bg-page overflow-hidden" inert>
          <div className="divide-y divide-border">
            {PREVIEW_CASES.map((incident) => (
              <div key={incident.id} data-preview-row>
                <IncidentCard incident={incident} onClick={() => {}} />
              </div>
            ))}
          </div>
        </div>
        <p className="mt-2 px-4 text-[12px] text-fg-muted">
          Each report shows how long it has waited, so the most urgent animal is always on top.
        </p>
      </section>

      {/* How a rescue moves, in order */}
      <section aria-labelledby="steps-heading" className="mt-10 px-4">
        <h2 id="steps-heading" className="text-[16px] font-semibold text-fg">
          How a rescue works
        </h2>
        <ol className="mt-4 space-y-5">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-3">
              <span
                aria-hidden="true"
                className="w-7 h-7 shrink-0 rounded-full border border-border bg-surface text-[12px] font-semibold text-fg flex items-center justify-center tabular-nums"
              >
                {i + 1}
              </span>
              <div className="pt-0.5">
                <p className="text-[14px] font-semibold text-fg">{step.title}</p>
                <p className="mt-0.5 text-[14px] text-fg-muted leading-relaxed">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Account: log in or create one */}
      <section
        id="account"
        aria-label="Log in or create an account"
        className="mt-10 mx-4 scroll-mt-16 rounded-2xl border border-border bg-surface p-5"
      >
        <AuthPanel headingId="welcome-auth-heading" redirectPath="/" />
      </section>

      <Link
        href="/"
        className="mt-6 self-center min-h-[44px] px-3 inline-flex items-center gap-1.5 text-[14px] font-semibold text-link hover:underline underline-offset-4"
      >
        Browse cases without an account
        <ArrowRight className="w-4 h-4" aria-hidden="true" />
      </Link>

      <p className="mt-4 px-4 text-[12px] text-fg-muted text-center">
        KupKop is a free prototype. Reports are not sent to 911 or real responders.
      </p>
    </div>
  );
}
