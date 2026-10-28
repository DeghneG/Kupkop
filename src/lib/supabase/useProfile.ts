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
  loading: boolean;
}

type LoadedProfile = Pick<ProfileState, 'user' | 'realRole' | 'loading'>;

// Display-only. Real permissions are enforced by RLS and the claim/admit functions.
export function useProfile(): ProfileState {
  const [viewAs] = useViewAs();
  const [state, setState] = useState<LoadedProfile>({ user: null, realRole: 'citizen', loading: true });

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    const load = async (user: User | null) => {
      if (!user) {
        if (active) setState({ user: null, realRole: 'citizen', loading: false });
        return;
      }
      const { data } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
      if (active) setState({ user, realRole: (data?.role as UserRole) ?? 'citizen', loading: false });
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
