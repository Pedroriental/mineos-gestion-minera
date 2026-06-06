'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/lib/auth-context';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutGrid,
  CircleDollarSign,
  FileSearch,
  Users,
  Receipt,
  Package,
  ShoppingCart,
  Zap,
  Wrench,
  HardHat,
  FlaskConical,
  Flame,
  Layers,
  BookOpen,
  ChevronDown,
  Database,
  LogOut,
  X,
  PanelLeftClose,
  PanelLeft,
  ShieldCheck,
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
          { label: 'Catálogo', href: '/admin/gastos/conceptos' },
        ],
      },
      { label: 'Inventario', href: '/admin/inventario', icon: <Package className="w-4 h-4" /> },
      { label: 'Compras',    href: '/admin/compras',    icon: <ShoppingCart className="w-4 h-4" /> },
      { label: 'Integridad Financiera', href: '/operaciones/integridad', icon: <ShieldCheck className="w-4 h-4" /> },
      {
        label: 'Nómina de Personal', href: '#', icon: <Users className="w-4 h-4" />,
        subItems: [
          { label: 'Base de Trabajadores', href: '/admin/trabajadores' },
          { label: 'Nómina Mina', href: '/mina/nomina' },
          { label: 'Nómina Molinos', href: '/planta/nomina' },
        ],
      },
      {
        label: 'Datos de Plataforma', href: '#', icon: <Database className="w-4 h-4" />,
        subItems: [
          { label: 'Datos Fiscales', href: '/plataforma/datos-fiscales' },
          { label: 'Biblioteca de Variables', href: '/plataforma/biblioteca-variables' },
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
      { label: 'Recepción', href: '/planta/recepcion', icon: <Layers className="w-4 h-4" /> },
      { label: 'Arenas', href: '/planta/arenas', icon: <Package className="w-4 h-4" /> },
      { label: 'Quemado', href: '/mina/quemado', icon: <Flame className="w-4 h-4" /> },
    ],
  },
];

const activeClass =
  'bg-amber-500/15 text-amber-400 font-medium rounded-lg border border-amber-500/20 shadow-[inset_0_1px_0_0_rgba(251,191,36,0.08)]';
const idleClass = 'text-[var(--dashboard-text-muted)] hover:text-[var(--dashboard-text)] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] rounded-lg transition-colors duration-150';
const activeSubClass = 'font-medium text-amber-400';
const idleSubClass = 'text-[var(--dashboard-text-muted)] hover:text-[var(--dashboard-text)] transition-colors duration-150';

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
}: {
  item: NavItemData;
  active: boolean;
  expanded: boolean;
  onNav: (href: string) => void;
}) {
  return (
    <NavTooltip label={item.label} show={!expanded}>
      <button
        type="button"
        onClick={() => onNav(item.href)}
        className={cn(
          'flex w-full items-center gap-3 text-sm transition-all duration-150',
          expanded ? 'px-2.5 py-2 text-left' : 'justify-center px-0 py-2',
          active ? activeClass : idleClass,
        )}
      >
        <span className={cn('flex-shrink-0', !active && 'text-[var(--dashboard-text-muted)]')}>
          {item.icon}
        </span>
        {expanded && <span className="truncate text-[13px]">{item.label}</span>}
      </button>
    </NavTooltip>
  );
}

