'use client';

import React from 'react';
import Link from 'next/link';
import { FlaskConical } from 'lucide-react';
import { resetDemo, setDemoOn, useDemoMode } from '@/lib/demo/demo';
import { useConfirm } from '@/components/ConfirmSheet';
import { usePaneFrame } from '@/lib/storage';

// A strip under the Test mode notice while demo mode is on, so nobody mistakes demo cases for real ones.
export function DemoBanner() {
  const on = useDemoMode();
  const paneFrame = usePaneFrame();
  const { ask, sheet } = useConfirm();
  if (!on || paneFrame) return null;
  return (
    <aside aria-label="Demo mode notice" className="w-full bg-surface-muted text-fg border-b border-border px-4 py-2">
      <p className="flex items-start gap-2 text-[12px] leading-snug">
        <FlaskConical className="w-4 h-4 shrink-0 mt-px" aria-hidden="true" />
        <span className="flex-1">
          <strong className="font-semibold">Demo mode.</strong> Made-up clinics and cases, played in this browser. Nothing is saved to the
          database. Switch roles in the bar below to play the volunteer, the clinic and the admin.
        </span>
      </p>
      <div className="flex gap-4 pt-1 pl-6">
        <button
          type="button"
          onClick={() =>
            ask({
              title: 'Start the demo over?',
              message: 'The demo goes back to the start: the clinics stay and every case is cleared.',
              confirmLabel: 'Yes, start over',
              onConfirm: () => resetDemo(),
            })
          }
          className="min-h-[44px] text-[12px] font-semibold underline underline-offset-4 cursor-pointer"
        >
          Start over
        </button>
        <button type="button" onClick={() => setDemoOn(false)} className="min-h-[44px] text-[12px] font-semibold underline underline-offset-4 cursor-pointer">
          Turn off
        </button>
      </div>
      {sheet}
    </aside>
  );
}

// The Settings card that turns demo mode on or off
export function DemoModeSection() {
  const on = useDemoMode();
  const { ask, sheet } = useConfirm();
  return (
    <section aria-labelledby="settings-demo-heading" className="bg-surface -mx-4 px-4 py-4 border-y border-border space-y-3">
      <div className="flex items-center gap-2">
        <FlaskConical className="w-4 h-4 text-fg-muted shrink-0" aria-hidden="true" />
        <h2 id="settings-demo-heading" className="text-[12px] font-semibold text-fg-muted">
          Demo mode
        </h2>
      </div>
      <p className="text-[12px] text-fg-muted leading-normal">
        Try the whole flow with made-up cases and clinics: report, claim, tell a clinic, admit, confirm arrival, recovery updates and
        resolve. It runs in this browser only and never touches the database. Use the role bar to be the volunteer, the clinic or the
        admin.
      </p>
      <Link
        href="/demo"
        className="w-full min-h-[48px] rounded-xl bg-action text-action-fg font-semibold text-[14px] flex items-center justify-center"
      >
        Open the three-screen demo
      </Link>
      {on ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              ask({
                title: 'Start the demo over?',
                message: 'The demo goes back to the start: the clinics stay and every case is cleared.',
                confirmLabel: 'Yes, start over',
                onConfirm: () => resetDemo(),
              })
            }
            className="min-h-[44px] px-4 rounded-xl border border-border bg-surface hover:bg-surface-muted text-fg font-semibold text-[14px] cursor-pointer"
          >
            Start the demo over
          </button>
          <button
            type="button"
            onClick={() => setDemoOn(false)}
            className="min-h-[44px] px-4 rounded-xl border border-border bg-surface hover:bg-surface-muted text-fg font-semibold text-[14px] cursor-pointer"
          >
            Turn demo mode off
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setDemoOn(true)}
          className="w-full min-h-[48px] rounded-xl bg-action text-action-fg font-semibold text-[14px] cursor-pointer"
        >
          Turn on demo mode
        </button>
      )}
      {sheet}
    </section>
  );
}
