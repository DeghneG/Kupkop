import { Suspense } from 'react';
import type { Metadata, Viewport } from 'next';
import { Atkinson_Hyperlegible } from 'next/font/google';
import './globals.css';
import TestModeBanner from '@/components/TestModeBanner';
import RolePreviewBanner from '@/components/RolePreviewBanner';
import { DemoBanner } from '@/components/DemoMode';
import Navigation from '@/components/Navigation';

// Designed for low vision: letterforms stay distinct in harsh sun and at arm's length
const atkinson = Atkinson_Hyperlegible({
  weight: ['400', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-atkinson',
});

export const metadata: Metadata = {
  title: 'KupKop — Street Animal Emergency Network',
  description: 'Fast, community-driven street animal emergency dispatch, claim locking, and recovery tracking.',
  manifest: '/manifest.json',
  icons: { icon: '/pwa-icon?size=96', apple: '/pwa-icon?size=180' },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'KupKop',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#232D69',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${atkinson.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full bg-page text-fg font-sans flex flex-col items-center">
        {/* Mobile viewport container */}
        <div className="w-full max-w-md min-h-screen bg-page border-x border-border shadow-sm flex flex-col relative pb-28 transition-colors duration-150">
          <TestModeBanner />
          <DemoBanner />
          <RolePreviewBanner />
          <main className="flex-1 flex flex-col">{children}</main>
          {/* The dock reads the current address, which a dynamic page like /animal/[id] only knows at runtime */}
          <Suspense fallback={null}>
            <Navigation />
          </Suspense>
        </div>
      </body>
    </html>
  );
}
