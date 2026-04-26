'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';
import { usePathname, useRouter } from 'next/navigation';
import {
  // Dashboard
  LayoutDashboard,
  // Finance / Admin section
  CircleDollarSign,
  Users,
  Receipt,
  Package,
  ShoppingCart,
  // Mina section (Molino)
  Pickaxe,
  Zap,
  Wrench,
  ShieldCheck,
  // Planta section (Mina)
  Factory,
  FlaskConical,
  Flame,
  Layers,
  // Operations section
  BookOpen,
  ClipboardList,
  TestTube2,
  Calculator,
  // UI utils
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  LogOut,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Navigation data ───────────────────────────────────────────────────────
interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  subItems?: { label: string; href: string }[];
}

interface NavSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  items: NavItem[];
}

const navigation: NavSection[] = [
  {
    id: 'admin',
    title: 'Administración',
    icon: <CircleDollarSign className="w-4 h-4" />,
    items: [
      { label: 'Gastos',     href: '/admin/gastos',     icon: <Receipt className="w-4 h-4" /> },
      { label: 'Inventario', href: '/admin/inventario', icon: <Package className="w-4 h-4" /> },
      { label: 'Compras',    href: '/admin/compras',    icon: <ShoppingCart className="w-4 h-4" /> },
      {
        label: 'Nómina de Personal',
        href: '#',
        icon: <Users className="w-4 h-4" />,
        subItems: [
          { label: 'Nómina Mina', href: '/mina/nomina' },
          { label: 'Nómina Molinos', href: '/planta/nomina' },
        ],
      },
    ],
  },
  {
    id: 'mina',
    title: 'Mina',
    icon: <Pickaxe className="w-4 h-4" />,
    items: [
      { label: 'Voladuras', href: '/mina/voladuras', icon: <Zap className="w-4 h-4" /> },
      { label: 'Quemado',   href: '/mina/quemado',   icon: <Flame className="w-4 h-4" /> },
      { label: 'Equipos',   href: '/mina/equipos',   icon: <Wrench className="w-4 h-4" /> },
      { label: 'Seguridad', href: '/mina/seguridad', icon: <ShieldCheck className="w-4 h-4" /> },
    ],
  },
  {
    id: 'planta',
    title: 'Molino',
    icon: <Factory className="w-4 h-4" />,
    items: [
      { label: 'Producción',   href: '/planta/produccion',   icon: <FlaskConical className="w-4 h-4" /> },
      { label: 'Recepción',    href: '/planta/recepcion',    icon: <Layers className="w-4 h-4" /> },
      { label: 'Procesamiento', href: '/planta/procesamiento', icon: <Factory className="w-4 h-4" /> },
      { label: 'Arenas',        href: '/planta/arenas',        icon: <Package className="w-4 h-4" /> },
    ],
  },
  {
    id: 'ops',
    title: 'Operaciones',
    icon: <BookOpen className="w-4 h-4" />,
    items: [
      { label: 'Resumen Ejecutivo', href: '/operaciones/resumen', icon: <BookOpen className="w-4 h-4" /> },
      { label: 'Libro de Guardia',  href: '/operaciones/guardia', icon: <ClipboardList className="w-4 h-4" /> },
      { label: 'Control de Leyes',  href: '/operaciones/leyes',   icon: <TestTube2 className="w-4 h-4" /> },
      { label: 'Costo por Gramo',   href: '/operaciones/costos',  icon: <Calculator className="w-4 h-4" /> },
    ],
  },
];

// ── Sidebar width constants ───────────────────────────────────────────────
const COLLAPSED_W = 68;   // px — icon rail
const EXPANDED_W  = 240;  // px — full sidebar

// ── Sidebar Toggle Button ─────────────────────────────────────────────────
function ToggleButton({
  expanded,
  onToggle,
}: {
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      title={expanded ? 'Colapsar menú' : 'Expandir menú'}
      className={cn(
        'absolute -right-3 top-6 z-50',
        'w-6 h-6 rounded-full',
        'bg-zinc-900 border border-zinc-700',
        'flex items-center justify-center',
        'text-zinc-400 hover:text-white hover:border-zinc-500',
        'transition-all duration-200',
        'shadow-md',
      )}
    >
      {expanded ? (
        <ChevronLeft className="w-3.5 h-3.5" />
      ) : (
        <ChevronRight className="w-3.5 h-3.5" />
      )}
    </button>
  );
}

