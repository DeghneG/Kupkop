'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FlaskConical } from 'lucide-react';
import { resetDemo, setDemoOn, useDemoMode } from '@/lib/demo/demo';
import { useConfirm } from '@/components/ConfirmSheet';
import { PANE_PREFIX } from '@/lib/storage';

// Three screens of the same demo side by side, one per person in the story, so the whole flow can be
// played from the start without switching roles. Each frame is the real app locked to one role (?pane=);
// they share the demo data through the browser's storage, so an action in one shows up in the others.
const PANES = [
  { id: 'citizen', label: 'Citizen', who: 'Sees an injured animal', src: '/sos?pane=citizen' },
  { id: 'volunteer', label: 'Volunteer', who: 'Rescues and takes it to a clinic', src: '/?pane=volunteer' },
  { id: 'facility', label: 'Clinic staff', who: 'Confirms arrival and posts updates', src: '/care?pane=facility' },
] as const;

const STEPS = [
  'Citizen: pick the animal and emergency, tap the shutter, then Send. The case is dispatched.',
  'Volunteer: the case appears at the top of the Feed. Claim it, then tap On my way.',
  'Volunteer: Tell a clinic I’m coming, then Admit when you arrive.',
  'Clinic staff: answer the heads-up, then Animal arrived. Post a recovery update with a photo.',
  'Citizen: open Follow this case to see every step appear.',
];

export default function DemoPage() {
  const router = useRouter();
  const { ask, sheet } = useConfirm();
  // True once demo mode is on, so no frame starts in the real app
  const ready = useDemoMode();
  const [tab, setTab] = useState(0);

  useEffect(() => {
    setDemoOn(true);
  }, []);

  const button = 'min-h-[44px] px-4 rounded-xl border border-border bg-surface hover:bg-surface-muted text-fg font-semibold text-[14px] cursor-pointer';

  return (
    <div className="fixed inset-0 z-[60] overflow-auto bg-page text-fg">
      <div className="mx-auto max-w-[1280px] px-4 py-4 space-y-4">
        <header className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-fg-muted" aria-hidden="true" />
              <h1 className="text-[20px] font-bold">KupKop demo: three screens</h1>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={button}
                onClick={() =>
                  ask({
                    title: 'Start the demo over?',
                    message: 'All three screens go back to the start: the clinics stay and every case is cleared.',
                    confirmLabel: 'Yes, start over',
                    onConfirm: () => resetDemo(),
                  })
                }
              >
                Start over
              </button>
              <button
                type="button"
                className={button}
                onClick={() => {
                  setDemoOn(false);
                  router.push('/settings');
                }}
              >
                Exit demo
              </button>
            </div>
          </div>
          <p className="text-[12px] text-fg-muted">
            Made-up clinics and cases, played in this browser, starting with an empty Feed. Nothing is saved to the database, and the camera and location are faked. An
            action in one screen shows up in the others.
          </p>
          <ol className="text-[12px] text-fg-muted list-decimal pl-5 space-y-0.5 max-w-3xl">
            {STEPS.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </header>

        {/* On a narrow window one screen shows at a time; all three stay loaded so they keep in step */}
        <div role="tablist" aria-label="Screens" className="grid grid-cols-3 gap-2 lg:hidden">
          {PANES.map((p, i) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={tab === i}
              onClick={() => setTab(i)}
              className={`min-h-[44px] rounded-xl border text-[14px] font-semibold cursor-pointer ${
                tab === i ? 'bg-surface-muted text-action border-action border-2 font-bold' : 'bg-surface text-fg border-border'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="lg:grid lg:grid-cols-3 lg:gap-4 pb-6">
          {PANES.map((p, i) => (
            <section key={p.id} aria-label={`${p.label} screen`} className={`${tab === i ? 'block' : 'hidden'} lg:block space-y-2`}>
              <div className="px-1">
                <h2 className="text-[16px] font-semibold">
                  {i + 1} · {p.label}
                </h2>
                <p className="text-[12px] text-fg-muted">{p.who}</p>
              </div>
              {ready ? (
                <iframe
                  title={`${p.label} screen`}
                  name={`${PANE_PREFIX}${p.id}`}
                  src={p.src}
                  className="w-full h-[min(780px,calc(100vh-260px))] min-h-[560px] rounded-2xl border border-border bg-page"
                />
              ) : (
                <div className="w-full h-[560px] rounded-2xl border border-border bg-surface" aria-hidden="true" />
              )}
            </section>
          ))}
        </div>
      </div>
      {sheet}
    </div>
  );
}
