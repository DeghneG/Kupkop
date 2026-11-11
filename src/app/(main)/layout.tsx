import { Suspense } from 'react';
import TestModeBanner from '@/components/TestModeBanner';
import RolePreviewBanner from '@/components/RolePreviewBanner';
import { DemoBanner } from '@/components/DemoMode';
import Navigation from '@/components/Navigation';

// The phone app for citizens, volunteers and admins: one centred mobile column with the bottom dock (Feed, Rafa, SOS ...).
export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center min-h-screen">
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
    </div>
  );
}
