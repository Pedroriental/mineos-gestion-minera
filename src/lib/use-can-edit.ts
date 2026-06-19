import { useAuth } from './auth-context';
import type { UserRole } from './types';

/**
 * Returns true if the current user can perform write operations.
 * Guest users (isGuest === true) are read-only.
 */
export function useCanEdit(): boolean {
  const { isGuest } = useAuth();
  return !isGuest;
}

export function useIsAdmin(): boolean {
  const { role } = useAuth();
  return role === 'admin' || role === 'admin_developer';
}

export function useIsAdminDeveloper(): boolean {
  const { role } = useAuth();
  return role === 'admin_developer';
}

export function useIsMiningSupervisor(): boolean {
  const { role } = useAuth();
  return role === 'mining_supervisor';
}

export function useIsMillSupervisor(): boolean {
  const { role } = useAuth();
  return role === 'mill_supervisor';
}

export function useCanAccess(...roles: UserRole[]): boolean {
  const { role } = useAuth();
  return roles.includes(role);
}
