'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Camera, MessageSquareHeart, Building2, Settings } from 'lucide-react';

export default function Navigation() {
  const pathname = usePathname();

  const navItems = [
    {
      label: 'Home',
      href: '/',
      icon: Home,
      isEmergency: false,
    },
    {
      label: 'Rafa',
      href: '/rafa',
      icon: MessageSquareHeart,
      isEmergency: false,
    },
    {
      label: 'SOS',
      href: '/sos',
      icon: Camera,
      isEmergency: true,
    },
    {
      label: 'Clinics',
      href: '/facilities',
      icon: Building2,
      isEmergency: false,
    },
    {
      label: 'Settings',
      href: '/settings',
      icon: Settings,
      isEmergency: false,
    },
  ];

  return (
    <nav
      aria-label="Primary navigation"
      className="fixed bottom-0 left-0 right-0 z-40 bg-page/90 backdrop-blur-xl border-t border-border pb-[env(safe-area-inset-bottom,0px)]"
    >
      <div className="max-w-md mx-auto px-2 h-16 flex items-center justify-around">
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
                {/* Signal Coral Emergency Beacon */}
                <div className="w-14 h-14 min-w-[48px] min-h-[48px] rounded-full bg-accent hover:opacity-95 text-accent-fg flex items-center justify-center shadow-lg shadow-[0_6px_20px_rgba(240,68,56,0.28)] dark:shadow-[0_6px_20px_rgba(255,83,71,0.28)] transition-transform active:scale-95 border-none">
                  <Icon className="w-6 h-6 text-accent-fg" aria-hidden="true" />
                </div>
                <span className="text-[12px] font-semibold text-accent mt-0.5">
                  SOS
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex flex-col items-center justify-center min-w-[48px] min-h-[48px] px-2 rounded-xl transition-colors ${
                isActive ? 'text-fg font-semibold' : 'font-normal'
              }`}
            >
              <Icon
                className={`w-5 h-5 mb-0.5 transition-colors ${
                  isActive ? 'text-fg' : 'text-fg-muted/70 group-hover:text-fg'
                }`}
                aria-hidden="true"
              />
              <span
                className={`text-[12px] transition-colors ${
                  isActive ? 'text-fg font-semibold' : 'text-fg-muted group-hover:text-fg'
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
