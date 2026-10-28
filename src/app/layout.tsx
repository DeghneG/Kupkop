import type { Metadata, Viewport } from 'next';
import { Inter, Bricolage_Grotesque } from 'next/font/google';
import './globals.css';
import TestModeBanner from '@/components/TestModeBanner';
import Navigation from '@/components/Navigation';
import ThemeInit from '@/components/ThemeInit';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-bricolage',
});

export const metadata: Metadata = {
  title: 'KupKop — Street Animal Emergency Network',
  description: 'Fast, community-driven street animal emergency dispatch, claim locking, and recovery tracking.',
  manifest: '/manifest.json',
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
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F6F4EE' },
    { media: '(prefers-color-scheme: dark)', color: '#0E1411' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${bricolage.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full bg-page text-fg font-sans flex flex-col items-center">
        <ThemeInit />
        {/* Mobile viewport container */}
        <div className="w-full max-w-md min-h-screen bg-page border-x border-border shadow-sm flex flex-col relative pb-28 transition-colors duration-150">
          <TestModeBanner />
          <main className="flex-1 flex flex-col">{children}</main>
          <Navigation />
        </div>
      </body>
    </html>
  );
}
