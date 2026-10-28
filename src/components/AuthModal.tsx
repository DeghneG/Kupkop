'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { X } from 'lucide-react';
import AuthPanel from '@/components/AuthPanel';
import { createClient } from '@/lib/supabase/client';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

// Bottom-sheet wrapper around AuthPanel. The panel mounts fresh on every open, so its form state resets.
export default function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onSuccessRef = useRef(onSuccess);

  useEffect(() => {
    onSuccessRef.current = onSuccess;
  });

  // Tell the caller once a session exists, so it can carry on (SOS sends the staged report).
  // The email link usually opens in another tab, so also re-check when the user returns to this one.
  useEffect(() => {
    if (!isOpen) return;
    const supabase = createClient();
    let done = false;
    const succeed = () => {
      if (done) return;
      done = true;
      onSuccessRef.current?.();
    };

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) succeed();
    });
    const recheck = () => {
      if (document.visibilityState !== 'visible') return;
      supabase.auth.getSession().then(({ data: { session } }) => session && succeed());
    };
    document.addEventListener('visibilitychange', recheck);
    window.addEventListener('focus', recheck);

    return () => {
      done = true;
      data.subscription.unsubscribe();
      document.removeEventListener('visibilitychange', recheck);
      window.removeEventListener('focus', recheck);
    };
  }, [isOpen]);

  // GSAP animated exit
  const handleClose = useCallback(() => {
    if (!sheetRef.current || !backdropRef.current) {
      onClose();
      return;
    }

    const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (isReduced) {
      onClose();
      return;
    }

    gsap.to(backdropRef.current, {
      opacity: 0,
      duration: 0.18,
      ease: 'power2.in',
    });

    gsap.to(sheetRef.current, {
      y: '100%',
      opacity: 0.5,
      duration: 0.24,
      ease: 'power3.in',
      onComplete: onClose,
    });
  }, [onClose]);

  // Escape key listener
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  // GSAP animated entrance respecting prefers-reduced-motion
  useGSAP(
    () => {
      if (!isOpen || !sheetRef.current || !backdropRef.current) return;

      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: reduce)', () => {
        gsap.set(backdropRef.current, { opacity: 1 });
        gsap.set(sheetRef.current, { y: '0%', opacity: 1 });
      });

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.fromTo(
          backdropRef.current,
          { opacity: 0 },
          { opacity: 1, duration: 0.22, ease: 'power2.out' }
        );
        gsap.fromTo(
          sheetRef.current,
          { y: '100%', opacity: 0.8 },
          { y: '0%', opacity: 1, duration: 0.32, ease: 'power3.out' }
        );
      });

      closeButtonRef.current?.focus();

      return () => mm.revert();
    },
    { dependencies: [isOpen], scope: containerRef }
  );

  if (!isOpen) return null;

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
    >
      {/* Dimmed backdrop with click-to-dismiss */}
      <div
        ref={backdropRef}
        onClick={handleClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm cursor-pointer"
        aria-hidden="true"
      />

      {/* Modal Card / Bottom Sheet Container */}
      <div
        ref={sheetRef}
        className="relative z-10 w-full max-w-sm sm:max-w-md bg-surface border-t sm:border border-border rounded-t-[24px] sm:rounded-[24px] p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,16px))] sm:pb-6 shadow-2xl max-h-[92vh] overflow-y-auto"
      >
        {/* Mobile drag handle */}
        <div className="sm:hidden w-10 h-1 bg-border rounded-full mx-auto -mt-2 mb-3" aria-hidden="true" />

        {/* Accessible 44px Close Button */}
        <button
          ref={closeButtonRef}
          type="button"
          onClick={handleClose}
          className="absolute top-4 right-4 w-11 h-11 min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-fg-muted hover:text-fg bg-surface-muted hover:bg-border/60 transition-colors cursor-pointer"
          aria-label="Close dialog"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Top space clears the close button so the form keeps its full width */}
        <div className="pt-8">
          <AuthPanel headingId="auth-modal-title" onDone={handleClose} />
        </div>
      </div>
    </div>
  );
}
