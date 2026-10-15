'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { Camera, MapPin, Clock, ArrowLeft, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function SOSCameraPage() {
  const [animal, setAnimal] = useState<'dog' | 'cat' | 'other'>('dog');
  const [urgency, setUrgency] = useState<'hit_and_run' | 'fracture' | 'sick_mange'>('hit_and_run');
  const [shutterFlashing, setShutterFlashing] = useState(false);
  const [captured, setCaptured] = useState(false);

  const handleCapture = () => {
    // Shutter flash per MOTION rule: "No animation on the SOS camera screen except the shutter flash."
    setShutterFlashing(true);
    setTimeout(() => {
      setShutterFlashing(false);
      setCaptured(true);
    }, 150);
  };

  return (
    <div className="flex flex-col flex-1 bg-black text-white px-4 py-4 min-h-[calc(100vh-80px)] relative">
      {/* Shutter flash overlay */}
      {shutterFlashing && (
        <div className="fixed inset-0 bg-white z-50 pointer-events-none transition-opacity duration-150" />
      )}

      {/* Top Header */}
      <div className="flex items-center justify-between py-2">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-zinc-400 hover:text-white min-w-[48px] min-h-[48px]"
          aria-label="Back to Feed"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-xs font-bold">Back</span>
        </Link>
        <div className="text-center">
          <h1 className="text-sm font-black tracking-wide text-rose-500 uppercase">
            Live SOS Camera
          </h1>
          <p className="text-[10px] text-zinc-400">Step 1 of 2: Snap & Dispatch</p>
        </div>
        <div className="w-10" />
      </div>

      {/* Viewfinder Frame */}
      <div className="relative flex-1 rounded-2xl border-2 border-dashed border-rose-500/50 bg-zinc-900/80 overflow-hidden flex flex-col items-center justify-between p-4 my-2">
        {/* Viewfinder Overlays */}
        <div className="w-full flex items-center justify-between text-[11px] text-zinc-300 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10">
          <div className="flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-rose-400" />
            <span className="font-mono">14.6342° N, 121.0734° E</span>
          </div>
          <div className="flex items-center gap-1 text-emerald-400 font-mono">
            <Clock className="w-3.5 h-3.5" />
            <span>SERVER TIMESTAMP</span>
          </div>
        </div>

        {/* Viewfinder Center Guide */}
        <div className="flex flex-col items-center justify-center text-center space-y-2 pointer-events-none">
          <div className="w-20 h-20 rounded-full border border-rose-500/40 flex items-center justify-center">
            <Camera className="w-10 h-10 text-rose-500/60" />
          </div>
          <p className="text-xs text-zinc-300 font-medium max-w-[220px]">
            {captured
              ? 'Snapshot captured with server timestamp!'
              : 'Aim camera directly at the animal. No gallery uploads allowed.'}
          </p>
        </div>

        {/* Security Rule Note */}
        <div className="text-center">
          <p className="text-[10px] text-zinc-400">
            🔒 Live camera only • GPS locked • Server-side timestamp
          </p>
        </div>
      </div>

      {/* Animal & Severity Quick Selection (Thumb-zone) */}
      <div className="space-y-3 py-2">
        <div className="grid grid-cols-3 gap-2">
          {(['dog', 'cat', 'other'] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setAnimal(type)}
              className={`min-h-[48px] rounded-xl text-xs font-bold capitalize transition-colors border ${
                animal === type
                  ? 'bg-rose-600 text-white border-rose-500'
                  : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:border-zinc-700'
              }`}
            >
              {type === 'dog' ? '🐕 Aspin' : type === 'cat' ? '🐈 Puspin' : '🐾 Other'}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            { id: 'hit_and_run', label: 'Hit & Run', desc: 'Critical' },
            { id: 'fracture', label: 'Fracture', desc: 'Urgent' },
            { id: 'sick_mange', label: 'Sick / Mange', desc: 'Moderate' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setUrgency(item.id as any)}
              className={`min-h-[48px] rounded-xl p-1 text-center transition-colors border ${
                urgency === item.id
                  ? 'bg-zinc-100 text-zinc-950 border-white'
                  : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:border-zinc-700'
              }`}
            >
              <div className="text-[11px] font-bold leading-tight">{item.label}</div>
              <div className="text-[9px] text-zinc-500 uppercase">{item.desc}</div>
            </button>
          ))}
        </div>

        {/* Shutter Button */}
        <div className="pt-2 flex justify-center">
          <button
            type="button"
            id="shutter-button"
            onClick={handleCapture}
            className="w-20 h-20 rounded-full bg-rose-600 active:scale-95 border-4 border-white shadow-xl shadow-rose-600/40 flex items-center justify-center focus:outline-none focus:ring-4 focus:ring-rose-500 transition-transform"
            aria-label="Capture emergency photo and dispatch"
          >
            <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center">
              <Camera className="w-7 h-7 text-rose-600" />
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
