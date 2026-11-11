'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Activity, Building2, ClipboardCheck, HeartPulse, History, LayoutDashboard, Settings, Truck } from 'lucide-react';
import TestModeBanner from '@/components/TestModeBanner';
import RolePreviewBanner from '@/components/RolePreviewBanner';
import { DemoBanner } from '@/components/DemoMode';
import Wordmark from '@/components/Wordmark';
import { useProfile } from '@/lib/supabase/useProfile';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { DEMO_CLINIC_ID, useDemoData, useDemoMode } from '@/lib/demo/demo';

type Item = { label: string; href: string; icon: typeof LayoutDashboard; page?: string };

// The clinic workspace frame (D-058): a sidebar on a desktop, a scrollable bar of sections on a phone. The sections jump to
// the parts of the dashboard staff use most; the public clinic page and Settings sit at the end.
export default function ClinicShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { role, facilityId, loading } = useProfile();

  // Citizens and volunteers belong in the phone app: switching to one of those roles leaves the workspace
  useEffect(() => {
    if (!loading && role !== 'facility' && role !== 'admin') router.replace('/');
  }, [loading, role, router]);
  const demoOn = useDemoMode();
  const demo = useDemoData();
  const [fetchedName, setFetchedName] = useState<{ id: string; name: string } | null>(null);

  const clinicId = demoOn ? DEMO_CLINIC_ID : facilityId;
  const isAdmin = role === 'admin';

  // The clinic's name for the header (staff only; an admin sees every clinic)
  useEffect(() => {
    if (demoOn || !facilityId || !isSupabaseConfigured) return;
    let active = true;
    createClient()
      .from('facilities')
      .select('name')
      .eq('id', facilityId)
      .maybeSingle()
      .then(({ data }) => active && data && setFetchedName({ id: facilityId, name: data.name as string }));
    return () => {
      active = false;
    };
  }, [demoOn, facilityId]);

  const clinicName = isAdmin
    ? 'All Listed clinics'
    : demoOn
      ? (demo.clinics.find((c) => c.id === DEMO_CLINIC_ID)?.name ?? null)
      : fetchedName?.id === facilityId
        ? fetchedName.name
        : null;

  const items: Item[] = [
    { label: 'Dashboard', href: '/care', icon: LayoutDashboard, page: '/care' },
    { label: 'On their way', href: '/care#incoming-heading', icon: Truck },
    { label: 'Waiting for intake', href: '/care#intake-heading', icon: ClipboardCheck },
    { label: 'In care', href: '/care#in-care-heading', icon: HeartPulse },
    { label: 'Past cases', href: '/care#released-heading', icon: History },
    { label: 'Clinic status', href: '/care#availability-heading', icon: Activity },
    ...(clinicId && !isAdmin ? [{ label: 'Public clinic page', href: `/facilities/${clinicId}`, icon: Building2 }] : []),
    { label: 'Settings', href: '/care/settings', icon: Settings, page: '/care/settings' },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <TestModeBanner />
      <DemoBanner />
      <RolePreviewBanner />
      <div className="flex-1 flex flex-col lg:flex-row">
        <aside
          aria-label="Clinic workspace"
          className="bg-surface border-b border-border lg:border-b-0 lg:border-r lg:w-64 lg:shrink-0 lg:sticky lg:top-[var(--banner-h,0px)] lg:h-[calc(100vh-var(--banner-h,0px))] lg:overflow-y-auto"
        >
          <div className="bg-shell text-shell-fg px-4 py-3 flex items-center gap-3 lg:flex-col lg:items-start lg:gap-2">
            <Link href="/care" aria-label="Clinic dashboard" className="shrink-0">
              <Wordmark onShell className="text-[20px]" />
            </Link>
            <div className="min-w-0">
              <p className="text-[12px] text-shell-muted">Clinic workspace</p>
              {clinicName && <p className="text-[14px] font-semibold truncate">{clinicName}</p>}
            </div>
          </div>
          <div className="selvedge-thin" aria-hidden="true" />
          <nav aria-label="Clinic sections">
            <ul className="flex lg:flex-col gap-1 overflow-x-auto no-scrollbar px-2 py-2">
              {items.map((item) => {
                const active = !!item.page && pathname === item.page;
                const Icon = item.icon;
                return (
                  <li key={item.href} className="shrink-0">
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={`min-h-[44px] px-3 flex items-center gap-2 rounded-xl text-[14px] whitespace-nowrap ${
                        active ? 'bg-surface-muted font-semibold text-fg' : 'text-fg-muted hover:bg-surface-muted hover:text-fg'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>
        <main className="flex-1 min-w-0 flex flex-col">{children}</main>
      </div>
    </div>
  );
}
