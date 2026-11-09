import type { Metadata, Viewport } from 'next';
import { Atkinson_Hyperlegible } from 'next/font/google';
import './globals.css';
import TestModeBanner from '@/components/TestModeBanner';
import RolePreviewBanner from '@/components/RolePreviewBanner';
import Navigation from '@/components/Navigation';
import ThemeInit from '@/components/ThemeInit';

// Designed for low vision: letterforms stay distinct in harsh sun and at arm's length
const atkinson = Atkinson_Hyperlegible({
  weight: ['400', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-atkinson',
});

// Applies a saved Light or Dark choice before the first paint, so the page never flashes the other theme.
// 'System' needs nothing here: globals.css follows the phone setting.
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('kupkop-theme');if(t==='dark'||t==='light'){var r=document.documentElement;r.setAttribute('data-theme',t);r.classList.toggle('dark',t==='dark');r.style.colorScheme=t}}catch(e){}})()`;

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
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#232D69' },
    { media: '(prefers-color-scheme: dark)', color: '#2A367F' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${atkinson.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full bg-page text-fg font-sans flex flex-col items-center">
        <ThemeInit />
        {/* Mobile viewport container */}
        <div className="w-full max-w-md min-h-screen bg-page border-x border-border shadow-sm flex flex-col relative pb-28 transition-colors duration-150">
          <TestModeBanner />
          <RolePreviewBanner />
          <main className="flex-1 flex flex-col">{children}</main>
          <Navigation />
        </div>
      </body>
    </html>
  );
}
