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

  const fetchProfile = useCallback(async (userId: string, _currentUser: User) => {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id, display_name, role, complex_id, active')
      .eq('id', userId)
      .single();
    setProfile(profile ?? null);
  }, []);

  useEffect(() => {
    try {
      const guestStored = sessionStorage.getItem(GUEST_KEY);
      if (guestStored === 'true') {
        setIsGuest(true);
      }
    } catch {}

    // 1. Obtener la sesión local de inmediato en < 1ms
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        fetchProfile(session.user.id, session.user);
      }
    }).catch(() => {
      setLoading(false);
    });

    // 2. Suscribirse a cambios futuros
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      if (session?.user) {
        fetchProfile(session.user.id, session.user);
      } else {
        setProfile(null);
      }
    });

    const slowNetworkGuard = window.setTimeout(() => {
      setLoading(false);
    }, 1000);

    return () => {
      window.clearTimeout(slowNetworkGuard);
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signIn = async (email: string, password: string) => {
    try {
      sessionStorage.removeItem(GUEST_KEY);
      setIsGuest(false);
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.user) {
        return { error: error?.message || 'Credenciales inválidas.', role: undefined };
      }

      if (data.session) {
        setSession(data.session);
        setUser(data.user);
      }

      // Sync JWT user_metadata with DB profile (role + complex_id)
      let dbRole: UserRole = (data.user.user_metadata?.role as UserRole) || 'admin';
      try {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('role, complex_id')
          .eq('id', data.user.id)
          .maybeSingle();

        if (profile?.role) {
          dbRole = profile.role as UserRole;
        }
        const dbComplexId: string | null = profile?.complex_id ?? null;

        const needsRoleSync = data.user.user_metadata?.role !== dbRole;
        const needsComplexSync = data.user.user_metadata?.complex_id !== dbComplexId;

        if (needsRoleSync || needsComplexSync) {
          await supabase.auth.updateUser({
            data: { role: dbRole, complex_id: dbComplexId },
          });
          const { data: refreshData } = await supabase.auth.refreshSession();
          if (refreshData?.session) {
            setSession(refreshData.session);
            setUser(refreshData.session.user);
          }
        }
      } catch (profileErr) {
        console.warn('Profile sync non-fatal warning:', profileErr);
      }

      return { error: null, role: dbRole };
    } catch (err: any) {
      return { error: err?.message || 'Error inesperado al iniciar sesión', role: undefined };
    }
  };

  const signInAsGuest = async () => {
    if (!GUEST_EMAIL || !GUEST_PASSWORD) {
      return { error: 'Las credenciales de invitado no están configuradas. Contacte al administrador.' };
    }
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: GUEST_EMAIL,
        password: GUEST_PASSWORD,
      });
      if (error || !data.user) {
        return { error: 'No se pudo iniciar sesión como observador.' };
      }
      sessionStorage.setItem(GUEST_KEY, 'true');
      setIsGuest(true);
      if (data.session) {
        setSession(data.session);
        setUser(data.user);
      }
      return { error: null };
    } catch (err: any) {
      return { error: err?.message || 'Error al iniciar sesión como invitado' };
    }
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
