'use client';

import { useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/lib/auth-context';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutGrid,
  CircleDollarSign,
  FileSearch,
  Users,
  Receipt,
  Package,
  Zap,
  Wrench,
  HardHat,
  FlaskConical,
  Flame,
  Truck,
  BookOpen,
  ChevronDown,
  LogOut,
  X,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { MineosLogo, sidebarIconSurface } from '@/components/brand/MineosLogo';
import { useTheme } from '@/lib/theme-context';

type SidebarVariant = 'default' | 'dashboard';

interface NavItemData {
  label: string;
  href: string;
  icon: React.ReactNode;
  subItems?: { label: string; href: string }[];
}
interface NavSection {
  id: string;
  title: string;
  items: NavItemData[];
}

const standaloneItems: NavItemData[] = [
  { label: 'Dashboard', href: '/dashboard', icon: <LayoutGrid className="w-4 h-4" /> },
  { label: 'Reporte y Balances', href: '/reportes-balances', icon: <CircleDollarSign className="w-4 h-4" /> },
  { label: 'Constructor de Reportes', href: '/reportes/constructor', icon: <FileSearch className="w-4 h-4" /> },
];

const navigation: NavSection[] = [
  {
    id: 'admin',
    title: 'Administración',
    items: [
      { label: 'Resumen Ejecutivo', href: '/operaciones/resumen', icon: <BookOpen className="w-4 h-4" /> },
      {
        label: 'Gastos', href: '#', icon: <Receipt className="w-4 h-4" />,
        subItems: [
          { label: 'Registros de Gastos', href: '/admin/gastos' },
          { label: 'Resumen de Gastos', href: '/admin/gastos/resumen' },
          { label: 'Catálogo', href: '/admin/gastos/conceptos' },
        ],
      },
      { label: 'Inventario', href: '/admin/inventario', icon: <Package className="w-4 h-4" /> },
      {
        label: 'Nómina de Personal', href: '#', icon: <Users className="w-4 h-4" />,
        subItems: [
          { label: 'Base de Trabajadores', href: '/admin/trabajadores' },
          { label: 'Nómina Mina', href: '/mina/nomina' },
          { label: 'Nómina Molinos', href: '/planta/nomina' },
        ],
      },
    ],
  },
  {
    id: 'mina',
    title: 'Mina',
    items: [
      { label: 'Voladuras', href: '/mina/voladuras', icon: <Zap className="w-4 h-4" /> },
      { label: 'Extracción', href: '/mina/extraccion', icon: <HardHat className="w-4 h-4" /> },
      { label: 'Equipos', href: '/mina/equipos', icon: <Wrench className="w-4 h-4" /> },
    ],
  },
  {
    id: 'planta',
    title: 'Molino',
    items: [
      { label: 'Producción', href: '/planta/produccion', icon: <FlaskConical className="w-4 h-4" /> },
      { label: 'Acarreo', href: '/planta/acarreo', icon: <Truck className="w-4 h-4" /> },
      { label: 'Quemado', href: '/mina/quemado', icon: <Flame className="w-4 h-4" /> },
    ],
  },
];

/* ── Visual language ──
   Active   → hairline gold indicator + soft gold wash fading right
   Idle     → muted text, hover lifts text + faint surface
   Sections → quiet uppercase labels, no chrome                    */
const itemBase =
  'group relative flex w-full items-center gap-3 rounded-lg text-[13px] leading-none outline-none transition-all duration-200 ease-out';
const activeClass =
  'font-medium text-[var(--dashboard-text)] bg-gradient-to-r from-amber-500/[0.14] via-amber-500/[0.05] to-transparent';
const idleClass =
  'text-[var(--dashboard-text-muted)] hover:text-[var(--dashboard-text)] hover:bg-black/[0.04] dark:hover:bg-white/[0.05]';
const iconActive = 'text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.35)]';
const iconIdle =
  'text-[var(--dashboard-text-muted)] transition-colors duration-200 group-hover:text-[var(--dashboard-text)]';

function ActiveIndicator({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'pointer-events-none absolute top-1/2 h-[1em] w-[2px] -translate-y-1/2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.55)]',
        className ?? 'left-0',
      )}
    />
  );
}

