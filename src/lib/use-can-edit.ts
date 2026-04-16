import { useAuth } from './auth-context';

/**
 * Returns true if the current user can perform write operations.
 * Guest users (isGuest === true) are read-only.
 */
export function useCanEdit(): boolean {
  const { isGuest } = useAuth();
  return !isGuest;
}
