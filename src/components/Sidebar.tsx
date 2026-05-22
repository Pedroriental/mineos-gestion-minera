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

type SidebarVariant = 'default' | 'dashboard';

function getSidebarTone(variant: SidebarVariant) {
  if (variant === 'dashboard') {
    return {
      sectionLabel: 'text-[var(--dashboard-text-muted)]',
      chevron: 'text-[var(--dashboard-text-muted)]',
      navIdle:
        'text-[var(--dashboard-text-muted)] hover:text-[var(--dashboard-text)] hover:bg-black/[0.06]',
      navIconIdle: 'text-[var(--dashboard-text-muted)]',
      subParentIdle: 'text-[var(--dashboard-text-muted)]',
      subParentIcon: 'text-[var(--dashboard-text-muted)]',
      subIdle:
        'text-[var(--dashboard-text-muted)] hover:text-[var(--dashboard-text)] transition-colors',
      headerBorder: 'border-[var(--dashboard-border)]',
      headerTitle: 'text-[var(--dashboard-text)]',
      closeBtn:
        'text-[var(--dashboard-text-muted)] hover:text-[var(--dashboard-text)] hover:bg-black/[0.06]',
      footerBorder: 'border-[var(--dashboard-border)]',
      userCard: 'bg-[var(--dashboard-card-muted)] border border-[var(--dashboard-border)]',
      userEmail: 'text-[var(--dashboard-text)]',
      userRole: 'text-[var(--dashboard-text-muted)]',
      dashboardNavIdle:
        'text-[var(--dashboard-text-muted)] hover:text-[var(--dashboard-text)] hover:bg-black/[0.06]',
      dashboardNavIcon: 'text-[var(--dashboard-text-muted)]',
    };
  }
  return {
    sectionLabel: 'text-zinc-500',
    chevron: 'text-zinc-600',
    navIdle: 'text-zinc-400 hover:text-white hover:bg-white/5',
    navIconIdle: 'text-zinc-500',
    subParentIdle: 'text-zinc-500',
    subParentIcon: 'text-zinc-600',
    subIdle: 'text-zinc-500 hover:text-zinc-300 transition-colors',
    headerBorder: 'border-white/5',
    headerTitle: 'text-white/90',
    closeBtn: 'text-zinc-500 hover:text-white hover:bg-white/5',
    footerBorder: 'border-white/5',
    userCard: 'bg-white/[0.03] border border-white/5',
    userEmail: 'text-zinc-300',
    userRole: 'text-zinc-600',
    dashboardNavIdle: 'text-zinc-400 hover:text-white hover:bg-white/5',
    dashboardNavIcon: 'text-zinc-500',
  };
}

