'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import RoleSwitcher, { roleLabel } from '@/components/RoleSwitcher';
import { useViewAs, usePaneFrame } from '@/lib/storage';
import { useProfile } from '@/lib/supabase/useProfile';
import { useDemoMode } from '@/lib/demo/demo';

const MINIMIZED_KEY = 'kupkop-preview-minimized';

// Shown on every page while a role preview is on, so it can never be mistaken for the real account.
// One compact strip: what is on, the switcher, and the way out. It can shrink to a single slim row
// (the choice is remembered on this device); the row still names the preview and keeps Exit.
export default function RolePreviewBanner() {
  const { role, previewRole } = useProfile();
  const [, setViewAs] = useViewAs();
  const demoOn = useDemoMode();
  const [minimized, setMinimized] = useState<boolean>(() => {
    try {
      return typeof window !== 'undefined' && localStorage.getItem(MINIMIZED_KEY) === '1';
    } catch {
      return false;
    }
  });

  const paneFrame = usePaneFrame();
  if (previewRole === null || paneFrame) return null;

  const toggle = () => {
    const next = !minimized;
    setMinimized(next);
    try {
      if (next) localStorage.setItem(MINIMIZED_KEY, '1');
      else localStorage.removeItem(MINIMIZED_KEY);
    } catch {
      // Storage blocked: the bar still toggles for this visit
    }
  };

  const toggleButton = (
    <button
      type="button"
      onClick={toggle}
      aria-expanded={!minimized}
      aria-label={minimized ? 'Expand the preview bar' : 'Minimize the preview bar'}
      className="shrink-0 w-11 h-11 -mr-2 rounded-full flex items-center justify-center text-fg-muted hover:text-fg hover:bg-border/60 cursor-pointer"
    >
      {minimized ? <ChevronDown className="w-5 h-5" aria-hidden="true" /> : <ChevronUp className="w-5 h-5" aria-hidden="true" />}
    </button>
  );

  if (minimized) {
    return (
      <aside aria-label="Role preview" className="w-full border-b border-border bg-surface-muted px-4 flex items-center gap-2">
        <p className="flex-1 min-w-0 truncate text-[12px] text-fg">
          <strong className="font-bold">Previewing as {roleLabel(role)}</strong> · display only
        </p>
        <button
          type="button"
          onClick={() => setViewAs(null)}
          className="shrink-0 min-h-[44px] px-2 text-[14px] font-bold text-link underline underline-offset-4 cursor-pointer"
        >
          Exit
        </button>
        {toggleButton}
      </aside>
    );
  }

  return (
    <aside aria-label="Role preview" className="w-full border-b border-border bg-surface-muted px-4 py-2 space-y-1">
      <div className="flex items-start gap-2">
        <p className="flex-1 min-w-0 pt-2 text-[12px] text-fg">
          {demoOn ? (
            <>
              <strong className="font-bold">Playing as {roleLabel(role)}.</strong> In demo mode every button works on the sample data.
            </>
          ) : (
            <>
              <strong className="font-bold">Previewing as {roleLabel(role)}.</strong> Display only; saving follows your real account.
            </>
          )}
        </p>
        {toggleButton}
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <RoleSwitcher compact />
        </div>
        <button
          type="button"
          onClick={() => setViewAs(null)}
          className="shrink-0 min-h-[44px] px-3 text-[14px] font-bold text-link underline underline-offset-4 cursor-pointer"
        >
          Exit
        </button>
      </div>
    </aside>
  );
}
