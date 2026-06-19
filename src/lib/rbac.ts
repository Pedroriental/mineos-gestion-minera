import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { UserRole } from './types';

export interface ServerUser {
  id: string;
  email: string;
  role: UserRole;
  complexId: string | null;
}

/**
 * Get the current user with role + complex_id from the JWT.
 * Reads user_metadata — zero DB queries for basic auth checks.
 * Use in Server Components and Server Actions.
 */
export async function getServerUser(): Promise<ServerUser | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => cookieStore.get(name)?.value,
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  return {
    id: user.id,
    email: user.email ?? '',
    role: (user.user_metadata?.role as UserRole) ?? 'admin',
    complexId: user.user_metadata?.complex_id ?? null,
  };
}

/**
 * Check if the user has one of the required roles.
 */
export function hasRole(user: ServerUser | null, ...roles: UserRole[]): boolean {
  return user !== null && roles.includes(user.role);
}

/**
 * Check if the user is an admin_developer (global access).
 */
export function isGlobalAdmin(user: ServerUser | null): boolean {
  return user?.role === 'admin_developer';
}

/**
 * Enforce that the user has one of the required roles.
 * Throws if not authorized — use in Server Actions.
 */
export async function requireRole(...roles: UserRole[]): Promise<ServerUser> {
  const user = await getServerUser();
  if (!user || !roles.includes(user.role)) {
    throw new Error('Unauthorized: insufficient permissions');
  }
  return user;
}
