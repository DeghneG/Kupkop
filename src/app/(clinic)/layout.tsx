import { Suspense } from 'react';
import ClinicShell from '@/components/ClinicShell';

// The clinic workspace: a desktop dashboard with a sidebar (a compact top bar on a phone). No Feed, Rafa or SOS:
// clinic staff receive animals, they do not report or rescue them.
export default function ClinicLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <ClinicShell>{children}</ClinicShell>
    </Suspense>
  );
}
