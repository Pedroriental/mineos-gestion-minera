'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

const GUEST_KEY = 'mineos_guest_mode';

// Dedicated read-only guest account in Supabase Auth.
// These are intentionally public — the account has no write permissions at the app level.
const GUEST_EMAIL = process.env.NEXT_PUBLIC_GUEST_EMAIL ?? '';
const GUEST_PASSWORD = process.env.NEXT_PUBLIC_GUEST_PASSWORD ?? '';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isGuest: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signInAsGuest: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    // Restore guest flag (synchronous) before the async Supabase session check
    const guestStored = sessionStorage.getItem(GUEST_KEY);
    if (guestStored === 'true') {
      setIsGuest(true);
    }

    // Always check Supabase session — works for both real users and the guest account
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    // Reset guest flag if a real user signs in
    sessionStorage.removeItem(GUEST_KEY);
    setIsGuest(false);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signInAsGuest = async () => {
    if (!GUEST_EMAIL || !GUEST_PASSWORD) {
      return { error: 'Las credenciales de invitado no están configuradas. Contacte al administrador.' };
    }
    // Sign in with the dedicated read-only guest Supabase account.
    // This gives a real JWT so RLS policies allow data reads.
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
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, isGuest, signIn, signInAsGuest, signOut }}>
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
