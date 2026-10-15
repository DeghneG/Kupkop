'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, Camera, MessageSquareHeart, Building2 } from 'lucide-react';

export default function Navigation() {
  const pathname = usePathname();

  const navItems = [
    {
      label: 'Feed',
      href: '/',
      icon: Activity,
      isEmergency: false,
    },
    {
      label: 'SOS',
      href: '/sos',
      icon: Camera,
      isEmergency: true,
    },
    {
      label: 'Rafa',
      href: '/rafa',
      icon: MessageSquareHeart,
      isEmergency: false,
    },
    {
      label: 'Clinics',
      href: '/facilities',
      icon: Building2,
      isEmergency: false,
    },
  ];

  return (
    <nav
      aria-label="Primary navigation"
      className="fixed bottom-0 left-0 right-0 z-40 bg-surface-card/95 backdrop-blur-md border-t border-border pb-[env(safe-area-inset-bottom,0px)]"
    >
      <div className="max-w-md mx-auto px-4 h-16 flex items-center justify-around">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          if (item.isEmergency) {
            return (
              <Link
                key={item.href}
                href={item.href}
                id="nav-sos-button"
                className="relative -top-3 flex flex-col items-center justify-center group focus:outline-none focus:ring-2 focus:ring-accent rounded-full"
                aria-label="Emergency SOS Camera - Report Animal Incident"
              >
                <div className="w-14 h-14 min-w-[48px] min-h-[48px] rounded-full bg-accent hover:opacity-95 text-accent-fg flex items-center justify-center shadow-sm transition-transform active:scale-95">
                  <Icon className="w-6 h-6" aria-hidden="true" />
                </div>
                <span className="text-xs font-semibold text-accent-text mt-0.5">
                  SOS
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center min-w-[48px] min-h-[48px] px-2 rounded-xl transition-colors ${
                isActive
                  ? 'text-fg font-semibold'
                  : 'text-fg-muted hover:text-fg font-normal'
              }`}
            >
              <Icon className="w-5 h-5 mb-0.5" aria-hidden="true" />
              <span className="text-xs">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
