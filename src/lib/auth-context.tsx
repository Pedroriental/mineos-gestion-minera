'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { UserProfile, UserRole } from './types';

const GUEST_KEY = 'mineos_guest_mode';

const GUEST_EMAIL = process.env.NEXT_PUBLIC_GUEST_EMAIL ?? '';
const GUEST_PASSWORD = process.env.NEXT_PUBLIC_GUEST_PASSWORD ?? '';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  role: UserRole;
  complexId: string | null;
  loading: boolean;
  isGuest: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null; role: UserRole | undefined }>;
  signInAsGuest: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('user_profiles')
      .select('id, display_name, role, complex_id, active')
      .eq('id', userId)
      .single();
    setProfile(data ?? null);
  }, []);

  useEffect(() => {
    const guestStored = sessionStorage.getItem(GUEST_KEY);
    if (guestStored === 'true') {
      setIsGuest(true);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
      }
    });

    const slowNetworkGuard = window.setTimeout(() => {
      setLoading(false);
    }, 1200);

    return () => {
      window.clearTimeout(slowNetworkGuard);
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signIn = async (email: string, password: string) => {
    sessionStorage.removeItem(GUEST_KEY);
    setIsGuest(false);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message, role: undefined };

    // Force JWT refresh by updating user_metadata (triggers new token issuance)
    // This ensures the middleware gets the correct role from the JWT
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', data.user!.id)
      .single();

    const dbRole: UserRole = profile?.role ?? 'admin';

    // Sync JWT user_metadata with DB role if they differ
    if (data.user?.user_metadata?.role !== dbRole) {
      await supabase.auth.updateUser({
        data: { role: dbRole },
      });
    }

    return { error: null, role: dbRole };
  };

  const signInAsGuest = async () => {
    if (!GUEST_EMAIL || !GUEST_PASSWORD) {
      return { error: 'Las credenciales de invitado no están configuradas. Contacte al administrador.' };
    }
    const { error } = await supabase.auth.signInWithPassword({
      email: GUEST_EMAIL,
      password: GUEST_PASSWORD,
    });
    if (error) {
      return { error: 'No se pudo iniciar sesión como observador. Verifique que la cuenta de invitado esté creada en Supabase.' };
    }
    sessionStorage.setItem(GUEST_KEY, 'true');
    setIsGuest(true);
    return { error: null };
  };

  const signOut = async () => {
    sessionStorage.removeItem(GUEST_KEY);
    setIsGuest(false);
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  const role: UserRole = profile?.role ?? (isGuest ? 'guest' : 'admin');
  const complexId = profile?.complex_id ?? null;

  return (
    <AuthContext.Provider value={{
      user, session, profile, role, complexId,
      loading, isGuest, signIn, signInAsGuest, signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
