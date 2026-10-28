'use client';

import React, { useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';

export default function TestModeBanner() {
  const bannerRef = useRef<HTMLElement>(null);

  // Publish the banner height so sticky elements below it (feed filter tabs) can sit flush under it
  useEffect(() => {
    const el = bannerRef.current;
    if (!el) return;
    const root = document.documentElement;
    const observer = new ResizeObserver(() => root.style.setProperty('--banner-h', `${el.offsetHeight}px`));
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.removeProperty('--banner-h');
    };
  }, []);

  return (
    <aside
      ref={bannerRef}
      role="banner"
      aria-label="Prototype Test Mode Notice"
      className="w-full bg-banner-bg text-banner-fg border-b border-border px-4 py-2 z-50 sticky top-0"
    >
      <p className="flex items-center gap-2 text-[12px] leading-tight">
        <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span>
          <strong className="font-semibold">Test mode.</strong> Not connected to 911 or real responders.
        </span>
      </p>
    </aside>
  );
}
