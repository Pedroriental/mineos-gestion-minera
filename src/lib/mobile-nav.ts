import type { LucideIcon } from 'lucide-react';
import { Home, BookOpen, CircleDollarSign } from 'lucide-react';
import type { UserRole } from './types';

export type MobileHotbarId = 'home' | 'resumen' | 'reportes';

export type MobileHotbarItem = {
  id: MobileHotbarId;
  label: string;
  shortLabel: string;
  href: string;
  Icon: LucideIcon;
  match: (pathname: string) => boolean;
  roles?: UserRole[];  // undefined = all roles
};

/** Destinos prioritarios en la hotbar móvil */
export const ALL_MOBILE_HOTBAR: MobileHotbarItem[] = [
  {
    id: 'home',
    label: 'Inicio',
    shortLabel: 'Inicio',
    href: '/dashboard',
    Icon: Home,
    match: (pathname) => pathname === '/dashboard' || pathname.startsWith('/dashboard/'),
  },
  {
    id: 'resumen',
    label: 'Resumen ejecutivo',
    shortLabel: 'Resumen',
    href: '/operaciones/resumen',
    Icon: BookOpen,
    match: (pathname) => pathname.startsWith('/operaciones/resumen'),
    roles: ['admin_developer', 'admin'],
  },
  {
    id: 'reportes',
    label: 'Reportes y balances',
    shortLabel: 'Reportes',
    href: '/reportes-balances',
    Icon: CircleDollarSign,
    match: (pathname) => pathname.startsWith('/reportes-balances'),
    roles: ['admin_developer', 'admin', 'guest'],
  },
];

/** Check if admin_developer is inside a complex */
function isDevInComplex(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('mineos_active_complex') !== null;
}

/** Filter hotbar by role */
export function getMobileHotbar(role: UserRole): MobileHotbarItem[] {
  return ALL_MOBILE_HOTBAR.filter(
    (item) => !item.roles || item.roles.includes(role),
  ).filter((item) => {
    // admin_developer in system mode: only show home
    if (role === 'admin_developer' && !isDevInComplex() && item.id !== 'home') {
      return false;
    }
    return true;
  });
}

export function getActiveMobileHotbarId(pathname: string, role: UserRole): MobileHotbarId | null {
  const hotbar = getMobileHotbar(role);
  const hit = hotbar.find((item) => item.match(pathname));
  return hit?.id ?? null;
}

/** Rutas del workspace de nómina (hotbar global se sustituye por dock contextual). */
export function isNominaWorkspacePath(pathname: string): boolean {
  return (
    pathname.startsWith('/mina/nomina') ||
    pathname.startsWith('/planta/nomina') ||
    pathname.startsWith('/admin/nomina')
  );
}

export type MobileHomeShortcut = {
  label: string;
  href: string;
  tone: 'general' | 'expense' | 'benefit' | 'neutral';
  roles?: UserRole[];
};

/** Accesos rápidos desde el inicio móvil */
export const ALL_MOBILE_HOME_SHORTCUTS: MobileHomeShortcut[] = [
  { label: 'Voladuras', href: '/mina/voladuras', tone: 'general', roles: ['admin_developer', 'admin', 'mining_supervisor'] },
  { label: 'Extracción', href: '/mina/extraccion', tone: 'general', roles: ['admin_developer', 'admin', 'mining_supervisor'] },
  { label: 'Producción', href: '/planta/produccion', tone: 'general', roles: ['admin_developer', 'admin', 'mill_supervisor'] },
  { label: 'Gastos', href: '/admin/gastos', tone: 'expense', roles: ['admin_developer', 'admin'] },
  { label: 'Nómina Mina', href: '/mina/nomina', tone: 'benefit', roles: ['admin_developer', 'mining_supervisor'] },
  { label: 'Inventario', href: '/admin/inventario', tone: 'neutral', roles: ['admin_developer', 'admin', 'mill_supervisor'] },
];

/** Filter shortcuts by role */
export function getMobileHomeShortcuts(role: UserRole): MobileHomeShortcut[] {
  return ALL_MOBILE_HOME_SHORTCUTS.filter(
    (item) => !item.roles || item.roles.includes(role),
  ).filter((item) => {
    // admin_developer in system mode: no operational shortcuts
    if (role === 'admin_developer' && !isDevInComplex()) {
      return false;
    }
    return true;
  });
}
