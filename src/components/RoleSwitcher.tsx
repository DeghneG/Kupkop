'use client';

import React from 'react';
import { useViewAs, type ViewAsRole } from '@/lib/storage';
import { useProfile } from '@/lib/supabase/useProfile';

export const ROLE_OPTIONS: { id: ViewAsRole; label: string; sees: string }[] = [
  {
    id: 'citizen',
    label: 'Citizen',
    sees: 'Reports emergencies, flags a case, and can apply to be a volunteer. No Claim buttons.',
  },
  {
    id: 'volunteer',
    label: 'Volunteer',
    sees: 'Claim buttons on open cases, a rescue area and alerts in Settings, and Admit / Release on their own claim.',
  },
  {
    id: 'facility',
    label: 'Clinic staff',
    sees: 'The Clinic care page: animals waiting for intake, recovery updates and the 14-day clock.',
  },
  {
    id: 'admin',
    label: 'Admin',
    sees: 'Everything above, plus the Admin page: applications, flags, users, clinics and handoffs.',
  },
];

export const roleLabel = (role: ViewAsRole) => ROLE_OPTIONS.find((o) => o.id === role)?.label ?? role;

// Display-only preview of each role. It changes what the screens show; the database still enforces the
// real account's permissions, so saving buttons only work if the real account is allowed to.
export default function RoleSwitcher({ compact = false }: { compact?: boolean }) {
  const { role, previewRole } = useProfile();
  const [, setViewAs] = useViewAs();

  // The preview stays on (with its banner) until Exit preview, even when you pick your own role
  const choose = (next: ViewAsRole) => {
    if (previewRole === null && next === role) return;
    setViewAs(next);
  };
  const selected = ROLE_OPTIONS.find((o) => o.id === role);

  return (
    <div className="space-y-2">
      <div role="radiogroup" aria-label="Preview as role" className={`grid gap-2 ${compact ? 'grid-cols-4' : 'grid-cols-2'}`}>
        {ROLE_OPTIONS.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={role === o.id}
            onClick={() => choose(o.id)}
            className={`min-h-[44px] rounded-xl border font-semibold text-center leading-tight cursor-pointer transition-colors ${
              compact ? 'px-1 text-[12px]' : 'px-3 text-[14px]'
            } ${
              role === o.id
                ? 'bg-fg text-page border-fg'
                : 'bg-surface text-fg border-border hover:bg-surface-muted'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      {!compact && selected && (
        <p aria-live="polite" className="text-[12px] text-fg-muted leading-normal">
          <span className="font-semibold text-fg">{selected.label}:</span> {selected.sees}
        </p>
      )}
    </div>
  );
}