// ── Item con submenú plegable (ej. Nómina de Personal) ────────
function NavItemWithSubmenu({
  item,
  pathname,
  onNav,
  variant,
}: {
  item: NavItem;
  pathname: string;
  onNav: (href: string) => void;
  variant: SidebarVariant;
}) {
  const tone = getSidebarTone(variant);
  const subItems = item.subItems ?? [];
  const anySubActive = subItems.some(
    (s) => pathname === s.href || pathname.startsWith(s.href + '/'),
  );
  const [open, setOpen] = useState(anySubActive);

  useEffect(() => {
    if (anySubActive) setOpen(true);
  }, [anySubActive]);

  return (
    <div className="mb-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors',
          anySubActive ? 'text-amber-500' : tone.subParentIdle,
          !anySubActive && tone.navIdle,
        )}
      >
        <span className={cn('flex-shrink-0', anySubActive ? 'text-amber-500' : tone.subParentIcon)}>
          {item.icon}
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px]">{item.label}</span>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 flex-shrink-0 transition-transform duration-200',
            tone.chevron,
            anySubActive && 'text-amber-500/80',
            open && 'rotate-180',
          )}
        />
      </button>
      <div
        className="overflow-hidden transition-all duration-200 ease-in-out"
        style={{ maxHeight: open ? `${subItems.length * 44}px` : '0px', opacity: open ? 1 : 0 }}
      >
        <div className="mt-0.5 space-y-0.5">
          {subItems.map((sub) => {
            const subActive = pathname === sub.href || pathname.startsWith(sub.href + '/');
            return (
              <button
                key={sub.href}
                type="button"
                onClick={() => onNav(sub.href)}
                className={cn(
                  'block w-full py-2.5 pl-12 text-left text-[13px] transition-all duration-150',
                  subActive
                    ? 'font-medium text-amber-500'
                    : tone.subIdle,
                )}
              >
                {sub.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Accordion Section ─────────────────────────────────────────
function GlassAccordion({
  section,
  pathname,
  onNav,
  defaultOpen,
  variant,
}: {
  section: NavSection;
  pathname: string;
  onNav: (href: string) => void;
  defaultOpen: boolean;
  variant: SidebarVariant;
}) {
  const tone = getSidebarTone(variant);
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
        <span
          className={cn(
            'flex-1 text-[10px] font-semibold uppercase tracking-widest',
            tone.sectionLabel,
          )}
        >
          {section.title}
        </span>
        <ChevronDown
          className={cn(
            'w-3 h-3 transition-transform duration-200',
            tone.chevron,
            open && 'rotate-180',
          )}
        />
      </button>

      {/* Items */}
      <div
        className="overflow-hidden transition-all duration-200 ease-in-out"
        style={{ maxHeight: open ? '600px' : '0px', opacity: open ? 1 : 0 }}
      >
        <div className="space-y-0.5 pb-2">
          {section.items.map((item) => {
            if (item.subItems?.length) {
              return (
                <NavItemWithSubmenu
                  key={item.label}
                  item={item}
                  pathname={pathname}
                  onNav={onNav}
                  variant={variant}
                />
              );
            }

            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <button
                key={item.href}
                onClick={() => onNav(item.href)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-all duration-150 text-left',
                  active
                    ? 'bg-amber-500/10 text-amber-500 shadow-[inset_3px_0_0_0_#DAA520] font-medium rounded-r-xl rounded-l-none'
                    : cn(tone.navIdle, 'transition-colors rounded-xl'),
                )}
              >
                <span
                  className={cn('flex-shrink-0', active ? 'text-amber-500' : tone.navIconIdle)}
                >
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
  variant?: 'default' | 'dashboard';
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  expanded?: boolean;
  onExpandedChange?: (v: boolean) => void;
}

const sidebarShellClass = (variant: 'default' | 'dashboard') =>
  cn(
    'flex flex-col w-[260px] py-6 px-4 flex-shrink-0',
    variant === 'dashboard'
      ? 'rounded-xl border border-[var(--dashboard-border)] bg-[var(--dashboard-bg)]'
      : 'rounded-[2rem] bg-zinc-900/40 backdrop-blur-2xl border border-white/5 shadow-2xl',
  );

// ── Main Sidebar (Floating Glass Dock) ────────────────────────
export default function Sidebar({
  variant = 'default',
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
    .filter((s) =>
      s.items.some(
        (i) =>
          (i.href !== '#' && pathname.startsWith(i.href)) ||
          i.subItems?.some((sub) => pathname === sub.href || pathname.startsWith(sub.href + '/')),
      ),
    )
    .map((s) => s.id);

  const initials = (user?.email?.charAt(0) ?? 'U').toUpperCase();
  const tone = getSidebarTone(variant);

  // ── GLASS DOCK CONTENT ────────────────────────────────────
  const dockContent = (onClose?: () => void) => (
    <div className="flex flex-col h-full">
      {/* Header / Logo */}
      <div className={cn('flex items-center gap-3 px-4 pb-4 mb-2 border-b', tone.headerBorder)}>
        <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center flex-shrink-0">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4.5 h-4.5 text-amber-400">
            <path d="M2 18 L7 8 L10 13 L13 8 L18 18 Z" opacity="0.85" />
            <circle cx="14" cy="5" r="2.5" opacity="0.7" />
          </svg>
        </div>
        <div className="flex flex-col leading-tight">
          <span className={cn('text-[14px] font-extrabold tracking-tight', tone.headerTitle)}>
            La Fe
          </span>
          <span className="text-[9px] text-amber-400/70 font-bold tracking-[0.18em] uppercase">MineOS</span>
        </div>
        {/* Mobile close button */}
        {onClose && (
          <button
            onClick={onClose}
            className={cn('ml-auto p-1.5 rounded-lg transition-colors', tone.closeBtn)}
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
            'w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-all duration-150 text-left',
            pathname === '/dashboard'
              ? 'bg-amber-500/10 text-amber-500 shadow-[inset_3px_0_0_0_#DAA520] font-medium rounded-r-xl rounded-l-none'
              : cn(tone.dashboardNavIdle, 'transition-colors rounded-xl'),
          )}
        >
          <LayoutDashboard
            className={cn(
              'w-4 h-4 flex-shrink-0',
              pathname === '/dashboard' ? 'text-amber-500' : tone.dashboardNavIcon,
            )}
          />
          <span className="text-[13px]">Dashboard</span>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 min-h-0 overflow-y-auto scrollbar-hide [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none'] px-2 space-y-1">
        {navigation.map((section) => (
          <GlassAccordion
            key={section.id}
            section={section}
            pathname={pathname}
            onNav={(href) => { handleNav(href); onClose?.(); }}
            defaultOpen={defaultOpenIds.includes(section.id)}
            variant={variant}
          />
        ))}
      </nav>

      {/* Footer: User pill */}
      <div className={cn('mt-auto border-t pt-4 mt-2 px-2', tone.footerBorder)}>
        <div className={cn('flex items-center gap-3 px-3 py-2.5 rounded-xl', tone.userCard)}>
          {/* Avatar */}
          <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
            <span className="text-amber-300 font-bold text-[12px]">{initials}</span>
          </div>
          {/* Email */}
          <div className="flex-1 min-w-0">
            <p className={cn('text-[11px] font-semibold truncate', tone.userEmail)}>{user?.email}</p>
            <p className={cn('text-[9px] uppercase tracking-wider', tone.userRole)}>Operaciones</p>
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
      <aside
        data-sidebar
        data-sidebar-variant={variant}
        className={cn('hidden md:flex h-[calc(100vh-2rem)]', sidebarShellClass(variant))}
      >
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
        data-sidebar
        data-sidebar-variant={variant}
        className={cn(
          'fixed inset-y-4 left-4 z-50 md:hidden',
          sidebarShellClass(variant),
          'transition-transform duration-300 ease-in-out',
          mobileOpen ? 'translate-x-0' : '-translate-x-[calc(100%+2rem)]',
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
