'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Camera, MessageSquareHeart, Building2, Settings } from 'lucide-react';

export default function Navigation() {
  const pathname = usePathname();

  // If user is inside the SOS emergency dispatch flow, hide navigation to maximize camera view
  // The welcome page has its own report and sign-in actions, so the dock would only duplicate them
  if (pathname === '/sos' || pathname === '/welcome') {
    return null;
  }

  const leftTabs = [
    { label: 'Feed', href: '/', icon: Home, id: 'nav-feed' },
    { label: 'Rafa AI', href: '/rafa', icon: MessageSquareHeart, id: 'nav-rafa' },
  ];

  const rightTabs = [
    { label: 'Clinics', href: '/facilities', icon: Building2, id: 'nav-facilities' },
    { label: 'Settings', href: '/settings', icon: Settings, id: 'nav-settings' },
  ];

  return (
    <nav
      aria-label="Primary and Emergency Navigation"
      className="fixed bottom-0 left-0 right-0 z-40 px-3 pb-[calc(env(safe-area-inset-bottom,0px)+8px)] pointer-events-none"
    >
      <div className="max-w-md mx-auto pointer-events-auto">
        {/* Sculpted Cockpit Dock */}
        <div className="bg-surface/95 dark:bg-surface/90 backdrop-blur-2xl border border-border shadow-xl shadow-black/25 rounded-2xl px-2 py-1.5 flex items-center justify-between relative">
          {/* Left Wing Tabs */}
          <div className="flex items-center gap-1 flex-1 justify-around">
            {leftTabs.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  id={item.id}
                  className={`flex flex-col items-center justify-center min-w-[56px] min-h-[46px] px-2 rounded-xl transition-all ${
                    isActive
                      ? 'text-fg font-semibold bg-surface-muted border border-border/60 shadow-xs'
                      : 'text-fg-muted hover:text-fg hover:bg-surface-muted/40 font-normal'
                  }`}
                >
                  <Icon className={`w-4 h-4 mb-0.5 ${isActive ? 'text-fg' : 'text-fg-muted'}`} aria-hidden="true" />
                  <span className="text-[12px] leading-tight">{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Center Elevated Emergency SOS Beacon */}
          <div className="relative -top-4 mx-2 flex flex-col items-center shrink-0">
            <Link
              href="/sos"
              id="nav-sos-button"
              className="w-14 h-14 min-w-[56px] min-h-[56px] rounded-full bg-accent hover:opacity-95 text-accent-fg flex flex-col items-center justify-center shadow-lg shadow-accent/25 border-2 border-surface dark:border-surface active:scale-95 transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
              aria-label="Report Street Animal Emergency via Live Camera"
            >
              <Camera className="w-6 h-6 text-accent-fg" aria-hidden="true" />
              <span className="text-[12px] font-bold tracking-tight text-accent-fg leading-none mt-0.5">
                SOS
              </span>
            </Link>
          </div>

          {/* Right Wing Tabs */}
          <div className="flex items-center gap-1 flex-1 justify-around">
            {rightTabs.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  id={item.id}
                  className={`flex flex-col items-center justify-center min-w-[56px] min-h-[46px] px-2 rounded-xl transition-all ${
                    isActive
                      ? 'text-fg font-semibold bg-surface-muted border border-border/60 shadow-xs'
                      : 'text-fg-muted hover:text-fg hover:bg-surface-muted/40 font-normal'
                  }`}
                >
                  <Icon className={`w-4 h-4 mb-0.5 ${isActive ? 'text-fg' : 'text-fg-muted'}`} aria-hidden="true" />
                  <span className="text-[12px] leading-tight">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}


