'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  Camera,
  MapPin,
  Clock,
  ArrowLeft,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Loader2,
  ShieldAlert,
  MessageCircle,
  ExternalLink,
} from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';
import AuthModal from '@/components/AuthModal';
import { createClient } from '@/lib/supabase/client';
import { generateCaseId, formatCoordinates, compressVideoFrame, createSimulatedFrame } from '@/lib/sos/utils';

type AnimalType = 'dog' | 'cat' | 'other';
type EmergencyTier = 'hit_and_run' | 'fracture' | 'sick_mange';

interface EmergencyOption {
  id: EmergencyTier;
  label: string;
  urgency: 'critical' | 'urgent' | 'moderate';
  urgencyLabel: string;
}

const EMERGENCY_TIERS: EmergencyOption[] = [
  {
    id: 'hit_and_run',
    label: 'Hit & Run / Bleeding',
    urgency: 'critical',
    urgencyLabel: 'Critical',
  },
  {
    id: 'fracture',
    label: 'Fracture / Trapped',
    urgency: 'urgent',
    urgencyLabel: 'Urgent',
  },
  {
    id: 'sick_mange',
    label: 'Sick / Severe Mange',
    urgency: 'moderate',
    urgencyLabel: 'Moderate',
  },
];

interface DispatchedReport {
  shortId: string;
  animalType: AnimalType;
  emergencyTier: EmergencyTier;
  urgencyLabel: string;
  previewUrl: string;
  coords: { lat: number; lng: number };
  timestamp: string;
}

// Default development coordinates (Quezon City, Metro Manila)
const DEV_DEFAULT_COORDS = { lat: 14.6091, lng: 121.0223, accuracy: 12 };

