'use client';

import { useAuth } from '@/lib/auth-context';
import type { UserRole } from '@/lib/types';

interface RoleGateProps {
  roles: UserRole[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function RoleGate({ roles, children, fallback = null }: RoleGateProps) {
  const { role, loading } = useAuth();
  if (loading) return null;
  if (!roles.includes(role)) return <>{fallback}</>;
  return <>{children}</>;
}
