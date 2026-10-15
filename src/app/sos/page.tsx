'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Camera, MapPin, Clock, ArrowLeft } from 'lucide-react';

export default function SOSCameraPage() {
  const [animal, setAnimal] = useState<'dog' | 'cat' | 'other'>('dog');
  const [urgency, setUrgency] = useState<'hit_and_run' | 'fracture' | 'sick_mange'>('hit_and_run');
  const [shutterFlashing, setShutterFlashing] = useState(false);
  const [captured, setCaptured] = useState(false);

  const handleCapture = () => {
    // Shutter flash per MOTION rule
    setShutterFlashing(true);
    setTimeout(() => {
      setShutterFlashing(false);
      setCaptured(true);
    }, 150);
  };

  return (
    <div className="flex flex-col flex-1 px-4 py-4 space-y-4">
      {/* Shutter flash overlay */}
      {shutterFlashing && (
        <div className="fixed inset-0 bg-white z-50 pointer-events-none transition-opacity duration-150" />
      )}

      {/* Top Header */}
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-1 text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50 min-w-[44px] min-h-[44px] text-[12px] font-semibold"
          aria-label="Back to Feed"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Back</span>
        </Link>
        <div className="text-center">
          <h1 className="text-[16px] font-semibold text-zinc-900 dark:text-zinc-50">
            Live SOS Camera
          </h1>
          <p className="text-[12px] text-zinc-500">Snap & Dispatch</p>
        </div>
        <div className="w-11" />
      </div>

      {/* Viewfinder Frame */}
      <div className="relative flex-1 min-h-[260px] rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800/60 overflow-hidden flex flex-col items-center justify-between p-4 shadow-sm">
        {/* Viewfinder Header Badges */}
        <div className="w-full flex items-center justify-between text-[12px] bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 rounded-xl text-zinc-600 dark:text-zinc-300 shadow-sm">
          <div className="flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-red-600 dark:text-red-400" aria-hidden="true" />
            <span className="font-mono text-[12px]">Location pending</span>
          </div>
          <div className="flex items-center gap-1 font-mono text-[12px] text-zinc-900 dark:text-zinc-100">
            <Clock className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Server time</span>
          </div>
        </div>

        {/* Viewfinder Center Content */}
        <div className="flex flex-col items-center justify-center text-center space-y-2 pointer-events-none">
          <div className="w-16 h-16 rounded-full border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 flex items-center justify-center shadow-sm">
            <Camera className="w-8 h-8 text-zinc-400" aria-hidden="true" />
          </div>
          <p className="text-[12px] text-zinc-600 dark:text-zinc-300 font-medium max-w-[220px]">
            {captured
              ? 'Photo captured with server timestamp.'
              : 'Aim directly at animal. Live camera only.'}
          </p>
        </div>

        {/* Security Rule Note */}
        <div className="text-center">
          <p className="text-[12px] text-zinc-500">
            Live camera only • No gallery uploads
          </p>
        </div>
      </div>

      {/* Animal Selection */}
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          {(['dog', 'cat', 'other'] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setAnimal(type)}
              className={`min-h-[44px] rounded-xl text-[12px] font-semibold capitalize transition-colors border ${
                animal === type
                  ? 'bg-red-600 text-white border-red-600 shadow-sm'
                  : 'bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700'
              }`}
            >
              {type === 'dog' ? 'Dog' : type === 'cat' ? 'Cat' : 'Other'}
            </button>
          ))}
        </div>

        {/* Urgency Selection */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { id: 'hit_and_run', label: 'Hit & run' },
            { id: 'fracture', label: 'Fracture' },
            { id: 'sick_mange', label: 'Sick / mange' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setUrgency(item.id as any)}
              className={`min-h-[44px] rounded-xl text-[12px] font-semibold transition-colors border ${
                urgency === item.id
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100 shadow-sm'
                  : 'bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Shutter Button: 48px+ filled red */}
        <div className="pt-2 flex justify-center">
          <button
            type="button"
            id="shutter-button"
            onClick={handleCapture}
            className="w-16 h-16 min-w-[48px] min-h-[48px] rounded-full bg-red-600 hover:bg-red-700 text-white active:scale-95 shadow-lg shadow-red-600/30 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-red-500 transition-transform border-none cursor-pointer"
            aria-label="Capture emergency photo and dispatch"
          >
            <Camera className="w-7 h-7 text-white" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
