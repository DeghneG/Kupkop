'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, RotateCcw } from 'lucide-react';
import { compressVideoFrame, createSimulatedFrame } from '@/lib/sos/utils';
import { isDemoOn } from '@/lib/demo/demo';

interface LiveCameraCaptureProps {
  /** The photo taken just now, or null after Retake */
  onChange: (photo: Blob | null) => void;
  disabled?: boolean;
}

type Status = 'idle' | 'starting' | 'active' | 'denied' | 'unsupported';

// A photo taken with the camera right now. There is deliberately no file picker, so nothing can be chosen from the
// gallery. (A web page cannot prove a picture is live, but it offers no other way in.)
// In demo mode only, a labelled demo photo can stand in when there is no camera.
export default function LiveCameraCapture({ onChange, disabled }: LiveCameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [preview, setPreview] = useState<string | null>(null);
  const demo = isDemoOn();

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // Release the camera when the form closes
  useEffect(() => stop, [stop]);
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const open = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('unsupported');
      return;
    }
    setStatus('starting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      streamRef.current = stream;
      setStatus('active');
      // The video element exists once the status is active; attach on the next frame
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      });
    } catch {
      setStatus('denied');
    }
  };

  const take = async () => {
    const video = videoRef.current;
    if (!video) return;
    const { blob, previewUrl } = await compressVideoFrame(video, 1280, 0.75);
    stop();
    setPreview(previewUrl);
    setStatus('idle');
    onChange(blob);
  };

  const useDemoPhoto = async () => {
    const { blob, previewUrl } = await compressVideoFrame(createSimulatedFrame('dog', 'fracture'), 640, 0.7);
    setPreview(previewUrl);
    onChange(blob);
  };

  const retake = () => {
    setPreview(null);
    onChange(null);
    setStatus('idle');
  };

  const button =
    'w-full min-h-[44px] rounded-xl border border-border bg-surface hover:bg-surface-muted text-fg font-semibold text-[14px] cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2';

  return (
    <div className="space-y-2">
      <p className="text-[12px] font-semibold text-fg">Photo of the animal (required, taken now with the camera)</p>

      {preview ? (
        <div className="space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- local preview of the photo just taken */}
          <img src={preview} alt="The photo you just took" className="w-full max-w-[320px] rounded-xl border border-border" />
          <button type="button" onClick={retake} disabled={disabled} className={button}>
            <RotateCcw className="w-4 h-4 text-fg-muted" aria-hidden="true" />
            <span>Retake photo</span>
          </button>
        </div>
      ) : status === 'active' ? (
        <div className="space-y-2">
          <video ref={videoRef} playsInline muted className="w-full max-w-[320px] rounded-xl border border-border bg-black" aria-label="Camera view" />
          <button type="button" onClick={take} disabled={disabled} className="w-full min-h-[48px] rounded-xl bg-action text-action-fg font-semibold text-[14px] flex items-center justify-center gap-2 cursor-pointer">
            <Camera className="w-5 h-5" aria-hidden="true" />
            <span>Take photo</span>
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <button type="button" onClick={open} disabled={disabled || status === 'starting'} className={button}>
            <Camera className="w-4 h-4 text-fg-muted" aria-hidden="true" />
            <span>{status === 'starting' ? 'Opening the camera…' : 'Open camera'}</span>
          </button>
          {(status === 'denied' || status === 'unsupported') && (
            <p role="alert" className="text-[12px] font-semibold text-fg">
              {status === 'denied'
                ? 'The camera is blocked. Allow the camera for this site in your browser settings, then tap Open camera.'
                : 'This browser cannot open the camera. Open KupKop in Chrome or Safari.'}
            </p>
          )}
          {demo && (
            <button type="button" onClick={useDemoPhoto} disabled={disabled} className={`${button} border-transparent bg-transparent text-fg-muted font-normal underline underline-offset-4`}>
              Demo only: use a demo photo
            </button>
          )}
        </div>
      )}
    </div>
  );
}
