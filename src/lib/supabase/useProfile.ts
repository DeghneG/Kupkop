'use client';

import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { useViewAs } from '@/lib/storage';

export type UserRole = 'citizen' | 'volunteer' | 'facility' | 'admin';

export interface ProfileState {
  user: User | null;
  /** Role the UI should show (the preview role when an admin is using "View as"). */
  role: UserRole;
  /** Role stored in profiles.role. */
  realRole: UserRole;
  /** Clinic a facility-role user works at (set by an admin). */
  facilityId: string | null;
  loading: boolean;
}

type LoadedProfile = Pick<ProfileState, 'user' | 'realRole' | 'facilityId' | 'loading'>;

// Display-only. Real permissions are enforced by RLS and the claim/admit functions.
export function useProfile(): ProfileState {
  const [viewAs] = useViewAs();
  const [state, setState] = useState<LoadedProfile>({ user: null, realRole: 'citizen', facilityId: null, loading: true });

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    const load = async (user: User | null) => {
      if (!user) {
        if (active) setState({ user: null, realRole: 'citizen', facilityId: null, loading: false });
        return;
      }
      type Row = { role?: string; facility_id?: string | null } | null;
      const full = await supabase.from('profiles').select('role,facility_id').eq('id', user.id).maybeSingle();
      // Before the clinic-care migration runs there is no facility_id column; keep the role working
      const row: Row = full.error
        ? (await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()).data
        : full.data;
      if (active) {
        setState({
          user,
          realRole: (row?.role as UserRole) ?? 'citizen',
          facilityId: row?.facility_id ?? null,
          loading: false,
        });
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => load(session?.user ?? null));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      load(session?.user ?? null);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const role = state.realRole === 'admin' && viewAs ? viewAs : state.realRole;
  return { ...state, role };
}
