import type { LucideIcon } from 'lucide-react';
import { Home, BookOpen, CircleDollarSign } from 'lucide-react';

export type MobileHotbarId = 'home' | 'resumen' | 'reportes';

export type MobileHotbarItem = {
  id: MobileHotbarId;
  label: string;
  shortLabel: string;
  href: string;
  Icon: LucideIcon;
  match: (pathname: string) => boolean;
};

/** Destinos prioritarios en la hotbar móvil */
export const MOBILE_HOTBAR: MobileHotbarItem[] = [
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
  },
  {
    id: 'reportes',
    label: 'Reportes y balances',
    shortLabel: 'Reportes',
    href: '/reportes-balances',
    Icon: CircleDollarSign,
    match: (pathname) => pathname.startsWith('/reportes-balances'),
  },
];

export function getActiveMobileHotbarId(pathname: string): MobileHotbarId | null {
  const hit = MOBILE_HOTBAR.find((item) => item.match(pathname));
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

/** Accesos rápidos desde el inicio móvil */
export const MOBILE_HOME_SHORTCUTS = [
  { label: 'Voladuras', href: '/mina/voladuras', tone: 'general' as const },
  { label: 'Extracción', href: '/mina/extraccion', tone: 'general' as const },
  { label: 'Producción', href: '/planta/produccion', tone: 'general' as const },
  { label: 'Gastos', href: '/admin/gastos', tone: 'expense' as const },
  { label: 'Nómina Mina', href: '/mina/nomina', tone: 'benefit' as const },
  { label: 'Inventario', href: '/admin/inventario', tone: 'neutral' as const },
] as const;
