import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import type { UserRole } from '@shared-types/database';
import { registerForPush } from '@/lib/push';
import { supabase } from '@/lib/supabase';

type AuthState = {
  user: User | null;
  /** From profiles.role; users can never change it themselves (RLS) */
  role: UserRole;
  loading: boolean;
  refreshRole: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

// One session listener for the whole app (the web app ran one per component)
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole>('citizen');
  const [loading, setLoading] = useState(true);

  const loadRole = async (u: User | null) => {
    if (!u) {
      setRole('citizen');
      return;
    }
    const { data } = await supabase.from('profiles').select('role').eq('id', u.id).maybeSingle();
    setRole((data?.role as UserRole) ?? 'citizen');
  };

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!active) return;
      setUser(session?.user ?? null);
      await loadRole(session?.user ?? null);
      if (active) setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      // Not awaited inside the callback: Supabase warns against async work there
      setTimeout(() => loadRole(session?.user ?? null), 0);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  // Each signed-in phone registers for new-SOS alerts; the server only alerts responders
  const userId = user?.id;
  useEffect(() => {
    if (userId) registerForPush(userId);
  }, [userId]);

  return (
    <AuthContext.Provider value={{ user, role, loading, refreshRole: () => loadRole(user) }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
