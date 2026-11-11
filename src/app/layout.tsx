import type { Metadata, Viewport } from 'next';
import { Atkinson_Hyperlegible } from 'next/font/google';
import './globals.css';

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

// Shared by every screen. The phone app, src/app/(main)/layout.tsx, and the clinic workspace,
// src/app/(clinic)/layout.tsx, each bring their own frame and navigation.
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${atkinson.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full bg-page text-fg font-sans">{children}</body>
    </html>
  );
}