function NavItemWithSubmenu({
  item,
  pathname,
  expanded,
  onNav,
  onCollapsedClick,
  forceOpen = false,
}: {
  item: NavItemData;
  pathname: string;
  expanded: boolean;
  onNav: (href: string) => void;
  onCollapsedClick?: () => void;
  forceOpen?: boolean;
}) {
  const subItems = item.subItems ?? [];
  const anySubActive = subItems.some(
    (s) => pathname === s.href || pathname.startsWith(s.href + '/'),
  );
  const [open, setOpen] = useState(anySubActive || forceOpen);

  useEffect(() => {
    if (anySubActive || forceOpen) setOpen(true);
  }, [anySubActive, forceOpen]);

  if (!expanded) {
    return (
      <NavTooltip label={item.label} show>
        <button
          type="button"
          onClick={onCollapsedClick}
          className={cn(
            'flex w-full items-center justify-center px-0 py-2 text-sm transition-all duration-150',
            anySubActive ? activeClass : idleClass,
          )}
        >
          <span className={cn('flex-shrink-0', !anySubActive && 'text-[var(--dashboard-text-muted)]')}>
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
        className={cn(
          'flex w-full items-center gap-3 px-2.5 py-2 text-sm transition-all duration-150 text-left rounded-lg',
          anySubActive ? activeClass : idleClass,
        )}
      >
        <span className={cn('flex-shrink-0', !anySubActive && 'text-[var(--dashboard-text-muted)]')}>
          {item.icon}
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px]">{item.label}</span>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 flex-shrink-0 text-[var(--dashboard-text-muted)] transition-transform duration-200',
            open && 'rotate-180',
            anySubActive && 'text-amber-500/80',
          )}
        />
      </button>
      <div
        className={cn(
          'grid transition-[grid-template-rows,opacity] duration-200 ease-in-out',
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        )}
      >
        <div className="overflow-hidden">
          <div className="ml-9 mt-0.5 space-y-0 pb-0.5 border-l-2 border-[var(--dashboard-border)] pl-3">
            {subItems.map((sub) => {
              const subActive = sub.href === '/admin/gastos'
                ? (pathname === '/admin/gastos' || (pathname.startsWith('/admin/gastos/') && !pathname.startsWith('/admin/gastos/conceptos')))
                : (pathname === sub.href || pathname.startsWith(sub.href + '/'));
              return (
                <button
                  key={sub.href}
                  type="button"
                  onClick={() => onNav(sub.href)}
                  className={cn(
                    'block w-full py-2 text-left text-[13px] transition-all duration-150',
                    subActive ? activeSubClass : idleSubClass,
                  )}
                >
                  {sub.label}
                </button>
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
  defaultOpen,
  onCollapsedItemClick,
  pinnedItemLabel,
}: {
  section: NavSection;
  pathname: string;
  expanded: boolean;
  onNav: (href: string) => void;
  defaultOpen: boolean;
  onCollapsedItemClick?: (item: NavItemData) => void;
  pinnedItemLabel?: string | null;
}) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    if (defaultOpen) setOpen(true);
  }, [defaultOpen]);

  if (!expanded) {
    return (
      <div className="space-y-0.5 px-2">
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
                    'flex w-full items-center justify-center py-2 text-sm transition-all duration-150 rounded-lg',
                    anySubActive ? activeClass : idleClass,
                  )}
                >
                  <span className={cn('flex-shrink-0', !anySubActive && 'text-[var(--dashboard-text-muted)]')}>
                    {item.icon}
                  </span>
                </button>
              </NavTooltip>
            );
          }
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <NavItem key={item.href} item={item} active={active} expanded={false} onNav={onNav} />
          );
        })}
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex w-full items-center gap-2 px-3 py-1.5 mb-0.5 text-left group',
        )}
      >
        <div className="flex-1 flex items-center gap-2">
          <div className="h-px flex-1 bg-[var(--dashboard-border)]" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--dashboard-text-muted)]">
            {section.title}
          </span>
          <div className="h-px flex-1 bg-[var(--dashboard-border)]" />
        </div>
        <ChevronDown
          className={cn(
            'w-3 h-3 text-[var(--dashboard-text-muted)] transition-transform duration-200',
            open && 'rotate-180',
          )}
        />
      </button>
      <div
        className="overflow-hidden transition-all duration-200 ease-in-out"
        style={{ maxHeight: open ? '600px' : '0px', opacity: open ? 1 : 0 }}
      >
        <div className="space-y-0.5 pb-1.5 px-2">
          {section.items.map((item) => {
            if (item.subItems?.length) {
              return (
                <NavItemWithSubmenu
                  key={item.label}
                  item={item}
                  pathname={pathname}
                  expanded
                  onNav={onNav}
                  forceOpen={pinnedItemLabel === item.label}
                />
              );
            }
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <NavItem key={item.href} item={item} active={active} expanded onNav={onNav} />
            );
          })}
        </div>
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
  const { signOut, user } = useAuth();
  const { theme } = useTheme();

  const isExpanded = expanded ?? true;
  const [pinnedSectionId, setPinnedSectionId] = useState<string | null>(null);
  const [pinnedItemLabel, setPinnedItemLabel] = useState<string | null>(null);

  const handleNav = useCallback(
    (href: string) => {
      if (href !== '#') {
        router.push(href);
        if (!isExpanded) onExpandedChange?.(true);
      }
      onMobileClose?.();
    },
    [router, onMobileClose, isExpanded, onExpandedChange],
  );

  const handleCollapsedSectionItemClick = useCallback(
    (sectionId: string, item: NavItemData) => {
      onExpandedChange?.(true);
      setPinnedSectionId(sectionId);
      setPinnedItemLabel(item.subItems?.length ? item.label : null);
      if (!item.subItems?.length && item.href !== '#') {
        router.push(item.href);
      }
      onMobileClose?.();
    },
    [onExpandedChange, onMobileClose, router],
  );

  useEffect(() => {
    if (!isExpanded) return;
    if (!pinnedSectionId && !pinnedItemLabel) return;
    const t = window.setTimeout(() => {
      setPinnedSectionId(null);
      setPinnedItemLabel(null);
    }, 400);
    return () => window.clearTimeout(t);
  }, [isExpanded, pinnedSectionId, pinnedItemLabel]);

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

  const dockContent = (showClose?: boolean, onClose?: () => void) => (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div
        className={cn(
          'flex items-center gap-3 border-b border-[var(--dashboard-border)]',
          isExpanded ? 'px-3 pb-3 mb-2' : 'px-3 pb-3 mb-2 justify-center',
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
            {showClose && onClose && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-[var(--dashboard-text-muted)] hover:text-[var(--dashboard-text)] hover:bg-black/[0.06] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </>
        )}
      </div>

      {/* Dashboard & Reportes (standalone) */}
      <div className={cn(isExpanded ? 'px-2 space-y-0.5' : 'px-2 space-y-0.5')}>
        <NavItem
          item={standaloneItems[0]}
          active={pathname === '/dashboard'}
          expanded={isExpanded}
          onNav={handleNav}
        />
        <NavItem
          item={standaloneItems[1]}
          active={pathname === '/reportes-balances' || pathname.startsWith('/reportes-balances/')}
          expanded={isExpanded}
          onNav={handleNav}
        />
        <NavItem
          item={standaloneItems[2]}
          active={pathname === '/reportes/constructor' || pathname.startsWith('/reportes/constructor')}
          expanded={isExpanded}
          onNav={handleNav}
        />
      </div>

      {/* Divider */}
      <div className={cn('border-t border-[var(--dashboard-border)]', isExpanded ? 'mx-3 my-2' : 'mx-2 my-2')} />

      {/* Sections */}
      <nav className="sidebar-nav-scroll scroll-y-fade min-h-0 flex-1 overflow-x-hidden overflow-y-auto space-y-0.5">
        {navigation.map((section) => (
          <Section
            key={section.id}
            section={section}
            pathname={pathname}
            expanded={isExpanded}
            onNav={handleNav}
            defaultOpen={defaultOpenIds.includes(section.id) || pinnedSectionId === section.id}
            onCollapsedItemClick={(item) => handleCollapsedSectionItemClick(section.id, item)}
            pinnedItemLabel={pinnedItemLabel}
          />
        ))}
      </nav>

      {/* Footer */}
      <div className={cn('mt-auto shrink-0 border-t border-[var(--dashboard-border)]', isExpanded ? 'px-2 pt-3' : 'px-2 pt-3')}>
        {isExpanded ? (
          <div className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 bg-[var(--dashboard-card-muted)] border border-[var(--dashboard-border)]">
            <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
              <span className="text-amber-300 font-bold text-[12px]">{initials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold truncate text-[var(--dashboard-text)]">{user?.email}</p>
              <p className="text-[9px] uppercase tracking-wider text-[var(--dashboard-text-muted)]">Operaciones</p>
            </div>
            <button
              onClick={handleSignOut}
              title="Cerrar sesión"
              className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 pb-1">
            <div className="w-9 h-9 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
              <span className="text-amber-300 font-bold text-[12px]">{initials}</span>
            </div>
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
        className={cn('relative z-30 hidden md:flex', shellClass)}
      >
        {dockContent()}

        {/* Collapse toggle (desktop only) */}
        <div className={cn(
          'flex justify-center py-2',
          isExpanded ? 'justify-end px-3 pt-1 pb-0' : 'justify-center pt-1 pb-2',
        )}>
          <button
            type="button"
            onClick={() => onExpandedChange?.(!isExpanded)}
            aria-label={isExpanded ? 'Plegar menú' : 'Expandir menú'}
            className={cn(
              'rounded-lg transition-all duration-150',
              isExpanded
                ? 'flex items-center gap-1.5 px-2 py-1.5 text-[11px] font-semibold text-zinc-500 hover:text-zinc-300 hover:bg-black/[0.06] dark:hover:bg-white/[0.06]'
                : 'p-2 text-zinc-500 hover:text-zinc-300 hover:bg-black/[0.06] dark:hover:bg-white/[0.06]',
            )}
            title={isExpanded ? 'Plegar menú' : 'Expandir menú'}
          >
            {isExpanded ? (
              <PanelLeftClose className="h-4 w-4 shrink-0" />
            ) : (
              <NavTooltip label="Expandir menú" show>
                <span className="inline-flex">
                  <PanelLeft className="h-4 w-4" />
                </span>
              </NavTooltip>
            )}
            {isExpanded ? <span className="truncate">Plegar menú</span> : null}
          </button>
        </div>
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
        {dockContent(true, onMobileClose)}
      </aside>
    </>
  );
}

export const COLLAPSED_W = 68;
export const EXPANDED_W = 240;
