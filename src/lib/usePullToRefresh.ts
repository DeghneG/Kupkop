'use client';

import { useEffect, useRef, useState } from 'react';

const TRIGGER_PX = 64;
const MAX_PX = 88;

/**
 * Touch pull-to-refresh for a page that scrolls the window. Returns how far the
 * user has pulled (damped, 0..MAX_PX) and whether releasing now would refresh.
 * Native overscroll is contained while mounted so the browser's own reload
 * gesture does not fire on top of it.
 */
export function usePullToRefresh(onRefresh: () => void, refreshing: boolean) {
  const [distance, setDistance] = useState(0);
  const startY = useRef<number | null>(null);
  const distanceRef = useRef(0);
  const onRefreshRef = useRef(onRefresh);
  const refreshingRef = useRef(refreshing);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
    refreshingRef.current = refreshing;
  });

  useEffect(() => {
    const root = document.documentElement;
    const previous = root.style.overscrollBehaviorY;
    root.style.overscrollBehaviorY = 'contain';

    const setPull = (value: number) => {
      distanceRef.current = value;
      setDistance(value);
    };

    const onStart = (e: TouchEvent) => {
      startY.current = window.scrollY <= 0 && !refreshingRef.current ? e.touches[0].clientY : null;
    };
    const onMove = (e: TouchEvent) => {
      if (startY.current == null) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta <= 0 || window.scrollY > 0) return setPull(0);
      setPull(Math.min(MAX_PX, delta * 0.5));
    };
    const onEnd = () => {
      if (startY.current != null && distanceRef.current >= TRIGGER_PX) onRefreshRef.current();
      startY.current = null;
      setPull(0);
    };

    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd);
    window.addEventListener('touchcancel', onEnd);
    return () => {
      root.style.overscrollBehaviorY = previous;
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
    };
  }, []);

  return { distance, armed: distance >= TRIGGER_PX };
}
