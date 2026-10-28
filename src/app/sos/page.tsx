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

// The simulated lens exists only for desktop testing; real reports must come from the live camera
const SHOW_DEV_LENS = process.env.NODE_ENV === 'development';

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

export default function SOSCameraPage() {
  // Selection states
  const [animal, setAnimal] = useState<AnimalType>('dog');
  const [emergency, setEmergency] = useState<EmergencyTier>('hit_and_run');

  // Camera states
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [cameraStatus, setCameraStatus] = useState<'starting' | 'active' | 'simulated' | 'denied' | 'unsupported'>('starting');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [shutterFlashing, setShutterFlashing] = useState(false);

  // Dispatch lifecycle
  const [dispatchStep, setDispatchStep] = useState<'camera' | 'review' | 'uploading' | 'success'>('camera');
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  const [dispatchedData, setDispatchedData] = useState<DispatchedReport | null>(null);

  // Bind media stream to video DOM element whenever stream or screen view updates
  useEffect(() => {
    if (dispatchStep === 'camera' && videoRef.current && mediaStream) {
      if (videoRef.current.srcObject !== mediaStream) {
        videoRef.current.srcObject = mediaStream;
      }
      videoRef.current.play().catch(() => {});
    }
  }, [mediaStream, dispatchStep]);

  // GPS states (real-time accurate location tracking)
  const [coords, setCoords] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [resolvedAddress, setResolvedAddress] = useState<string>('');
  const [locationText, setLocationText] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [gpsStatus, setGpsStatus] = useState<'acquiring' | 'locked' | 'denied' | 'unavailable' | 'unsupported'>('acquiring');

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

  // 2. Initialize Camera Stream (with IR camera avoidance and multi-device selection)
  const startCamera = useCallback(async (explicitDeviceId?: string) => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraStatus('unsupported');
      setCameraError('Camera API not accessible on this browser.');
      return;
    }

    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      // Enumerate available video inputs
      let videoInputs: MediaDeviceInfo[] = [];
      try {
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        videoInputs = allDevices.filter((d) => d.kind === 'videoinput');
        setAvailableCameras(videoInputs);
      } catch {
        // Enumerate fallback
      }

      // Filter out Windows Hello IR/Infrared cameras that fail RGB streaming
      const nonIrCameras = videoInputs.filter((d) => !/ir|infrared/i.test(d.label));
      const targetCam = explicitDeviceId
        ? videoInputs.find((d) => d.deviceId === explicitDeviceId)
        : nonIrCameras[0] || videoInputs[0];

      const isMobile =
        typeof window !== 'undefined' &&
        /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

      let videoConstraint: MediaTrackConstraints | boolean = true;
      if (targetCam && targetCam.deviceId) {
        videoConstraint = { deviceId: { exact: targetCam.deviceId } };
        setSelectedCameraId(targetCam.deviceId);
      } else if (isMobile) {
        videoConstraint = { facingMode: { ideal: 'environment' } };
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraint,
        audio: false,
      });

      streamRef.current = stream;
      setMediaStream(stream);
      setCameraStatus('active');
      setCameraError(null);
    } catch (err: unknown) {
      const error = err as Error;
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setCameraStatus('denied');
        setCameraError('Camera access was denied in browser permissions.');
      } else if (error.name === 'NotReadableError' || error.message?.includes('video source')) {
        setCameraStatus('unsupported');
        setCameraError('Camera is busy: Another app (Zoom, Teams, Discord, or Windows Camera) may be locking it.');
      } else {
        setCameraStatus('unsupported');
        setCameraError(error.message || 'Camera is in use by another app or unavailable.');
      }
    }
  }, []);

  const handleRetryCamera = (deviceId?: string) => {
    setCameraStatus('starting');
    setCameraError(null);
    startCamera(deviceId || selectedCameraId);
  };

  const handleUseSimulatedCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setMediaStream(null);
    }
    setCameraStatus('simulated');
    setCameraError(null);
  };

  // 3. Initialize GPS with progressive accuracy (High accuracy first, network fallback, and continuous watch)
  const requestLocation = useCallback(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setGpsStatus('unsupported');
      return;
    }

    setGpsStatus('acquiring');

    const handleSuccess = async (position: GeolocationPosition) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const acc = Math.round(position.coords.accuracy);

      setCoords({ lat, lng, accuracy: acc });
      setGpsStatus('locked');

      // Reverse geocode to get human-readable street / district
      try {
        const res = await fetch(`/api/geocode/reverse?lat=${lat}&lng=${lng}`);
        if (res.ok) {
          const data = await res.json();
          if (data.formatted) {
            setResolvedAddress(data.formatted);
            setLocationText((prev) => (prev ? prev : data.formatted));
          }
        }
      } catch {
        // Fallback silently if geocoding fails
      }
    };

    // First attempt: High accuracy GPS
    navigator.geolocation.getCurrentPosition(
      handleSuccess,
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setGpsStatus('denied');
        } else {
          // If high accuracy times out (common on desktop/laptop WiFi), fallback to standard accuracy
          navigator.geolocation.getCurrentPosition(
            handleSuccess,
            (fallbackErr) => {
              setGpsStatus(fallbackErr.code === fallbackErr.PERMISSION_DENIED ? 'denied' : 'unavailable');
            },
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 }
          );
        }
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );

    // Watch position for live movements and refined accuracy
    try {
      const watchId = navigator.geolocation.watchPosition(
        handleSuccess,
        () => {},
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    } catch {
      // ignore watch registration failure
    }
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
      // A report without a real GPS fix would send responders to the wrong place, so it never goes out
      if (!coords) {
        setDispatchError(
          gpsStatus === 'denied'
            ? 'Location is blocked. Allow location for this site in your browser settings, then tap Update GPS.'
            : 'Still finding your location. Wait for the GPS lock, then dispatch.'
        );
        setDispatchStep('review');
        return;
      }

      setDispatchStep('uploading');
      setDispatchError(null);

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // If user is not authenticated, prompt auth modal and keep review screen
      if (!user) {
        setStagedBlob(imageBlob);
        setStagedPreview(previewUrl);
        setIsAuthModalOpen(true);
        setDispatchStep('review');
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

        // Device GPS only; the feed shows "Pinned location" when no street name was resolved
        const finalLat = coords.lat;
        const finalLng = coords.lng;
        const finalLocationName =
          locationText.trim() || resolvedAddress || `Near ${finalLat.toFixed(5)}, ${finalLng.toFixed(5)}`;

        // 2. Insert SOS report into PostgreSQL with atomic server timestamp
        let insertPayload: Record<string, unknown> = {
          short_id: shortId,
          reporter_id: user.id,
          animal_type: animal,
          emergency_type: emergency,
          urgency: selectedTier.urgency,
          photo_url: publicUrl,
          latitude: finalLat,
          longitude: finalLng,
          location_name: finalLocationName,
        };

        if (description.trim()) {
          insertPayload.description = description.trim();
        }

        let { error: insertError } = await supabase.from('sos_reports').insert(insertPayload);

        // Fallback if description column has not been added to schema yet: combine into location_name
        if (insertError && (insertError.code === '42703' || insertError.message?.includes('description'))) {
          insertPayload = {
            short_id: shortId,
            reporter_id: user.id,
            animal_type: animal,
            emergency_type: emergency,
            urgency: selectedTier.urgency,
            photo_url: publicUrl,
            latitude: finalLat,
            longitude: finalLng,
            location_name: description.trim()
              ? `${finalLocationName} — ${description.trim()}`
              : finalLocationName,
          };
          const retryRes = await supabase.from('sos_reports').insert(insertPayload);
          insertError = retryRes.error;
        }

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
        setDispatchStep('review');
      }
    },
    [coords, gpsStatus, animal, emergency, resolvedAddress, locationText, description, setDispatchStep]
  );

  // 5. Handle Shutter Button Press (Snaps evidence & shows Confirmation / Review option)
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
      setStagedBlob(blob);
      setStagedPreview(previewUrl);
      setDispatchError(null);
      setDispatchStep('review');
    } catch (err: unknown) {
      const error = err as Error;
      setDispatchError(error.message || 'Could not capture photo from lens.');
    }
  };

  // 6. Handle Retake Photo (discards staged snap and returns to viewfinder)
  const handleRetakePhoto = () => {
    if (stagedPreview) {
      URL.revokeObjectURL(stagedPreview);
    }
    setStagedBlob(null);
    setStagedPreview(null);
    setDispatchError(null);
    setDispatchStep('camera');

    // Ensure the stream is alive and video element receives the tracks
    const tracks = streamRef.current?.getTracks() || [];
    const isAlive = tracks.length > 0 && tracks.some((t) => t.readyState === 'live');

    if (cameraStatus === 'active' && !isAlive) {
      startCamera(selectedCameraId);
    } else if (cameraStatus === 'active' && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  };

  // 7. Resume Dispatch after successful auth modal completion
  const handleAuthSuccess = () => {
    setIsAuthModalOpen(false);
    if (stagedBlob && stagedPreview) {
      executeDispatch(stagedBlob, stagedPreview);
      setStagedBlob(null);
      setStagedPreview(null);
    }
  };

  // ---------------------------------------------------------------------------
  // RENDER: Review & Confirmation Screen (Option before posting)
  // ---------------------------------------------------------------------------
  if ((dispatchStep === 'review' || dispatchStep === 'uploading') && stagedPreview) {
    return (
      <div className="flex flex-col flex-1 px-4 pt-3 pb-6 space-y-3 max-w-lg mx-auto w-full">
        {/* Top Bar */}
        <div className="flex items-center justify-between pb-0.5">
          <button
            type="button"
            disabled={dispatchStep === 'uploading'}
            onClick={handleRetakePhoto}
            className="flex items-center gap-2 text-fg-muted hover:text-fg min-w-[44px] min-h-[44px] text-[12px] font-semibold transition-colors cursor-pointer disabled:opacity-50"
            aria-label="Retake Photo"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>Retake</span>
          </button>
          <div className="text-center">
            <h1 className="text-[16px] font-semibold text-fg">Confirm Emergency</h1>
            <p className="text-[12px] text-fg-muted">Review before dispatch</p>
          </div>
          <div className="w-11" aria-hidden="true" />
        </div>

        {/* Captured Photo Preview Card */}
        <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-sm">
          <div className="relative aspect-video w-full bg-black flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={stagedPreview}
              alt="Captured emergency evidence"
              className="w-full h-full object-cover"
            />
            {/* Overlay Badges */}
            <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-2 text-[12px] font-mono text-white pointer-events-none">
              <span className="bg-black/65 backdrop-blur-md px-3 py-1 rounded-full border border-white/20 flex items-center gap-2">
                <MapPin className="w-3 h-3 text-white/70 shrink-0" aria-hidden="true" />
                {coords ? (
                  <span>
                    {coords.lat.toFixed(4)}°, {coords.lng.toFixed(4)}° (±{coords.accuracy}m)
                  </span>
                ) : (
                  <span>Acquiring GPS...</span>
                )}
              </span>
              <span className="bg-black/65 backdrop-blur-md px-3 py-1 rounded-full border border-white/20 flex items-center gap-1">
                <Clock className="w-3 h-3 text-white/70 shrink-0" />
                {currentTime}
              </span>
            </div>
          </div>

          {/* Location Verification Banner */}
          <div className="p-3 bg-surface-muted border-t border-border flex items-center justify-between gap-3 text-[12px]">
            <div className="flex items-center gap-2 truncate">
              <MapPin className="w-4 h-4 text-fg-muted shrink-0" aria-hidden="true" />
              <div className="truncate">
                <p className={`font-semibold truncate ${coords ? 'text-fg' : 'text-reported-fg'}`}>
                  {resolvedAddress ||
                    (coords
                      ? `${coords.lat.toFixed(4)}°, ${coords.lng.toFixed(4)}°`
                      : gpsStatus === 'denied'
                        ? 'Location blocked: allow it in browser settings'
                        : gpsStatus === 'unavailable' || gpsStatus === 'unsupported'
                          ? 'No GPS fix yet: move to open sky, then Update GPS'
                          : 'Finding your location…')}
                </p>
                {coords && (
                  <p className="text-[12px] text-fg-muted font-mono">
                    Accurate to within {coords.accuracy} meters
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={requestLocation}
              className="text-[12px] font-semibold text-link underline shrink-0 cursor-pointer"
            >
              Update GPS
            </button>
          </div>

          <div className="p-4 space-y-3">
            {/* Animal Selection */}
            <div className="space-y-1">
              <label className="text-[12px] font-semibold text-fg-muted">Animal</label>
              <div className="grid grid-cols-3 gap-2">
                {(['dog', 'cat', 'other'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    disabled={dispatchStep === 'uploading'}
                    onClick={() => setAnimal(type)}
                    className={`min-h-[40px] rounded-xl text-[12px] font-semibold capitalize transition-all border cursor-pointer ${
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

            {/* Severity Selection */}
            <div className="space-y-1">
              <label className="text-[12px] font-semibold text-fg-muted">Severity</label>
              <div className="grid grid-cols-3 gap-2">
                {EMERGENCY_TIERS.map((tier) => (
                  <button
                    key={tier.id}
                    type="button"
                    disabled={dispatchStep === 'uploading'}
                    onClick={() => setEmergency(tier.id)}
                    className={`min-h-[40px] px-1 rounded-xl text-[12px] font-semibold transition-all border cursor-pointer flex flex-col items-center justify-center text-center leading-tight ${
                      emergency === tier.id
                        ? 'bg-fg text-surface border-fg shadow-sm'
                        : 'bg-surface text-fg border-border hover:bg-surface-muted'
                    }`}
                  >
                    <span>{tier.label.split('/')[0].trim()}</span>
                    <span
                      className={`text-[12px] font-normal mt-0.5 ${
                        tier.urgency === 'critical' ? 'text-reported-fg font-semibold' : 'text-fg-muted'
                      }`}
                    >
                      {tier.urgencyLabel}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Actual Street Location */}
            <div className="space-y-1">
              <label htmlFor="review-location-input" className="text-[12px] font-semibold text-fg-muted">
                Street or landmark
              </label>
              <div className="relative">
                <input
                  id="review-location-input"
                  type="text"
                  value={locationText}
                  onChange={(e) => setLocationText(e.target.value)}
                  placeholder="e.g., Aurora Blvd near J. Ruiz, San Juan"
                  className="w-full min-h-[42px] px-4 pl-9 text-[14px] bg-surface text-fg rounded-xl border border-border outline-none focus:ring-2 focus:ring-action"
                />
                <MapPin className="w-4 h-4 text-fg-muted absolute left-3 top-3" aria-hidden="true" />
              </div>
            </div>

            {/* 4. Scene Description & Landmark */}
            <div className="space-y-1">
              <label htmlFor="review-description-input" className="text-[12px] font-semibold text-fg-muted">
                Notes for the responder
              </label>
              <textarea
                id="review-description-input"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., In front of red car, lying under mango tree, bleeding on left paw..."
                className="w-full p-3 text-[14px] bg-surface text-fg rounded-xl border border-border outline-none focus:ring-2 focus:ring-action resize-none placeholder:text-fg-muted/60"
              />
            </div>
          </div>
        </div>

        {/* Dispatch Error Banner */}
        {dispatchError && (
          <div className="p-3 rounded-xl bg-reported-bg border border-reported-fg/20 text-reported-fg text-[12px] flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{dispatchError}</span>
          </div>
        )}

        {/* Confirmation Buttons: Dispatch or Retake */}
        <div className="space-y-2 pt-1">
          <button
            type="button"
            disabled={dispatchStep === 'uploading' || !coords}
            onClick={() => stagedBlob && stagedPreview && executeDispatch(stagedBlob, stagedPreview)}
            className="w-full min-h-[48px] rounded-xl bg-accent text-accent-fg font-semibold text-[14px] flex items-center justify-center gap-2 shadow-sm hover:opacity-95 active:scale-[0.99] disabled:opacity-60 transition-all cursor-pointer"
          >
            {dispatchStep === 'uploading' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-accent-fg" aria-hidden="true" />
                <span>Posting Emergency Report...</span>
              </>
            ) : coords ? (
              <span>Dispatch Emergency Report</span>
            ) : gpsStatus === 'acquiring' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-accent-fg" aria-hidden="true" />
                <span>Waiting for GPS…</span>
              </>
            ) : (
              <span>Location needed to dispatch</span>
            )}
          </button>

          <button
            type="button"
            disabled={dispatchStep === 'uploading'}
            onClick={handleRetakePhoto}
            className="w-full min-h-[44px] rounded-xl border border-border bg-surface text-fg font-semibold text-[12px] flex items-center justify-center gap-2 hover:bg-surface-muted disabled:opacity-60 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-fg-muted" aria-hidden="true" />
            <span>Retake Photo</span>
          </button>
        </div>

        {/* Auth Modal for unauthenticated citizen */}
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          onSuccess={handleAuthSuccess}
        />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // RENDER: Success / Confirmation Screen
  // ---------------------------------------------------------------------------
  if (dispatchStep === 'success' && dispatchedData) {
    return (
      <div className="flex flex-col flex-1 px-4 pt-3 pb-6 space-y-4 max-w-lg mx-auto w-full">
        {/* Top Bar */}
        <div className="flex items-center justify-between pb-1">
          <Link
            href="/"
            className="flex items-center gap-2 text-fg-muted hover:text-fg min-w-[44px] min-h-[44px] text-[14px] font-semibold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>Feed</span>
          </Link>
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[12px] font-semibold bg-reported-bg text-reported-fg border border-reported-fg/20">
            <span className="w-1.5 h-1.5 rounded-full bg-reported-fg" />
            Reported
          </span>
        </div>

        {/* Dispatch Confirmation Card */}
        <div className="bg-surface border border-border rounded-2xl p-4 shadow-sm space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-[22px] font-semibold text-fg tracking-tight">Report sent</h1>
              <p className="text-[14px] text-fg-muted font-mono mt-1">Case #{dispatchedData.shortId}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-resolved-bg text-resolved-fg flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
            </div>
          </div>

          {/* Captured Snap Preview & Meta */}
          <div className="flex gap-3 items-center">
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
                <MapPin className="w-3.5 h-3.5 shrink-0 text-fg-muted" aria-hidden="true" />
                <span>{formatCoordinates(dispatchedData.coords.lat, dispatchedData.coords.lng)}</span>
              </div>
              <div className="flex items-center gap-1 text-fg-muted text-[12px]">
                <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Atomic timestamp: {dispatchedData.timestamp}</span>
              </div>
            </div>
          </div>

          {/* On-Scene First-Aid Advisory (Calm & Clear) */}
          <div className="pt-4 border-t border-border space-y-2">
            <div className="flex items-center gap-2 text-fg font-semibold text-[14px]">
              <ShieldAlert className="w-4 h-4 text-fg-muted" aria-hidden="true" />
              <span>While waiting for responders:</span>
            </div>
            <ul className="text-[12px] text-fg-muted space-y-2 list-disc pl-4">
              <li>
                <strong className="text-fg font-normal">Keep a safe distance</strong> if the animal is in pain or frightened.
              </li>
              <li>
                <strong className="text-fg font-normal">Do not give human medicine</strong> — paracetamol and ibuprofen are lethal to animals.
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
              className="w-full min-h-[48px] rounded-xl bg-action text-action-fg font-semibold text-[14px] flex items-center justify-center gap-2 shadow-sm hover:opacity-95 active:scale-[0.99] transition-all"
            >
              <MessageCircle className="w-4 h-4" aria-hidden="true" />
              <span>Ask Rafa for First-Aid Help</span>
            </Link>

            <div className="grid grid-cols-2 gap-2">
              <Link
                href="/"
                className="min-h-[44px] rounded-xl border border-border bg-surface text-fg font-semibold text-[12px] flex items-center justify-center gap-2 hover:bg-surface-muted transition-colors"
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
                className="min-h-[44px] rounded-xl border border-border bg-surface text-fg font-semibold text-[12px] flex items-center justify-center gap-2 hover:bg-surface-muted transition-colors cursor-pointer"
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
    <div className="flex flex-col flex-1 px-4 pt-3 pb-6 space-y-3 max-w-lg mx-auto w-full">
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
        <div className="w-11" aria-hidden="true" />
      </div>

      {/* Viewfinder Frame */}
      <div className="relative flex-1 min-h-[290px] rounded-2xl border border-border bg-black overflow-hidden flex flex-col justify-between shadow-sm">
        {/* Real HTML5 Live Video Stream (Always mounted in DOM for ref stability) */}
        <video
          ref={(node) => {
            videoRef.current = node;
            if (node && mediaStream && node.srcObject !== mediaStream) {
              node.srcObject = mediaStream;
              node.play().catch(() => {});
            }
          }}
          playsInline
          autoPlay
          muted
          className={`absolute inset-0 w-full h-full object-cover ${
            cameraStatus === 'active' ? 'block z-0' : 'hidden'
          }`}
        />

        {/* Simulated Lens Viewfinder (Desktop Dev Mode) */}
        {cameraStatus === 'simulated' && (
          <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-between p-4 text-center">
            <div className="flex-1 flex flex-col items-center justify-center space-y-2 my-auto">
              <div className="w-24 h-24 border-2 border-dashed border-accent/60 rounded-2xl flex flex-col items-center justify-center space-y-1 bg-black/40">
                <Camera className="w-8 h-8 text-accent" aria-hidden="true" />
                <span className="text-[12px] font-mono uppercase text-accent font-semibold tracking-wider">
                  {animal}
                </span>
              </div>
              <p className="text-[12px] font-semibold text-white/90">
                Dev Simulated Lens Active
              </p>
            </div>
          </div>
        )}

        {/* Viewfinder Header Badges */}
        <div className="relative z-10 w-full flex items-center justify-between p-3 gap-2">
          {/* Real Device GPS Badge */}
          <button
            type="button"
            onClick={requestLocation}
            className="flex items-center gap-2 px-3 py-2 rounded-full text-[12px] font-mono bg-black/60 text-white border border-white/20 backdrop-blur-md shadow-sm cursor-pointer"
          >
            {gpsStatus === 'acquiring' ? (
              <>
                <Loader2 className="w-3.5 h-3.5 shrink-0 text-white/70 animate-spin" aria-hidden="true" />
                <span>Acquiring GPS...</span>
              </>
            ) : gpsStatus === 'locked' && coords ? (
              <>
                <MapPin className="w-3.5 h-3.5 shrink-0 text-white/70" aria-hidden="true" />
                <span className="truncate max-w-[170px]">
                  {coords.lat.toFixed(4)}°, {coords.lng.toFixed(4)}°
                </span>
              </>
            ) : (
              <>
                <MapPin className="w-3.5 h-3.5 shrink-0 text-white/70" aria-hidden="true" />
                <span>{gpsStatus === 'denied' ? 'Location blocked' : 'Tap to retry GPS'}</span>
              </>
            )}
          </button>

          {/* Live Atomic Clock Badge */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-full text-[12px] font-mono bg-black/60 text-white border border-white/20 backdrop-blur-md shadow-sm">
            <Clock className="w-3.5 h-3.5 text-white/70" aria-hidden="true" />
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
                {cameraError ||
                  (SHOW_DEV_LENS
                    ? 'Use the dev simulated lens to test the emergency flow on your desktop.'
                    : 'Allow camera access to report an emergency. Photos must be taken live.')}
              </p>
            </div>
            {availableCameras.length > 1 && (
              <div className="w-full max-w-[240px] text-left">
                <label className="text-[12px] font-normal text-fg-muted">Switch Camera Device:</label>
                <select
                  value={selectedCameraId}
                  onChange={(e) => {
                    setSelectedCameraId(e.target.value);
                    handleRetryCamera(e.target.value);
                  }}
                  className="w-full mt-1 bg-surface text-fg border border-border rounded-xl text-[12px] p-2.5 cursor-pointer font-normal shadow-sm"
                >
                  {availableCameras.map((cam, idx) => (
                    <option key={cam.deviceId || idx} value={cam.deviceId}>
                      {cam.label || `Camera Device ${idx + 1}`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {cameraStatus !== 'starting' && (
              <div className="flex flex-col gap-2 w-full max-w-[220px]">
                <button
                  type="button"
                  onClick={() => handleRetryCamera()}
                  className="min-h-[44px] px-4 rounded-xl border border-border bg-surface text-fg font-semibold text-[12px] hover:bg-surface-muted transition-colors cursor-pointer"
                >
                  Retry Camera Access
                </button>
                {SHOW_DEV_LENS && (
                  <button
                    type="button"
                    onClick={handleUseSimulatedCamera}
                    className="min-h-[44px] px-4 rounded-xl bg-fg text-surface font-semibold text-[12px] hover:opacity-90 active:scale-95 transition-all cursor-pointer shadow-sm"
                  >
                    Use Dev Simulated Lens
                  </button>
                )}
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
            <span className="text-[12px] font-semibold text-white/90 drop-shadow mt-1">Center animal</span>
          </div>
        )}

        {/* Viewfinder Bottom Anti-Tampering Notice */}
        <div className="relative z-10 p-2 text-center bg-gradient-to-t from-black/80 to-transparent">
          <p className="text-[12px] font-semibold text-white/80 tracking-wide">
            Live lens only • No gallery uploads • Database timestamp
          </p>
        </div>
      </div>

      {/* Dev Lens Switcher: development builds only */}
      {SHOW_DEV_LENS && <div className="flex items-center justify-between px-1 text-[12px]">
        <span className="text-fg-muted font-normal">
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
      </div>}

      {/* Dispatch Error Banner */}
      {dispatchError && (
        <div className="p-3 rounded-xl bg-reported-bg border border-reported-fg/20 text-reported-fg text-[12px] flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{dispatchError}</span>
        </div>
      )}

      {/* Animal Selection (Tap 1) */}
      <div className="space-y-1">
        <label className="text-[12px] font-semibold text-fg-muted">Animal</label>
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
        <label className="text-[12px] font-semibold text-fg-muted">Severity</label>
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
                className={`text-[12px] font-normal mt-0.5 ${
                  tier.urgency === 'critical' ? 'text-reported-fg font-semibold' : 'text-fg-muted'
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
          className="w-16 h-16 min-w-[48px] min-h-[48px] rounded-full bg-accent hover:opacity-90 active:scale-95 disabled:opacity-50 text-accent-fg shadow-md flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-accent transition-transform border-none cursor-pointer"
          aria-label="Capture live photo and dispatch emergency"
        >
          {dispatchStep === 'uploading' ? (
            <Loader2 className="w-7 h-7 text-accent-fg animate-spin" aria-hidden="true" />
          ) : (
            <Camera className="w-7 h-7 text-accent-fg" aria-hidden="true" />
          )}
        </button>
        <p className="text-[12px] text-fg-muted font-normal text-center">
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
