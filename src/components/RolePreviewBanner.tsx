'use client';

import React from 'react';
import { Eye } from 'lucide-react';
import RoleSwitcher, { roleLabel } from '@/components/RoleSwitcher';
import { useViewAs } from '@/lib/storage';
import { useProfile } from '@/lib/supabase/useProfile';

// Shown on every page while a role preview is on, so it can never be mistaken for the real account.
export default function RolePreviewBanner() {
  const { role, previewRole } = useProfile();
  const [, setViewAs] = useViewAs();

  if (previewRole === null) return null;

  return (
    <aside aria-label="Role preview" className="w-full border-b border-border bg-surface-muted px-4 py-3 space-y-2">
      <p className="flex items-start gap-2 text-[12px] text-fg leading-normal">
        <Eye className="w-4 h-4 mt-px shrink-0 text-fg-muted" aria-hidden="true" />
        <span>
          <strong className="font-semibold">Previewing as {roleLabel(role)}.</strong> This only changes what you see.
          Buttons that save changes still follow your real account.
        </span>
      </p>
      <RoleSwitcher compact />
      <button
        type="button"
        onClick={() => setViewAs(null)}
        className="min-h-[44px] px-2 -mx-2 text-[14px] font-semibold text-link underline underline-offset-4 cursor-pointer"
      >
        Exit preview
      </button>
    </aside>
  );
}
