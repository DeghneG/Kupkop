'use client';

import React from 'react';
import RoleSwitcher, { roleLabel } from '@/components/RoleSwitcher';
import { useViewAs } from '@/lib/storage';
import { useProfile } from '@/lib/supabase/useProfile';

// Shown on every page while a role preview is on, so it can never be mistaken for the real account.
// One compact strip: what is on, the switcher, and the way out.
export default function RolePreviewBanner() {
  const { role, previewRole } = useProfile();
  const [, setViewAs] = useViewAs();

  if (previewRole === null) return null;

  return (
    <aside aria-label="Role preview" className="w-full border-b border-border bg-surface-muted px-4 py-2 space-y-1">
      <p className="text-[12px] text-fg">
        <strong className="font-bold">Previewing as {roleLabel(role)}.</strong> Display only; saving follows your real account.
      </p>
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
