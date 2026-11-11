'use client';

import React from 'react';
import { createClient } from '@/lib/supabase/client';
import { detailLines, type UpdateDetails as Details } from '@/lib/sos/recovery';

export type DocumentedUpdate = Details & { photo_url?: string | null };

/** A stored path becomes a public address; the demo keeps a data URL, which is used as is. */
export function recoveryPhotoSrc(photo: string): string {
  if (photo.startsWith('data:') || photo.startsWith('http')) return photo;
  return createClient().storage.from('recovery-photos').getPublicUrl(photo).data.publicUrl;
}

/** The photo and labelled details under one recovery update. Renders nothing when there are none. */
export default function UpdateDetails({ update, alt }: { update: DocumentedUpdate; alt: string }) {
  const lines = detailLines(update);
  if (!update.photo_url && lines.length === 0) return null;
  return (
    <div className="space-y-2 pt-1">
      {update.photo_url && (
        // eslint-disable-next-line @next/next/no-img-element -- user photo from storage or a local data URL
        <img src={recoveryPhotoSrc(update.photo_url)} alt={alt} loading="lazy" className="w-full max-w-[320px] rounded-xl border border-border object-cover" />
      )}
      {lines.length > 0 && (
        <dl className="space-y-0.5">
          {lines.map((l) => (
            <div key={l.label} className="flex gap-2 text-[12px] leading-snug">
              <dt className="text-fg-muted shrink-0">{l.label}</dt>
              <dd className="text-fg font-semibold">{l.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
