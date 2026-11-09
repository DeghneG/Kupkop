'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Car, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { compressVideoFrame } from '@/lib/sos/utils';
import { useFocusTrap } from '@/lib/useFocusTrap';
import InlineError from '@/components/InlineError';

type Handoff = { id: string; note: string; plate_photo_path: string; created_at: string };

interface HandoffPanelProps {
  reportId: string;
  userId: string | null;
  /** Reporter or claimer of an open or claimed case may record a handoff */
  canHandOff: boolean;
}

// Bystander handoff: the animal leaves with someone else (a driver, a neighbor). A live photo of their
// vehicle plate is kept privately: only the reporter, the rescuer who took it and admins can see it.
export default function HandoffPanel({ reportId, userId, canHandOff }: HandoffPanelProps) {
  const [handoffs, setHandoffs] = useState<Handoff[]>([]);
  const [open, setOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    // RLS returns rows only to the people allowed to see them; everyone else gets none
    createClient()
      .from('handoffs')
      .select('id,note,plate_photo_path,created_at')
      .eq('report_id', reportId)
      .order('created_at', { ascending: false })
      .then(({ data }) => active && setHandoffs((data ?? []) as Handoff[]));
    return () => {
      active = false;
    };
  }, [reportId, userId, reloadKey]);

  const viewPlate = async (path: string) => {
    const { data } = await createClient().storage.from('plate-photos').createSignedUrl(path, 120);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener');
  };

  if (!canHandOff && handoffs.length === 0) return null;

  return (
    <div className="space-y-2">
      {handoffs.map((h) => (
        <div key={h.id} className="rounded-xl border border-border p-3 space-y-1">
          <p className="text-[12px] font-semibold text-fg flex items-center gap-2">
            <Car className="w-4 h-4 text-fg-muted" aria-hidden="true" />
            Handed off {new Date(h.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
          </p>
          <p className="text-[14px] text-fg">{h.note}</p>
          <button
            type="button"
            onClick={() => viewPlate(h.plate_photo_path)}
            className="min-h-[44px] text-[14px] font-semibold text-link underline underline-offset-4 cursor-pointer"
          >
            View plate photo (private)
          </button>
        </div>
      ))}
      {canHandOff && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full min-h-[44px] rounded-xl border border-border bg-surface hover:bg-surface-muted text-fg font-semibold text-[14px] flex items-center justify-center gap-2 cursor-pointer"
        >
          <Car className="w-4 h-4 text-fg-muted" aria-hidden="true" />
          Hand off to someone else
        </button>
      )}
      {open && userId && (
        <HandoffSheet
          reportId={reportId}
          userId={userId}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            setReloadKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}

function HandoffSheet({
  reportId,
  userId,
  onClose,
  onSaved,
}: {
  reportId: string;
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, true);
  const [camera, setCamera] = useState<'starting' | 'on' | 'off'>('starting');
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setCamera('on');
    } catch {
      setCamera('off');
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(startCamera, 0);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
      stopCamera();
    };
  }, [startCamera, stopCamera, onClose]);

  const capture = async () => {
    if (!videoRef.current) return;
    try {
      const { blob, previewUrl } = await compressVideoFrame(videoRef.current, 1280, 0.75);
      stopCamera();
      setPhoto({ blob, url: previewUrl });
    } catch {
      setError('Could not take the photo. Try again.');
    }
  };

  const retake = () => {
    if (photo) URL.revokeObjectURL(photo.url);
    setPhoto(null);
    setCamera('starting');
    startCamera();
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!photo) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const ext = photo.blob.type === 'image/jpeg' ? 'jpg' : 'webp';
    const path = `${userId}/${reportId}-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from('plate-photos')
      .upload(path, photo.blob, { contentType: photo.blob.type || 'image/webp', upsert: false });
    if (uploadError) {
      setBusy(false);
      setError(`Photo upload failed: ${uploadError.message}`);
      return;
    }
    const { error: insertError } = await supabase
      .from('handoffs')
      .insert({ report_id: reportId, created_by: userId, note: note.trim(), plate_photo_path: path });
    setBusy(false);
    if (insertError) {
      setError('Could not save the handoff. Only the reporter or the rescuer can hand off an open case.');
      return;
    }
    onSaved();
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="handoff-title" className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="fixed inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        className="relative z-10 w-full max-w-md bg-surface border-t sm:border border-border rounded-t-[24px] sm:rounded-[24px] p-4 pb-[calc(1rem+env(safe-area-inset-bottom,16px))] max-h-[92vh] overflow-y-auto space-y-3"
      >
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <h2 id="handoff-title" className="text-[22px] font-semibold text-fg leading-tight">
              Hand off the animal
            </h2>
            <p className="text-[12px] text-fg-muted mt-1">
              Take a live photo of the vehicle plate of the person taking the animal. Only you, the reporter and admins can
              see it. Prototype: use a fake or covered plate.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-11 h-11 shrink-0 rounded-full flex items-center justify-center text-fg-muted bg-surface-muted hover:text-fg cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black flex items-center justify-center">
          {photo ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={photo.url} alt="Captured plate photo" className="w-full h-full object-cover" />
          ) : (
            <video ref={videoRef} playsInline muted autoPlay className={`w-full h-full object-cover ${camera === 'on' ? '' : 'hidden'}`} />
          )}
          {!photo && camera !== 'on' && (
            <p className="absolute inset-0 flex items-center justify-center p-4 text-center text-[14px] text-white">
              {camera === 'starting' ? 'Opening camera…' : 'Camera blocked. Allow camera access for this site to take the plate photo.'}
            </p>
          )}
        </div>

        {photo ? (
          <button
            type="button"
            onClick={retake}
            className="w-full min-h-[44px] rounded-xl border border-border bg-surface hover:bg-surface-muted text-fg font-semibold text-[14px] cursor-pointer"
          >
            Retake
          </button>
        ) : (
          <button
            type="button"
            onClick={capture}
            disabled={camera !== 'on'}
            className="w-full min-h-[48px] rounded-xl bg-fg text-page font-semibold text-[14px] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Camera className="w-4 h-4" aria-hidden="true" />
            Take plate photo
          </button>
        )}

        <form onSubmit={save} className="space-y-3">
          <label className="block space-y-1">
            <span className="text-[12px] font-semibold text-fg">Who took the animal, and where are they going? (5–300 characters)</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              minLength={5}
              maxLength={300}
              rows={2}
              required
              placeholder="e.g. Tricycle driver taking it to Test Clinic A on Katipunan"
              className="w-full rounded-xl border border-border bg-surface-muted text-fg text-[14px] p-3 focus:outline-none focus:ring-2 focus:ring-action"
            />
          </label>
          {error && <InlineError>{error}</InlineError>}
          <button
            type="submit"
            disabled={!photo || busy || note.trim().length < 5}
            className="w-full min-h-[48px] rounded-xl bg-action text-action-fg font-semibold text-[14px] cursor-pointer disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save handoff'}
          </button>
        </form>
      </div>
    </div>
  );
}
