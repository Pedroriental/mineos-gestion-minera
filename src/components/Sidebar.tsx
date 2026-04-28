'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  CircleDollarSign,
  Users,
  Receipt,
  Package,
  ShoppingCart,
  Pickaxe,
  Zap,
  Wrench,
  ShieldCheck,
  HardHat,
  Factory,
  FlaskConical,
  Flame,
  Layers,
  BookOpen,
  ClipboardList,
  TestTube2,
  Calculator,
  ChevronDown,
  LogOut,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Navigation data ───────────────────────────────────────────
interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  subItems?: { label: string; href: string }[];
}
interface NavSection {
  id: string;
  title: string;
  items: NavItem[];
}

const navigation: NavSection[] = [
  {
    id: 'admin',
    title: 'Administración',
    items: [
      { label: 'Gastos',     href: '/admin/gastos',     icon: <Receipt className="w-4 h-4" /> },
      { label: 'Inventario', href: '/admin/inventario', icon: <Package className="w-4 h-4" /> },
      { label: 'Compras',    href: '/admin/compras',    icon: <ShoppingCart className="w-4 h-4" /> },
      {
        label: 'Nómina de Personal', href: '#', icon: <Users className="w-4 h-4" />,
        subItems: [
          { label: 'Nómina Mina',    href: '/mina/nomina' },
          { label: 'Nómina Molinos', href: '/planta/nomina' },
        ],
      },
    ],
  },
  {
    id: 'mina',
    title: 'Mina',
    items: [
      { label: 'Voladuras',  href: '/mina/voladuras',  icon: <Zap className="w-4 h-4" /> },
      { label: 'Extracción', href: '/mina/extraccion', icon: <HardHat className="w-4 h-4" /> },
      { label: 'Equipos',    href: '/mina/equipos',    icon: <Wrench className="w-4 h-4" /> },
      { label: 'Seguridad',  href: '/mina/seguridad',  icon: <ShieldCheck className="w-4 h-4" /> },
    ],
  },
  {
    id: 'planta',
    title: 'Molino',
    items: [
      { label: 'Producción',    href: '/planta/produccion',    icon: <FlaskConical className="w-4 h-4" /> },
      { label: 'Recepción',     href: '/planta/recepcion',     icon: <Layers className="w-4 h-4" /> },
      { label: 'Procesamiento', href: '/planta/procesamiento', icon: <Factory className="w-4 h-4" /> },
      { label: 'Arenas',        href: '/planta/arenas',        icon: <Package className="w-4 h-4" /> },
      { label: 'Quemado',       href: '/mina/quemado',         icon: <Flame className="w-4 h-4" /> },
    ],
  },
  {
    id: 'ops',
    title: 'Operaciones',
    items: [
      { label: 'Resumen Ejecutivo', href: '/operaciones/resumen', icon: <BookOpen className="w-4 h-4" /> },
      { label: 'Libro de Guardia',  href: '/operaciones/guardia', icon: <ClipboardList className="w-4 h-4" /> },
      { label: 'Control de Leyes',  href: '/operaciones/leyes',   icon: <TestTube2 className="w-4 h-4" /> },
      { label: 'Costo por Gramo',   href: '/operaciones/costos',  icon: <Calculator className="w-4 h-4" /> },
    ],
  },
];

