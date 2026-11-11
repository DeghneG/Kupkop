import { Suspense } from 'react';
import ClinicProfile from '@/components/ClinicProfile';

// The id is read in the browser by the profile itself, so this page has nothing to wait for on the server.
export default function ClinicPage() {
  return (
    <Suspense fallback={<p role="status" className="px-4 pt-6 text-[14px] text-fg-muted">Loading…</p>}>
      <ClinicProfile />
    </Suspense>
  );
}
