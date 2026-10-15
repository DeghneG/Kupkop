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
      className="fixed bottom-0 left-0 right-0 z-40 bg-[#f0f4fa]/90 dark:bg-[#0c1424]/90 backdrop-blur-xl border-t border-[#ccd7e8] dark:border-[#223152] pb-[env(safe-area-inset-bottom,0px)]"
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
                className="relative -top-3 flex flex-col items-center justify-center group focus:outline-none focus:ring-2 focus:ring-[#ff453a] rounded-full"
                aria-label="Emergency SOS Camera - Report Animal Incident"
              >
                {/* Guaranteed saturated red emergency button */}
                <div className="w-14 h-14 min-w-[48px] min-h-[48px] rounded-full bg-[#ff453a] hover:bg-[#e03b31] text-white flex items-center justify-center shadow-lg shadow-red-500/25 transition-transform active:scale-95 border-none">
                  <Icon className="w-6 h-6 text-white" aria-hidden="true" />
                </div>
                <span className="text-[12px] font-semibold text-[#ff453a] mt-0.5">
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
                  ? 'text-[#0b132b] dark:text-white font-semibold'
                  : 'text-[#5a6b85] hover:text-[#0b132b] dark:text-[#8e9bb0] dark:hover:text-white font-normal'
              }`}
            >
              <Icon className="w-5 h-5 mb-0.5" aria-hidden="true" />
              <span className="text-[12px]">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