// ── Accordion Section (expanded mode) ────────────────────────────────────
function AccordionSection({
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
  const isActive = section.items.some((i) =>
    pathname.startsWith(i.href) || i.subItems?.some(sub => pathname.startsWith(sub.href))
  );
  const contentRef = useRef<HTMLDivElement>(null);

  // Animate height using CSS max-height trick
  return (
    <div className="mb-0.5">
      {/* Section header button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left',
          'transition-colors duration-150',
          isActive
            ? 'text-white/80'
            : 'text-zinc-500 hover:text-zinc-300',
        )}
      >
        <span
          className={cn(
            'flex-shrink-0 transition-colors',
            isActive ? 'text-amber-400' : 'text-zinc-600',
          )}
        >
          {section.icon}
        </span>
        <span className="flex-1 text-[11px] font-bold uppercase tracking-[0.12em] leading-none">
          {section.title}
        </span>
        <ChevronDown
          className={cn(
            'w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200 text-zinc-600',
            open && 'rotate-180',
          )}
        />
      </button>

      {/* Animated items list */}
      <div
        ref={contentRef}
        className="overflow-hidden transition-all duration-200 ease-in-out"
        style={{
          maxHeight: open ? `${section.items.reduce((acc, item) => acc + 40 + (item.subItems ? item.subItems.length * 36 + 12 : 0), 8)}px` : '0px',
          opacity: open ? 1 : 0,
        }}
      >
        <div className="pl-3 pr-1.5 pb-1 space-y-0.5">
          {section.items.map((item) => {
            if (item.subItems) {
              const anySubActive = item.subItems.some(sub => pathname === sub.href || pathname.startsWith(sub.href + '/'));
              return (
                <div key={item.label} className="w-full flex flex-col mb-1.5 mt-0.5">
                  <div className={cn(
                    'w-full flex items-center gap-2.5 pl-4 pr-3 py-2 text-[13px] font-medium transition-colors',
                    anySubActive ? 'text-amber-400' : 'text-zinc-500'
                  )}>
                    <span className={cn('flex-shrink-0', anySubActive ? 'text-amber-400' : 'text-zinc-600')}>{item.icon}</span>
                    <span className="truncate">{item.label}</span>
                  </div>
                  <div className="pl-6 pr-1.5 space-y-0.5 border-l border-zinc-800 ml-[23px] mt-0.5">
                    {item.subItems.map(sub => {
                      const subActive = pathname === sub.href || pathname.startsWith(sub.href + '/');
                      return (
                        <button
                          key={sub.href}
                          onClick={() => onNav(sub.href)}
                          className={cn(
                            'w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[12px] transition-all duration-150 text-left',
                            subActive
                              ? 'bg-zinc-800/80 font-medium text-white border-l border-amber-500'
                              : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900',
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
                  'w-full flex items-center gap-2.5 pl-4 pr-3 py-2 rounded-lg text-[13px] transition-all duration-150 text-left',
                  active
                    ? 'bg-zinc-800/80 font-medium text-white border-l-2 border-amber-500 pl-[14px]'
                    : 'font-medium text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900',
                )}
              >
                <span className={cn('flex-shrink-0', active ? 'text-amber-400' : 'text-zinc-600')}>
                  {item.icon}
                </span>
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Collapsed Rail Icon (single section icon, tooltip on hover) ───────────
function RailSectionIcon({
  section,
  pathname,
  onNav,
}: {
  section: NavSection;
  pathname: string;
  onNav: (href: string) => void;
}) {
  const [flyoutOpen, setFlyoutOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const isActive = section.items.some(
    (i) => pathname === i.href || pathname.startsWith(i.href + '/') || i.subItems?.some(sub => pathname === sub.href || pathname.startsWith(sub.href + '/'))
  );

  const show = useCallback(() => {
    clearTimeout(timer.current);
    setFlyoutOpen(true);
  }, []);

  const hide = useCallback(() => {
    timer.current = setTimeout(() => setFlyoutOpen(false), 120);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <div
      className="relative flex justify-center w-full"
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      <button
        title={section.title}
        onClick={() => onNav(section.items[0].href)}
        className={cn(
          'w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-150',
          isActive
            ? 'bg-zinc-800 text-amber-400'
            : 'text-zinc-600 hover:text-zinc-300 hover:bg-zinc-900',
        )}
      >
        {section.icon}
      </button>

      {/* Flyout panel */}
      {flyoutOpen && (
        <div
          className="absolute left-full top-0 pl-3 z-[200]"
          onMouseEnter={show}
          onMouseLeave={hide}
        >
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden min-w-[200px]">
            <div className="px-3 py-2.5 border-b border-zinc-800">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">
                {section.title}
              </span>
            </div>
            <div className="p-1.5 space-y-0.5">
              {section.items.map((item) => {
                if (item.subItems) {
                  return (
                    <div key={item.label} className="w-full flex flex-col mb-1.5 mt-1">
                      <div className="flex items-center gap-2.5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                        <span className="text-zinc-600">{item.icon}</span>
                        {item.label}
                      </div>
                      <div className="pl-6 pr-1.5 space-y-0.5 border-l border-zinc-800 ml-[18px] mt-0.5">
                        {item.subItems.map(sub => {
                          const subActive = pathname === sub.href || pathname.startsWith(sub.href + '/');
                          return (
                            <button
                              key={sub.href}
                              onClick={() => { hide(); onNav(sub.href); }}
                              className={cn(
                                'w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[12px] transition-colors text-left',
                                subActive
                                  ? 'bg-zinc-800 text-amber-400 font-medium'
                                  : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-white',
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

                const active =
                  pathname === item.href || pathname.startsWith(item.href + '/');
                return (
                  <button
                    key={item.href}
                    onClick={() => { hide(); onNav(item.href); }}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-colors text-left',
                      active
                        ? 'bg-zinc-800/80 font-medium text-white border-l-2 border-amber-500 pl-[10px]'
                        : 'font-medium text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900',
                    )}
                  >
                    <span className={cn('flex-shrink-0', active ? 'text-amber-400' : 'text-zinc-600')}>
                      {item.icon}
                    </span>
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sidebar Props ─────────────────────────────────────────────────────────
interface SidebarProps {
  /** Mobile drawer open state */
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  /** Controlled expanded state (desktop) */
  expanded?: boolean;
  onExpandedChange?: (v: boolean) => void;
}

// ── Main Sidebar ──────────────────────────────────────────────────────────
export default function Sidebar({
  mobileOpen,
  onMobileClose,
  expanded: expandedProp,
  onExpandedChange,
}: SidebarProps) {
  const pathname = usePathname();
  const router   = useRouter();
  const { signOut, user } = useAuth();

  // Internal state (uncontrolled fallback)
  const [expandedInternal, setExpandedInternal] = useState(true);
  const expanded = expandedProp !== undefined ? expandedProp : expandedInternal;

  const toggleExpanded = useCallback(() => {
    const next = !expanded;
    setExpandedInternal(next);
    onExpandedChange?.(next);
  }, [expanded, onExpandedChange]);

  const handleNav = useCallback(
    (href: string) => {
      router.push(href);
      onMobileClose?.();
    },
    [router, onMobileClose],
  );

  const handleSignOut = useCallback(async () => {
    await signOut();
    router.push('/');
  }, [signOut, router]);

  // Persist preference
  useEffect(() => {
    try {
      const saved = localStorage.getItem('sidebar-expanded');
      if (saved !== null) {
        const v = saved === 'true';
        setExpandedInternal(v);
        onExpandedChange?.(v);
      }
    } catch {/* SSR */}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try { localStorage.setItem('sidebar-expanded', String(expanded)); } catch {/* SSR */}
  }, [expanded]);

  // Which sections start open (those containing the current path)
  const defaultOpenIds = navigation
    .filter((s) => s.items.some((i) => pathname.startsWith(i.href)))
    .map((s) => s.id);

  // User initials
  const initials = (user?.email?.charAt(0) ?? 'U').toUpperCase();

  // ── Desktop Sidebar ────────────────────────────────────────────────────
  const desktopSidebar = (
    <aside
      data-sidebar-rail
      className={cn(
        'hidden md:flex flex-col h-full flex-shrink-0 relative',
        'bg-zinc-950 border-r border-zinc-800/60 z-20',
        'transition-[width] duration-250 ease-in-out',
        // Smooth width transition
        expanded ? 'w-[240px]' : 'w-[68px]',
      )}
    >
      {/* Toggle collapse button */}
      <ToggleButton expanded={expanded} onToggle={toggleExpanded} />

      {/* Brand logo row */}
      <div
        className={cn(
          'flex items-center h-[57px] flex-shrink-0 border-b border-zinc-800/60 px-3 gap-3',
          !expanded && 'justify-center px-0',
        )}
      >
        {/* Logo mark */}
        <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/25 flex items-center justify-center flex-shrink-0">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-amber-400">
            <path d="M2 18 L7 8 L10 13 L13 8 L18 18 Z" opacity="0.85" />
            <circle cx="14" cy="5" r="2.5" opacity="0.7" />
          </svg>
        </div>
        {/* Brand name — only visible when expanded */}
        <div
          className={cn(
            'flex flex-col leading-tight overflow-hidden transition-all duration-200',
            expanded ? 'opacity-100 w-auto' : 'opacity-0 w-0',
          )}
        >
          <span className="text-[13px] font-extrabold text-white/90 tracking-tight whitespace-nowrap">
            La Fe
          </span>
          <span className="text-[9px] text-amber-400/70 font-bold tracking-[0.18em] uppercase whitespace-nowrap">
            MineOS
          </span>
        </div>
      </div>

      {/* Dashboard link */}
      <div className={cn('px-2 pt-3 pb-1', !expanded && 'px-2')}>
        <button
          onClick={() => handleNav('/dashboard')}
          title="Dashboard"
          className={cn(
            'w-full flex items-center rounded-xl transition-all duration-150',
            expanded ? 'gap-2.5 px-3 py-2' : 'justify-center py-2.5',
            pathname === '/dashboard'
              ? 'bg-zinc-800 text-amber-400'
              : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900',
          )}
        >
          <LayoutDashboard className="w-4 h-4 flex-shrink-0" />
          <span
            className={cn(
              'text-[13px] font-semibold whitespace-nowrap overflow-hidden transition-all duration-200',
              expanded ? 'opacity-100 max-w-[200px]' : 'opacity-0 max-w-0',
            )}
          >
            Dashboard
          </span>
        </button>
      </div>

      {/* Divider */}
      <div className="mx-3 h-px bg-zinc-800/60 my-1" />

      {/* Navigation sections */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-1 space-y-0.5">
        {expanded
          ? navigation.map((section) => (
              <AccordionSection
                key={section.id}
                section={section}
                pathname={pathname}
                onNav={handleNav}
                defaultOpen={defaultOpenIds.includes(section.id)}
              />
            ))
          : navigation.map((section) => (
              <RailSectionIcon
                key={section.id}
                section={section}
                pathname={pathname}
                onNav={handleNav}
              />
            ))}
      </nav>

      {/* Divider */}
      <div className="mx-3 h-px bg-zinc-800/60 mb-1" />

      {/* User + sign out */}
      <div
        className={cn(
          'flex items-center px-3 py-3 gap-2.5',
          !expanded && 'flex-col px-2',
        )}
      >
        {/* Avatar */}
        <div className="w-7 h-7 rounded-full bg-amber-500/15 border border-amber-500/25 flex items-center justify-center flex-shrink-0">
          <span className="text-amber-300 font-bold text-[11px]">{initials}</span>
        </div>

        {/* Email — only visible when expanded */}
        {expanded && (
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-zinc-400 truncate">
              {user?.email}
            </p>
          </div>
        )}

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          title="Cerrar sesión"
          className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );

  // ── Mobile Drawer ──────────────────────────────────────────────────────
  const mobileDrawer = (
    <>
      {/* Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px] md:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-[280px] flex flex-col h-[100dvh] md:hidden',
          'bg-zinc-950 border-r border-zinc-800/60 shadow-2xl',
          'transition-transform duration-300 ease-in-out',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Mobile header */}
        <div className="flex items-center justify-between px-4 h-14 border-b border-zinc-800/60 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-amber-400">
                <path d="M2 18 L7 8 L10 13 L13 8 L18 18 Z" opacity="0.85" />
                <circle cx="14" cy="5" r="2.5" opacity="0.7" />
              </svg>
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-[13px] font-extrabold text-white/90 tracking-tight">La Fe</span>
              <span className="text-[9px] text-amber-400/70 font-bold tracking-[0.18em] uppercase">MineOS</span>
            </div>
          </div>
          <button
            onClick={onMobileClose}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dashboard */}
        <div className="px-3 pt-3 pb-1">
          <button
            onClick={() => handleNav('/dashboard')}
            className={cn(
              'flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-[13px] transition-colors',
              pathname === '/dashboard'
                ? 'bg-zinc-800 font-medium text-white'
                : 'font-medium text-zinc-500 hover:text-white hover:bg-zinc-900',
            )}
          >
            <LayoutDashboard className={cn(
              'w-4 h-4 flex-shrink-0',
              pathname === '/dashboard' ? 'text-amber-400' : ''
            )} />
            Dashboard
          </button>
        </div>

        <div className="mx-4 h-px bg-zinc-800/60 my-1" />

        {/* Full accordion nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
          {navigation.map((section) => (
            <AccordionSection
              key={section.id}
              section={section}
              pathname={pathname}
              onNav={handleNav}
              defaultOpen={defaultOpenIds.includes(section.id)}
            />
          ))}
        </nav>

        <div className="mx-4 h-px bg-zinc-800/60" />

        {/* User + Sign out */}
        <div
          className="px-4 py-4 flex items-center justify-between gap-3 flex-shrink-0"
          style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-full bg-amber-500/15 border border-amber-500/25 flex items-center justify-center flex-shrink-0">
              <span className="text-amber-300 font-bold text-xs">{initials}</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[12px] font-semibold text-zinc-400 truncate">{user?.email}</span>
              <span className="text-[10px] text-zinc-600 truncate">Operaciones</span>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            title="Cerrar sesión"
            className="p-2 rounded-xl text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </aside>
    </>
  );

  return (
    <>
      {desktopSidebar}
      {mobileDrawer}
    </>
  );
}

// ── Export sidebar width constants for layout use ─────────────────────────
export { COLLAPSED_W, EXPANDED_W };