// ── Accordion Section ─────────────────────────────────────────
function GlassAccordion({
  section,
  pathname,
  onNav,
  defaultOpen,
}: {
  section: NavSection;
  pathname: string;
  onNav: (href: string) => void;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const isActive = section.items.some(
    (i) => pathname.startsWith(i.href) || i.subItems?.some((s) => pathname.startsWith(s.href))
  );

  return (
    <div className="mb-0.5">
      {/* Section header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-2 py-1.5 mb-0.5 text-left"
      >
        <span className="flex-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
          {section.title}
        </span>
        <ChevronDown
          className={cn(
            'w-3 h-3 text-zinc-600 transition-transform duration-200',
            open && 'rotate-180'
          )}
        />
      </button>

      {/* Items */}
      <div
        className="overflow-hidden transition-all duration-200 ease-in-out"
        style={{ maxHeight: open ? `${section.items.length * 48 + 20}px` : '0px', opacity: open ? 1 : 0 }}
      >
        <div className="space-y-0.5 pb-2">
          {section.items.map((item) => {
            if (item.subItems) {
              const anySubActive = item.subItems.some(
                (s) => pathname === s.href || pathname.startsWith(s.href + '/')
              );
              return (
                <div key={item.label} className="mb-1">
                  <div className={cn('flex items-center gap-3 px-3 py-2 text-sm font-medium',
                    anySubActive ? 'text-amber-500' : 'text-zinc-500')}>
                    <span className={anySubActive ? 'text-amber-500' : 'text-zinc-600'}>{item.icon}</span>
                    <span className="truncate text-[13px]">{item.label}</span>
                  </div>
                  <div className="pl-9 space-y-0.5">
                    {item.subItems.map((sub) => {
                      const subActive = pathname === sub.href || pathname.startsWith(sub.href + '/');
                      return (
                        <button
                          key={sub.href}
                          onClick={() => onNav(sub.href)}
                          className={cn(
                            'w-full text-left px-3 py-2 rounded-xl text-[12px] transition-all duration-150',
                            subActive
                              ? 'bg-amber-500/10 text-amber-500 shadow-[inset_2px_0_0_0_#DAA520]'
                              : 'text-zinc-400 hover:text-white hover:bg-white/5'
                          )}
                        >
                          {sub.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            }

            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <button
                key={item.href}
                onClick={() => onNav(item.href)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 text-left',
                  active
                    ? 'bg-amber-500/10 text-amber-500 shadow-[inset_2px_0_0_0_#DAA520]'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                )}
              >
                <span className={cn('flex-shrink-0', active ? 'text-amber-500' : 'text-zinc-500')}>
                  {item.icon}
                </span>
                <span className="truncate text-[13px]">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Sidebar Props ─────────────────────────────────────────────
interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  expanded?: boolean;
  onExpandedChange?: (v: boolean) => void;
}

// ── Main Sidebar (Floating Glass Dock) ────────────────────────
export default function Sidebar({
  mobileOpen,
  onMobileClose,
}: SidebarProps) {
  const pathname = usePathname();
  const router   = useRouter();
  const { signOut, user } = useAuth();

  const handleNav = useCallback(
    (href: string) => { router.push(href); onMobileClose?.(); },
    [router, onMobileClose]
  );

  const handleSignOut = useCallback(async () => {
    await signOut();
    router.push('/');
  }, [signOut, router]);

  const defaultOpenIds = navigation
    .filter((s) => s.items.some((i) => pathname.startsWith(i.href)))
    .map((s) => s.id);

  const initials = (user?.email?.charAt(0) ?? 'U').toUpperCase();

  // ── GLASS DOCK CONTENT ────────────────────────────────────
  const dockContent = (onClose?: () => void) => (
    <div className="flex flex-col h-full">
      {/* Header / Logo */}
      <div className="flex items-center gap-3 px-4 pb-4 mb-2 border-b border-white/5">
        <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center flex-shrink-0">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4.5 h-4.5 text-amber-400">
            <path d="M2 18 L7 8 L10 13 L13 8 L18 18 Z" opacity="0.85" />
            <circle cx="14" cy="5" r="2.5" opacity="0.7" />
          </svg>
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-[14px] font-extrabold text-white/90 tracking-tight">La Fe</span>
          <span className="text-[9px] text-amber-400/70 font-bold tracking-[0.18em] uppercase">MineOS</span>
        </div>
        {/* Mobile close button */}
        {onClose && (
          <button
            onClick={onClose}
            className="ml-auto p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Dashboard pill */}
      <div className="px-2 mb-3">
        <button
          onClick={() => handleNav('/dashboard')}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
            pathname === '/dashboard'
              ? 'bg-amber-500/10 text-amber-500 shadow-[inset_2px_0_0_0_#DAA520]'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          )}
        >
          <LayoutDashboard className={cn('w-4 h-4 flex-shrink-0',
            pathname === '/dashboard' ? 'text-amber-500' : 'text-zinc-500')} />
          <span className="text-[13px]">Dashboard</span>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 min-h-0 overflow-y-auto scrollbar-hide px-2 space-y-1">
        {navigation.map((section) => (
          <GlassAccordion
            key={section.id}
            section={section}
            pathname={pathname}
            onNav={(href) => { handleNav(href); onClose?.(); }}
            defaultOpen={defaultOpenIds.includes(section.id)}
          />
        ))}
      </nav>

      {/* Footer: User pill */}
      <div className="mt-auto pt-3 border-t border-white/5 px-2">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/5">
          {/* Avatar */}
          <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
            <span className="text-amber-300 font-bold text-[12px]">{initials}</span>
          </div>
          {/* Email */}
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-zinc-300 truncate">{user?.email}</p>
            <p className="text-[9px] text-zinc-600 uppercase tracking-wider">Operaciones</p>
          </div>
          {/* Sign out */}
          <button
            onClick={handleSignOut}
            title="Cerrar sesión"
            className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* ── DESKTOP: Floating Glass Dock ── */}
      <aside className="hidden md:flex flex-col w-[260px] h-[calc(100vh-2rem)] rounded-[2rem] bg-black/40 backdrop-blur-2xl border border-white/10 shadow-2xl py-6 px-4 flex-shrink-0">
        {dockContent()}
      </aside>

      {/* ── MOBILE: Slide-in Drawer ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px] md:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={cn(
          'fixed inset-y-4 left-4 z-50 w-[260px] flex flex-col md:hidden',
          'bg-black/40 backdrop-blur-2xl border border-white/10 shadow-2xl',
          'rounded-[2rem] py-6 px-4',
          'transition-transform duration-300 ease-in-out',
          mobileOpen ? 'translate-x-0' : '-translate-x-[calc(100%+2rem)]'
        )}
      >
        {dockContent(onMobileClose)}
      </aside>
    </>
  );
}

// Keep exports for compatibility
export const COLLAPSED_W = 68;
export const EXPANDED_W  = 260;