function buildNavHref(href: string, searchParams: URLSearchParams) {
  if (href === '#') return href;
  const desde = searchParams.get('desde');
  const hasta = searchParams.get('hasta');
  if (!desde || !hasta) return href;
  const params = new URLSearchParams({ desde, hasta });
  return `${href}?${params.toString()}`;
}

function NavTooltip({ label, show, children }: { label: string; show: boolean; children: React.ReactNode }) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  const updatePos = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos({ x: rect.right + 10, y: rect.top + rect.height / 2 });
  }, []);

  if (!show) return <>{children}</>;

  return (
    <>
      <div
        ref={anchorRef}
        className="relative"
        onMouseEnter={() => {
          updatePos();
          setVisible(true);
        }}
        onMouseLeave={() => {
          setVisible(false);
          setPos(null);
        }}
        onFocus={() => {
          updatePos();
          setVisible(true);
        }}
        onBlur={() => {
          setVisible(false);
          setPos(null);
        }}
      >
        {children}
      </div>
      {visible && pos && typeof document !== 'undefined'
        ? createPortal(
            <div
              role="tooltip"
              className="pointer-events-none fixed z-[250] -translate-y-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-xl"
              style={{ left: pos.x, top: pos.y }}
            >
              {label}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function NavItem({
  item,
  active,
  expanded,
  onNav,
  navHref,
}: {
  item: NavItemData;
  active: boolean;
  expanded: boolean;
  onNav: (href: string) => void;
  navHref: string;
}) {
  const className = cn(
    itemBase,
    expanded ? 'px-2.5 py-2 text-left' : 'justify-center px-0 py-2',
    active ? activeClass : idleClass,
  );

  const content = (
    <>
      {active && <ActiveIndicator />}
      <span className={cn('flex-shrink-0', active ? iconActive : iconIdle)}>
        {item.icon}
      </span>
      {expanded && <span className="truncate">{item.label}</span>}
    </>
  );

  return (
    <NavTooltip label={item.label} show={!expanded}>
      {item.href === '#' ? (
        <button type="button" onClick={() => onNav(item.href)} className={className}>
          {content}
        </button>
      ) : (
        <Link href={navHref} onClick={() => onNav(item.href)} className={className}>
          {content}
        </Link>
      )}
    </NavTooltip>
  );
}

function NavItemWithSubmenu({
  item,
  pathname,
  expanded,
  onNav,
  getNavHref,
}: {
  item: NavItemData;
  pathname: string;
  expanded: boolean;
  onNav: (href: string) => void;
  getNavHref: (href: string) => string;
}) {
  const subItems = item.subItems ?? [];
  const anySubActive = subItems.some(
    (s) => pathname === s.href || pathname.startsWith(s.href + '/'),
  );
  const [open, setOpen] = useState(anySubActive);
  const [prevAnySubActive, setPrevAnySubActive] = useState(anySubActive);

  // Abrir el submenú cuando la ruta activa entra en él (ajuste de estado en render)
  if (anySubActive !== prevAnySubActive) {
    setPrevAnySubActive(anySubActive);
    if (anySubActive) setOpen(true);
  }

  if (!expanded) {
    return (
      <NavTooltip label={item.label} show>
        <button
          type="button"
          onClick={() => onNav('#')}
          className={cn(
            itemBase,
            'justify-center px-0 py-2',
            anySubActive ? activeClass : idleClass,
          )}
        >
          {anySubActive && <ActiveIndicator />}
          <span className={cn('flex-shrink-0', anySubActive ? iconActive : iconIdle)}>
            {item.icon}
          </span>
        </button>
      </NavTooltip>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(itemBase, 'px-2.5 py-2 text-left', anySubActive ? activeClass : idleClass)}
      >
        {anySubActive && <ActiveIndicator />}
        <span className={cn('flex-shrink-0', anySubActive ? iconActive : iconIdle)}>
          {item.icon}
        </span>
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 flex-shrink-0 text-[var(--dashboard-text-muted)] opacity-60 transition-transform duration-300 ease-out',
            open && 'rotate-180',
            anySubActive && 'text-amber-400/80 opacity-100',
          )}
        />
      </button>
      <div
        className={cn(
          'grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        )}
      >
        <div className="overflow-hidden">
          <div className="ml-[19px] mt-1 space-y-0.5 border-l border-[var(--dashboard-border)] pb-1 pl-[15px]">
            {subItems.map((sub) => {
              const subActive =
                sub.href === '/admin/gastos'
                  ? pathname === '/admin/gastos'
                  : pathname === sub.href || pathname.startsWith(`${sub.href}/`);
              return (
                <Link
                  key={sub.href}
                  href={getNavHref(sub.href)}
                  onClick={() => onNav(sub.href)}
                  className={cn(
                    'relative flex w-full items-center rounded-md px-2 py-1.5 text-left text-[12.5px] leading-none transition-all duration-200 ease-out',
                    subActive
                      ? 'font-medium text-amber-400'
                      : 'text-[var(--dashboard-text-muted)] hover:translate-x-px hover:text-[var(--dashboard-text)]',
                  )}
                >
                  {subActive && <ActiveIndicator className="-left-4" />}
                  <span className="truncate">{sub.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({
  section,
  pathname,
  expanded,
  onNav,
  onCollapsedItemClick,
  getNavHref,
}: {
  section: NavSection;
  pathname: string;
  expanded: boolean;
  onNav: (href: string) => void;
  onCollapsedItemClick?: (item: NavItemData) => void;
  getNavHref: (href: string) => string;
}) {
  if (!expanded) {
    return (
      <div className="px-2">
        <div aria-hidden className="mx-2 my-2 h-px bg-[var(--dashboard-border)]" />
        <div className="space-y-0.5">
          {section.items.map((item) => {
            if (item.subItems?.length) {
              const anySubActive = item.subItems.some(
                (s) => pathname === s.href || pathname.startsWith(s.href + '/'),
              );
              return (
                <NavTooltip key={item.label} label={item.label} show>
                  <button
                    type="button"
                    onClick={() => onCollapsedItemClick?.(item)}
                    className={cn(
                      itemBase,
                      'justify-center px-0 py-2',
                      anySubActive ? activeClass : idleClass,
                    )}
                  >
                    {anySubActive && <ActiveIndicator />}
                    <span className={cn('flex-shrink-0', anySubActive ? iconActive : iconIdle)}>
                      {item.icon}
                    </span>
                  </button>
                </NavTooltip>
              );
            }
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <NavItem
                key={item.href}
                item={item}
                active={active}
                expanded={false}
                onNav={onNav}
                navHref={getNavHref(item.href)}
              />
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="select-none px-[1.375rem] pb-1 pt-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--dashboard-text-muted)] opacity-60">
        {section.title}
      </p>
      <div className="space-y-0.5 px-2">
        {section.items.map((item) => {
          if (item.subItems?.length) {
            return (
              <NavItemWithSubmenu
                key={item.label}
                item={item}
                pathname={pathname}
                expanded
                onNav={onNav}
                getNavHref={getNavHref}
              />
            );
          }
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <NavItem
              key={item.href}
              item={item}
              active={active}
              expanded
              onNav={onNav}
              navHref={getNavHref(item.href)}
            />
          );
        })}
      </div>
    </div>
  );
}

interface SidebarProps {
  variant?: SidebarVariant;
  expanded?: boolean;
  onExpandedChange?: (v: boolean) => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function Sidebar({
  variant = 'default',
  expanded,
  onExpandedChange,
  mobileOpen,
  onMobileClose,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signOut, user } = useAuth();
  const { theme } = useTheme();

  const isExpanded = expanded ?? true;

  const resolveSubItemHref = useCallback((item: NavItemData) => {
    const subItems = item.subItems ?? [];
    if (!subItems.length) return item.href;
    const activeSub = subItems.find(
      (s) => pathname === s.href || pathname.startsWith(s.href + '/'),
    );
    return activeSub?.href ?? subItems[0].href;
  }, [pathname]);

  const getNavHref = useCallback(
    (href: string) => buildNavHref(href, searchParams),
    [searchParams],
  );

  const handleNav = useCallback(
    (_href: string) => {
      onMobileClose?.();
    },
    [onMobileClose],
  );

  const handleCollapsedSectionItemClick = useCallback(
    (item: NavItemData) => {
      const target = item.subItems?.length ? resolveSubItemHref(item) : item.href;
      if (target !== '#') {
        router.push(getNavHref(target));
      }
      onMobileClose?.();
    },
    [resolveSubItemHref, router, getNavHref, onMobileClose],
  );

  const handleSignOut = useCallback(async () => {
    await signOut();
    router.push('/');
  }, [signOut, router]);

  const initials = (user?.email?.charAt(0) ?? 'U').toUpperCase();

  const iconSurface = sidebarIconSurface(variant, theme);

  const shellClass = cn(
    'flex flex-col flex-shrink-0',
    'transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
    isExpanded ? 'w-[240px]' : 'w-[68px]',
    variant === 'dashboard' ? 'py-3' : 'py-6',
    variant === 'dashboard'
      ? 'rounded-xl border border-[var(--dashboard-border)] bg-[var(--dashboard-bg)] h-full max-h-full'
      : 'rounded-[2rem] bg-zinc-900/40 backdrop-blur-2xl border border-white/5 shadow-2xl h-[calc(100vh-2rem)]',
  );

  const collapseButtonClass =
    'rounded-lg p-1.5 text-[var(--dashboard-text-muted)] opacity-70 transition-all duration-200 hover:bg-black/[0.05] hover:text-[var(--dashboard-text)] hover:opacity-100 dark:hover:bg-white/[0.06]';

  const dockContent = (opts?: { showClose?: boolean; onClose?: () => void; desktop?: boolean }) => (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div
        className={cn(
          'flex items-center gap-3 border-b border-[var(--dashboard-border)] px-3 pb-3 mb-1',
          !isExpanded && 'justify-center',
        )}
      >
        <MineosLogo
          variant="icon"
          surface={iconSurface}
          className={cn('shrink-0 object-[center_46%]', isExpanded ? 'h-9 w-9' : 'h-8 w-8')}
          alt=""
        />
        {isExpanded && (
          <>
            <div className="flex min-w-0 flex-1 flex-col gap-px leading-none">
              <span className="text-[14px] font-extrabold tracking-tight text-[var(--dashboard-text)]">
                La Fe
              </span>
              <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-amber-400/70">
                MineOS
              </span>
            </div>
            {opts?.desktop && (
              <button
                type="button"
                onClick={() => onExpandedChange?.(false)}
                aria-label="Plegar menú"
                title="Plegar menú"
                className={collapseButtonClass}
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            )}
            {opts?.showClose && opts?.onClose && (
              <button
                onClick={opts.onClose}
                aria-label="Cerrar menú"
                className={collapseButtonClass}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </>
        )}
      </div>

      {/* Expand toggle (collapsed desktop only) */}
      {opts?.desktop && !isExpanded && (
        <div className="flex justify-center px-2 pb-1">
          <NavTooltip label="Expandir menú" show>
            <button
              type="button"
              onClick={() => onExpandedChange?.(true)}
              aria-label="Expandir menú"
              className={collapseButtonClass}
            >
              <PanelLeft className="h-4 w-4" />
            </button>
          </NavTooltip>
        </div>
      )}

      {/* Sections */}
      <nav className="sidebar-nav-scroll scroll-y-fade min-h-0 flex-1 overflow-x-hidden overflow-y-auto pt-1">
        <div className="space-y-0.5 px-2">
          <NavItem
            item={standaloneItems[0]}
            active={pathname === '/dashboard'}
            expanded={isExpanded}
            onNav={handleNav}
            navHref={getNavHref('/dashboard')}
          />
          <NavItem
            item={standaloneItems[1]}
            active={pathname === '/reportes-balances' || pathname.startsWith('/reportes-balances/')}
            expanded={isExpanded}
            onNav={handleNav}
            navHref={getNavHref('/reportes-balances')}
          />
          <NavItem
            item={standaloneItems[2]}
            active={pathname === '/reportes/constructor' || pathname.startsWith('/reportes/constructor')}
            expanded={isExpanded}
            onNav={handleNav}
            navHref={getNavHref('/reportes/constructor')}
          />
        </div>

        {navigation.map((section) => (
          <Section
            key={section.id}
            section={section}
            pathname={pathname}
            expanded={isExpanded}
            onNav={handleNav}
            onCollapsedItemClick={handleCollapsedSectionItemClick}
            getNavHref={getNavHref}
          />
        ))}
      </nav>

      {/* Footer */}
      <div className="mt-auto shrink-0 border-t border-[var(--dashboard-border)] px-2 pt-2">
        {isExpanded ? (
          <div className="group flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors duration-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.05]">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400/25 to-amber-600/10 ring-1 ring-amber-500/30">
              <span className="text-[12px] font-bold text-amber-300">{initials}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-semibold text-[var(--dashboard-text)]">{user?.email}</p>
              <p className="text-[9px] uppercase tracking-wider text-[var(--dashboard-text-muted)]">Operaciones</p>
            </div>
            <button
              onClick={handleSignOut}
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
              className="flex-shrink-0 rounded-lg p-1.5 text-[var(--dashboard-text-muted)] opacity-60 transition-all duration-200 hover:bg-red-500/10 hover:text-red-400 hover:opacity-100"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1 pb-1">
            <NavTooltip label={user?.email ?? 'Usuario'} show>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-amber-400/25 to-amber-600/10 ring-1 ring-amber-500/30">
                <span className="text-[12px] font-bold text-amber-300">{initials}</span>
              </div>
            </NavTooltip>
            <NavTooltip label="Cerrar sesión" show>
              <button
                onClick={handleSignOut}
                aria-label="Cerrar sesión"
                className="rounded-lg p-1.5 text-[var(--dashboard-text-muted)] opacity-60 transition-all duration-200 hover:bg-red-500/10 hover:text-red-400 hover:opacity-100"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </NavTooltip>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <aside
        data-sidebar
        data-sidebar-variant={variant}
        data-expanded={isExpanded}
        className={cn('relative z-40 hidden md:flex', shellClass)}
      >
        {dockContent({ desktop: true })}
      </aside>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/55 backdrop-blur-md md:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      {/* Mobile drawer */}
      <aside
        data-sidebar
        data-sidebar-variant={variant}
        className={cn(
          'fixed inset-y-3 left-3 z-50 w-[min(18.5rem,calc(100vw-1.5rem))] md:hidden',
          'flex flex-col rounded-2xl border border-white/[0.08]',
          'bg-[color-mix(in_srgb,var(--dashboard-bg,#09090b)_78%,transparent)]',
          'py-3 px-3 shadow-[0_24px_80px_rgba(0,0,0,0.55)]',
          'backdrop-blur-2xl backdrop-saturate-150',
          'transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
          mobileOpen ? 'translate-x-0' : '-translate-x-[calc(100%+1.5rem)]',
        )}
      >
        {dockContent({ showClose: true, onClose: onMobileClose })}
      </aside>
    </>
  );
}

export const COLLAPSED_W = 68;
export const EXPANDED_W = 240;
