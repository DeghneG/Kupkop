import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import TestModeBanner from '@/components/TestModeBanner';
import Navigation from '@/components/Navigation';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
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
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

const themeScript = `
(function() {
  try {
    var stored = localStorage.getItem('kupkop-theme');
    // Default to light mode (white base) unless explicitly saved as dark
    var theme = stored === 'dark' ? 'dark' : 'light';
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.style.colorScheme = 'dark';
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.setAttribute('data-theme', 'light');
      document.documentElement.style.colorScheme = 'light';
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 font-sans flex flex-col items-center">
        {/* Mobile viewport container with clean white card base */}
        <div className="w-full max-w-md min-h-screen bg-white dark:bg-zinc-900 border-x border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col relative pb-24">
          <TestModeBanner />
          <main className="flex-1 flex flex-col">{children}</main>
          <Navigation />
        </div>
      </body>
    </html>
  );
}