export default function SOSCameraPage() {
  // Selection states
  const [animal, setAnimal] = useState<AnimalType>('dog');
  const [emergency, setEmergency] = useState<EmergencyTier>('hit_and_run');

  // Camera states
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraStatus, setCameraStatus] = useState<'starting' | 'active' | 'simulated' | 'denied' | 'unsupported'>('starting');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [shutterFlashing, setShutterFlashing] = useState(false);

  // GPS states (Seamless default for dev without blocking)
  const [coords, setCoords] = useState<{ lat: number; lng: number; accuracy: number }>(DEV_DEFAULT_COORDS);

  // Dispatch lifecycle
  const [dispatchStep, setDispatchStep] = useState<'camera' | 'uploading' | 'success'>('camera');
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  const [dispatchedData, setDispatchedData] = useState<DispatchedReport | null>(null);

  // Staged capture for post-auth continuation
  const [stagedBlob, setStagedBlob] = useState<Blob | null>(null);
  const [stagedPreview, setStagedPreview] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Live clock
  const [currentTime, setCurrentTime] = useState<string>('');

  // 1. Initialize Clock
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  // 2. Initialize Camera Stream (with 2-tier fallback: rear camera -> webcam -> simulated)
  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraStatus('unsupported');
      setCameraError('Camera API not accessible. Use simulated lens for local testing.');
      return;
    }

    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      let stream: MediaStream;
      try {
        // Try rear environment camera first
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
      } catch {
        // Fallback to basic webcam (laptop/front camera)
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setCameraStatus('active');
    } catch (err: unknown) {
      const error = err as Error;
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setCameraStatus('denied');
        setCameraError('Camera access was denied.');
      } else {
        setCameraStatus('unsupported');
        setCameraError('Camera unavailable on this desktop device.');
      }
    }
  }, []);

  const handleRetryCamera = () => {
    setCameraStatus('starting');
    setCameraError(null);
    startCamera();
  };

  const handleUseSimulatedCamera = () => {
    setCameraStatus('simulated');
    setCameraError(null);
  };

  // 3. Initialize GPS (silent background check, keeps default coords without erroring)
  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: Math.round(position.coords.accuracy),
        });
      },
      () => {
        // Silent fallback to DEV_DEFAULT_COORDS without warning banner
      },
      {
        enableHighAccuracy: true,
        timeout: 6000,
        maximumAge: 60000,
      }
    );
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const timer = setTimeout(() => {
      if (!isCancelled) {
        startCamera();
        requestLocation();
      }
    }, 0);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [startCamera, requestLocation]);

  // 4. Perform Dispatch Execution
  const executeDispatch = useCallback(
    async (imageBlob: Blob, previewUrl: string) => {
      setDispatchStep('uploading');
      setDispatchError(null);

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // If user is not authenticated, prompt auth modal and stage payload
      if (!user) {
        setStagedBlob(imageBlob);
        setStagedPreview(previewUrl);
        setIsAuthModalOpen(true);
        setDispatchStep('camera');
        return;
      }

      try {
        const shortId = generateCaseId();
        const selectedTier = EMERGENCY_TIERS.find((t) => t.id === emergency) || EMERGENCY_TIERS[0];

        // 1. Upload compressed photo to Supabase storage bucket `live-snaps`
        const filename = `${user.id}/${Date.now()}-${shortId}.webp`;
        const { error: uploadError } = await supabase.storage.from('live-snaps').upload(filename, imageBlob, {
          contentType: 'image/webp',
          upsert: false,
        });

        if (uploadError) {
          throw new Error(`Photo upload failed: ${uploadError.message}`);
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from('live-snaps').getPublicUrl(filename);

        // Fallback GPS coordinates if device location is unavailable (Manila center default)
        const finalLat = coords ? coords.lat : 14.5995;
        const finalLng = coords ? coords.lng : 120.9842;
        const locationName = coords
          ? `Near ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`
          : 'Manila (GPS approximate)';

        // 2. Insert SOS report into PostgreSQL with atomic server timestamp
        const { error: insertError } = await supabase.from('sos_reports').insert({
          short_id: shortId,
          reporter_id: user.id,
          animal_type: animal,
          emergency_type: emergency,
          urgency: selectedTier.urgency,
          photo_url: publicUrl,
          latitude: finalLat,
          longitude: finalLng,
          location_name: locationName,
        });

        if (insertError) {
          throw new Error(`Database submission failed: ${insertError.message}`);
        }

        // Stop camera tracks once successfully dispatched
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
        }

        setDispatchedData({
          shortId,
          animalType: animal,
          emergencyTier: emergency,
          urgencyLabel: selectedTier.urgencyLabel,
          previewUrl,
          coords: { lat: finalLat, lng: finalLng },
          timestamp: new Date().toLocaleTimeString('en-US', { hour12: true }),
        });

        setDispatchStep('success');
      } catch (err: unknown) {
        const error = err as Error;
        setDispatchError(error.message || 'Emergency dispatch failed. Please try again.');
        setDispatchStep('camera');
      }
    },
    [coords, animal, emergency]
  );

  // 5. Handle Shutter Button Press
  const handleShutterPress = async () => {
    if (cameraStatus !== 'active' && cameraStatus !== 'simulated') return;

    // Trigger shutter flash
    setShutterFlashing(true);
    setTimeout(() => setShutterFlashing(false), 150);

    try {
      const source =
        cameraStatus === 'active' && videoRef.current
          ? videoRef.current
          : createSimulatedFrame(animal, emergency);

      const { blob, previewUrl } = await compressVideoFrame(source, 1280, 0.75);
      await executeDispatch(blob, previewUrl);
    } catch (err: unknown) {
      const error = err as Error;
      setDispatchError(error.message || 'Could not capture photo from lens.');
    }
  };

  // 6. Resume Dispatch after successful auth modal completion
  const handleAuthSuccess = () => {
    setIsAuthModalOpen(false);
    if (stagedBlob && stagedPreview) {
      executeDispatch(stagedBlob, stagedPreview);
      setStagedBlob(null);
      setStagedPreview(null);
    }
  };

  // ---------------------------------------------------------------------------
  // RENDER: Success / Confirmation Screen
  // ---------------------------------------------------------------------------
  if (dispatchStep === 'success' && dispatchedData) {
    return (
      <div className="flex flex-col flex-1 px-4 pt-4 pb-8 space-y-4 max-w-lg mx-auto w-full">
        {/* Top Bar */}
        <div className="flex items-center justify-between pb-1">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-fg-muted hover:text-fg min-w-[44px] min-h-[44px] text-[14px] font-semibold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>Feed</span>
          </Link>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] font-semibold bg-reported-bg text-reported-fg border border-reported-border">
            <span className="w-1.5 h-1.5 rounded-full bg-reported-fg animate-pulse" />
            Reported
          </span>
        </div>

        {/* Dispatch Confirmation Card */}
        <div className="bg-surface border border-border rounded-2xl p-4 shadow-sm space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[12px] font-semibold text-fg-muted uppercase tracking-wider">Emergency Dispatched</p>
              <h1 className="text-[22px] font-semibold text-fg font-mono tracking-tight mt-0.5">
                {dispatchedData.shortId}
              </h1>
            </div>
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
            </div>
          </div>

          {/* Captured Snap Preview & Meta */}
          <div className="flex gap-3 items-center bg-surface-muted rounded-xl p-3 border border-border">
            {/* Thumbnail */}
            {dispatchedData.previewUrl && (
              <div className="w-16 h-16 rounded-lg overflow-hidden border border-border shrink-0 bg-surface">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={dispatchedData.previewUrl}
                  alt="Captured emergency evidence"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className="space-y-1 text-[12px] min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-fg capitalize">{dispatchedData.animalType}</span>
                <span className="text-reported-fg font-semibold">{dispatchedData.urgencyLabel}</span>
              </div>
              <div className="flex items-center gap-1 text-fg-muted font-mono text-[12px] truncate">
                <MapPin className="w-3.5 h-3.5 shrink-0 text-accent" aria-hidden="true" />
                <span>{formatCoordinates(dispatchedData.coords.lat, dispatchedData.coords.lng)}</span>
              </div>
              <div className="flex items-center gap-1 text-fg-muted text-[12px]">
                <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Atomic timestamp: {dispatchedData.timestamp}</span>
              </div>
            </div>
          </div>

          {/* On-Scene First-Aid Advisory (Calm & Clear) */}
          <div className="bg-surface-card border border-border rounded-xl p-3.5 space-y-2">
            <div className="flex items-center gap-1.5 text-accent font-semibold text-[14px]">
              <ShieldAlert className="w-4 h-4 text-accent" aria-hidden="true" />
              <span>While waiting for responders:</span>
            </div>
            <ul className="text-[12px] text-fg-muted space-y-1.5 list-disc pl-4">
              <li>
                <strong className="text-fg font-medium">Keep a safe distance</strong> if the animal is in pain or frightened.
              </li>
              <li>
                <strong className="text-fg font-medium">Do not give human medicine</strong> — paracetamol and ibuprofen are lethal to animals.
              </li>
              <li>
                Cover gently with a clean cloth or carton to keep warm and calm if safe.
              </li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-1">
            <Link
              href="/rafa"
              className="w-full min-h-[48px] rounded-xl bg-accent text-accent-fg font-semibold text-[14px] flex items-center justify-center gap-2 shadow-sm hover:opacity-95 active:scale-[0.99] transition-all"
            >
              <MessageCircle className="w-4 h-4" aria-hidden="true" />
              <span>Ask Rafa for First-Aid Help</span>
            </Link>

            <div className="grid grid-cols-2 gap-2">
              <Link
                href="/"
                className="min-h-[44px] rounded-xl border border-border bg-surface text-fg font-semibold text-[12px] flex items-center justify-center gap-1.5 hover:bg-surface-muted transition-colors"
              >
                <span>View Live Feed</span>
                <ExternalLink className="w-3.5 h-3.5 text-fg-muted" aria-hidden="true" />
              </Link>

              <button
                type="button"
                onClick={() => {
                  setDispatchedData(null);
                  setDispatchStep('camera');
                  startCamera();
                }}
                className="min-h-[44px] rounded-xl border border-border bg-surface text-fg font-semibold text-[12px] flex items-center justify-center gap-1.5 hover:bg-surface-muted transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-fg-muted" aria-hidden="true" />
                <span>Report Another</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // RENDER: Live Camera Viewfinder & Dispatch
  // ---------------------------------------------------------------------------
  return (
    <div className="flex flex-col flex-1 px-4 pt-3 pb-8 space-y-3 max-w-lg mx-auto w-full">
      {/* Shutter flash overlay */}
      {shutterFlashing && (
        <div className="fixed inset-0 bg-white z-50 pointer-events-none transition-opacity duration-150" />
      )}

      {/* Top Header */}
      <div className="flex items-center justify-between pb-0.5">
        <Link
          href="/"
          className="flex items-center gap-1 text-fg-muted hover:text-fg min-w-[44px] min-h-[44px] text-[12px] font-semibold transition-colors"
          aria-label="Back to Feed"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Back</span>
        </Link>
        <div className="text-center">
          <h1 className="text-[16px] font-semibold text-fg">Live SOS Camera</h1>
          <p className="text-[12px] text-fg-muted">Snap & Dispatch</p>
        </div>
        <ThemeToggle />
      </div>

      {/* Viewfinder Frame */}
      <div className="relative flex-1 min-h-[290px] rounded-2xl border border-border bg-black overflow-hidden flex flex-col justify-between shadow-sm">
        {/* Real HTML5 Live Video Stream */}
        {cameraStatus === 'active' && (
          <video
            ref={videoRef}
            playsInline
            autoPlay
            muted
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}

        {/* Simulated Lens Viewfinder (Desktop Dev Mode) */}
        {cameraStatus === 'simulated' && (
          <div className="absolute inset-0 bg-stone-900/95 flex flex-col items-center justify-between p-4 text-center">
            <div className="flex-1 flex flex-col items-center justify-center space-y-2 my-auto">
              <div className="w-24 h-24 border-2 border-dashed border-red-500/60 rounded-2xl flex flex-col items-center justify-center space-y-1 bg-black/40">
                <Camera className="w-8 h-8 text-red-400" aria-hidden="true" />
                <span className="text-[11px] font-mono uppercase text-red-400 font-bold tracking-wider">
                  {animal}
                </span>
              </div>
              <p className="text-[12px] font-medium text-zinc-300">
                Dev Simulated Lens Active
              </p>
            </div>
          </div>
        )}

        {/* Viewfinder Header Badges */}
        <div className="relative z-10 w-full flex items-center justify-between p-3 gap-2">
          {/* Seamless GPS Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-mono bg-black/60 text-white border border-white/20 backdrop-blur-md shadow-sm">
            <MapPin className="w-3.5 h-3.5 shrink-0 text-accent" aria-hidden="true" />
            <span className="truncate max-w-[170px]">
              {coords ? `${coords.lat.toFixed(3)}°, ${coords.lng.toFixed(3)}°` : 'Quezon City (Dev)'}
            </span>
          </div>

          {/* Live Atomic Clock Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-mono bg-black/60 text-white border border-white/20 backdrop-blur-md shadow-sm">
            <Clock className="w-3.5 h-3.5 text-zinc-400" aria-hidden="true" />
            <span className="tabular-nums">{currentTime || 'Syncing...'}</span>
          </div>
        </div>

        {/* Camera Permission / Error Fallback Overlay */}
        {cameraStatus !== 'active' && cameraStatus !== 'simulated' && (
          <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 text-center space-y-3 bg-surface text-fg">
            <div className="w-12 h-12 rounded-full bg-surface-muted border border-border flex items-center justify-center text-fg-muted">
              <Camera className="w-6 h-6" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <h2 className="text-[14px] font-semibold text-fg">
                {cameraStatus === 'denied'
                  ? 'Camera Permission Denied'
                  : cameraStatus === 'starting'
                  ? 'Accessing Camera Lens...'
                  : 'Desktop Camera Unavailable'}
              </h2>
              <p className="text-[12px] text-fg-muted max-w-[260px]">
                {cameraError || 'Use the dev simulated lens to test the emergency flow on your desktop.'}
              </p>
            </div>
            {cameraStatus !== 'starting' && (
              <div className="flex flex-col gap-2 w-full max-w-[220px]">
                <button
                  type="button"
                  onClick={handleUseSimulatedCamera}
                  className="min-h-[44px] px-4 rounded-xl bg-fg text-surface font-semibold text-[12px] hover:opacity-90 active:scale-95 transition-all cursor-pointer shadow-sm"
                >
                  Use Dev Simulated Lens
                </button>
                <button
                  type="button"
                  onClick={handleRetryCamera}
                  className="min-h-[44px] px-4 rounded-xl border border-border bg-surface text-fg font-semibold text-[12px] hover:bg-surface-muted transition-colors cursor-pointer"
                >
                  Retry Camera Access
                </button>
              </div>
            )}
          </div>
        )}

        {/* Viewfinder Center Crosshair (Visual aid for centering the animal) */}
        {(cameraStatus === 'active' || cameraStatus === 'simulated') && (
          <div className="relative z-10 pointer-events-none m-auto flex flex-col items-center justify-center opacity-70">
            <div className="w-24 h-24 border-2 border-white/40 rounded-2xl relative flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-white/80" />
            </div>
            <span className="text-[11px] font-medium text-white/90 drop-shadow mt-1">Center animal</span>
          </div>
        )}

        {/* Viewfinder Bottom Anti-Tampering Notice */}
        <div className="relative z-10 p-2 text-center bg-gradient-to-t from-black/80 to-transparent">
          <p className="text-[11px] font-medium text-zinc-300 tracking-wide">
            Live lens only • No gallery uploads • Database timestamp
          </p>
        </div>
      </div>

      {/* Dev Lens Switcher (Quick 1-tap toggle for desktop testing) */}
      <div className="flex items-center justify-between px-1 text-[12px]">
        <span className="text-fg-muted font-medium">
          Lens: <strong className="text-fg capitalize font-semibold">{cameraStatus}</strong>
        </span>
        <button
          type="button"
          onClick={() => {
            if (cameraStatus === 'simulated') {
              handleRetryCamera();
            } else {
              handleUseSimulatedCamera();
            }
          }}
          className="text-fg hover:text-accent font-semibold cursor-pointer min-h-[36px] flex items-center gap-1 underline underline-offset-4"
        >
          {cameraStatus === 'simulated' ? 'Switch to Live Webcam' : 'Switch to Simulated Lens'}
        </button>
      </div>

      {/* Dispatch Error Banner */}
      {dispatchError && (
        <div className="p-3 rounded-xl bg-reported-bg border border-reported-border text-reported-fg text-[12px] flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{dispatchError}</span>
        </div>
      )}

      {/* Animal Selection (Tap 1) */}
      <div className="space-y-1">
        <label className="text-[12px] font-semibold text-fg-muted">1. Animal Type</label>
        <div className="grid grid-cols-3 gap-2">
          {(['dog', 'cat', 'other'] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setAnimal(type)}
              className={`min-h-[44px] rounded-xl text-[12px] font-semibold capitalize transition-all border cursor-pointer ${
                animal === type
                  ? 'bg-fg text-surface border-fg shadow-sm'
                  : 'bg-surface text-fg border-border hover:bg-surface-muted'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Urgency Selection (Tap 2) */}
      <div className="space-y-1">
        <label className="text-[12px] font-semibold text-fg-muted">2. Severity Level</label>
        <div className="grid grid-cols-3 gap-2">
          {EMERGENCY_TIERS.map((tier) => (
            <button
              key={tier.id}
              type="button"
              onClick={() => setEmergency(tier.id)}
              className={`min-h-[44px] px-2 rounded-xl text-[12px] font-semibold transition-all border cursor-pointer flex flex-col items-center justify-center text-center leading-tight ${
                emergency === tier.id
                  ? 'bg-fg text-surface border-fg shadow-sm'
                  : 'bg-surface text-fg border-border hover:bg-surface-muted'
              }`}
            >
              <span>{tier.label}</span>
              <span
                className={`text-[10px] font-medium mt-0.5 ${
                  tier.urgency === 'critical' ? 'text-reported-fg font-bold' : 'text-fg-muted'
                }`}
              >
                {tier.urgencyLabel}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Shutter Button (Tap 3: Snap & Dispatch) */}
      <div className="pt-2 flex flex-col items-center justify-center space-y-2">
        <button
          type="button"
          id="shutter-button"
          disabled={(cameraStatus !== 'active' && cameraStatus !== 'simulated') || dispatchStep === 'uploading'}
          onClick={handleShutterPress}
          className="w-16 h-16 min-w-[48px] min-h-[48px] rounded-full bg-accent hover:opacity-90 active:scale-95 disabled:opacity-50 text-accent-fg shadow-lg shadow-red-500/30 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-accent transition-transform border-none cursor-pointer"
          aria-label="Capture live photo and dispatch emergency"
        >
          {dispatchStep === 'uploading' ? (
            <Loader2 className="w-7 h-7 text-accent-fg animate-spin" aria-hidden="true" />
          ) : (
            <Camera className="w-7 h-7 text-accent-fg" aria-hidden="true" />
          )}
        </button>
        <p className="text-[11px] text-fg-muted font-medium text-center">
          Tap shutter to snap & dispatch immediately
        </p>
      </div>

      {/* Auth Modal for Unauthenticated Bystanders */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
      />
    </div>
  );
}
