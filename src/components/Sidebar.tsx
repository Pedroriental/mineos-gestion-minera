'use client';

import { useState, useEffect, useCallback, useRef, useId } from 'react';
import { createPortal } from 'react-dom';
import { motion, LayoutGroup, MotionConfig } from 'framer-motion';
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
  ShoppingCart,
  Zap,
  Wrench,
  HardHat,
  FlaskConical,
  Flame,
  Truck,
  BookOpen,
  ChevronDown,
  Database,
  LogOut,
  X,
  PanelLeftClose,
  PanelLeft,
  ShieldCheck,
  Search,
  Sun,
  Moon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { MineosLogo, sidebarIconSurface } from '@/components/brand/MineosLogo';
import { useTheme } from '@/lib/theme-context';

/** TODO: resolver rol real desde perfil de usuario */
const SIDEBAR_USER_ROLE = 'Operaciones';

const INTEGRIDAD_HREF = '/operaciones/integridad';

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
  { label: 'Dashboard', href: '/dashboard', icon: <LayoutGrid className="h-4 w-4" /> },
  { label: 'Reporte y Balances', href: '/reportes-balances', icon: <CircleDollarSign className="h-4 w-4" /> },
  { label: 'Constructor de Reportes', href: '/reportes/constructor', icon: <FileSearch className="h-4 w-4" /> },
];

const navigation: NavSection[] = [
  {
    id: 'admin',
    title: 'Administración',
    items: [
      { label: 'Resumen Ejecutivo', href: '/operaciones/resumen', icon: <BookOpen className="h-4 w-4" /> },
      {
        label: 'Gastos',
        href: '#',
        icon: <Receipt className="h-4 w-4" />,
        subItems: [
          { label: 'Registros de Gastos', href: '/admin/gastos' },
          { label: 'Resumen de Gastos', href: '/admin/gastos/resumen' },
          { label: 'Catálogo', href: '/admin/gastos/conceptos' },
        ],
      },
      { label: 'Inventario', href: '/admin/inventario', icon: <Package className="h-4 w-4" /> },
      { label: 'Compras', href: '/admin/compras', icon: <ShoppingCart className="h-4 w-4" /> },
      { label: 'Integridad Financiera', href: INTEGRIDAD_HREF, icon: <ShieldCheck className="h-4 w-4" /> },
      {
        label: 'Nómina de Personal',
        href: '#',
        icon: <Users className="h-4 w-4" />,
        subItems: [
          { label: 'Base de Trabajadores', href: '/admin/trabajadores' },
          { label: 'Nómina Mina', href: '/mina/nomina' },
          { label: 'Nómina Molinos', href: '/planta/nomina' },
        ],
      },
      {
        label: 'Datos de Plataforma',
        href: '#',
        icon: <Database className="h-4 w-4" />,
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
      { label: 'Voladuras', href: '/mina/voladuras', icon: <Zap className="h-4 w-4" /> },
      { label: 'Extracción', href: '/mina/extraccion', icon: <HardHat className="h-4 w-4" /> },
      { label: 'Equipos', href: '/mina/equipos', icon: <Wrench className="h-4 w-4" /> },
    ],
  },
  {
    id: 'planta',
    title: 'Molino',
    items: [
      { label: 'Producción', href: '/planta/produccion', icon: <FlaskConical className="h-4 w-4" /> },
      { label: 'Acarreo', href: '/planta/acarreo', icon: <Truck className="h-4 w-4" /> },
      { label: 'Arenas', href: '/planta/arenas', icon: <Package className="h-4 w-4" /> },
      { label: 'Quemado', href: '/mina/quemado', icon: <Flame className="h-4 w-4" /> },
    ],
  },
];

function buildNavHref(href: string, searchParams: URLSearchParams) {
  if (href === '#') return href;
  const desde = searchParams.get('desde');
  const hasta = searchParams.get('hasta');
  if (!desde || !hasta) return href;
  const params = new URLSearchParams({ desde, hasta });
  return `${href}?${params.toString()}`;
}

function isNavActive(href: string, pathname: string): boolean {
  if (href === '#') return false;
  if (href === '/dashboard') return pathname === '/dashboard';
  if (href === '/admin/gastos') return pathname === '/admin/gastos';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isSubNavActive(subHref: string, pathname: string): boolean {
  if (subHref === '/admin/gastos') return pathname === '/admin/gastos';
  return pathname === subHref || pathname.startsWith(`${subHref}/`);
}

function itemHasActiveSub(item: NavItemData, pathname: string): boolean {
  return (item.subItems ?? []).some((s) => isSubNavActive(s.href, pathname));
}

function NavTooltip({
  label,
  show,
  children,
}: {
  label: string;
  show: boolean;
  children: React.ReactNode;
}) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const tooltipId = useId();
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
        aria-describedby={visible ? tooltipId : undefined}
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
              id={tooltipId}
              role="tooltip"
              className="sidebar-tooltip"
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

function SidebarFlyout({
  open,
  pos,
  anchorRef,
  flyoutRef,
  title,
  children,
  onClose,
}: {
  open: boolean;
  pos: { left: number; top: number } | null;
  anchorRef: React.RefObject<HTMLElement | null>;
  flyoutRef: React.RefObject<HTMLDivElement | null>;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (anchorRef.current?.contains(target)) return;
      if (flyoutRef.current?.contains(target)) return;
      onClose();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onClick);
    };
  }, [open, onClose, anchorRef, flyoutRef]);

  if (!open || !pos || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={flyoutRef}
      role="menu"
      aria-label={title}
      className="sidebar-flyout"
      style={{ left: pos.left, top: pos.top }}
    >
      <div className="sidebar-flyout__header">{title}</div>
      <div className="p-1">{children}</div>
    </div>,
    document.body,
  );
}

function SidebarAccountMenu({
  expanded,
  email,
  initials,
  onSignOut,
}: {
  expanded: boolean;
  email?: string | null;
  initials: string;
  onSignOut: () => void;
}) {
  const { theme, toggleTheme } = useTheme();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [popoverPos, setPopoverPos] = useState<{
    left: number;
    top: number;
    minWidth: number;
  } | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setPopoverPos(null);
  }, []);

  const toggleOpen = useCallback(() => {
    if (open) {
      close();
      return;
    }
    const el = buttonRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPopoverPos({ left: rect.left, top: rect.top - 8, minWidth: rect.width });
    setOpen(true);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      close();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onClick);
    };
  }, [open, close]);

  return (
    <>
      <NavTooltip label="Cuenta" show={!expanded}>
        <button
          ref={buttonRef}
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={toggleOpen}
          className={cn(
            expanded ? 'sidebar-account-card' : 'relative mx-auto flex items-center justify-center',
          )}
        >
          <div className={cn('sidebar-avatar', expanded ? 'h-8 w-8 text-[12px]' : 'h-9 w-9 text-[12px]')}>
            {initials}
          </div>
          {expanded ? (
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-semibold text-[var(--dashboard-text)]">{email}</p>
              <p className="text-[9px] uppercase tracking-wider text-[var(--dashboard-text-muted)]">
                {SIDEBAR_USER_ROLE}
              </p>
            </div>
          ) : null}
        </button>
      </NavTooltip>

      {open && popoverPos && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={popoverRef}
              role="menu"
              aria-label="Menú de cuenta"
              className="sidebar-account-popover"
              style={{
                left: popoverPos.left,
                top: popoverPos.top,
                minWidth: popoverPos.minWidth,
                transform: 'translateY(-100%)',
              }}
            >
              <div className="sidebar-account-popover__email">{email}</div>
              <div className="p-1">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    toggleTheme();
                    close();
                  }}
                  className="app-popover-item flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-[13px] transition-colors"
                >
                  {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                  {theme === 'dark' ? 'Tema claro' : 'Tema oscuro'}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    close();
                    void onSignOut();
                  }}
                  className="app-popover-item sidebar-logout-item flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-[13px] transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Cerrar sesión
                </button>
              </div>
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
  showIndicator,
  badgeCount,
}: {
  item: NavItemData;
  active: boolean;
  expanded: boolean;
  onNav: (href: string) => void;
  navHref: string;
  showIndicator?: boolean;
  badgeCount?: number;
}) {
  const className = cn(
    'sidebar-item transition-all duration-150',
    expanded ? 'px-2.5 py-2 text-left' : 'justify-center px-0 py-2',
    active ? 'sidebar-item--active' : undefined,
  );

  const badge =
    badgeCount && badgeCount > 0 ? (
      expanded ? (
        <span className="sidebar-badge">{Math.min(badgeCount, 9)}</span>
      ) : (
        <span className="sidebar-badge-dot" aria-label={`${badgeCount} alertas`} />
      )
    ) : null;

  const content = (
    <>
      {showIndicator && active && expanded ? (
        <motion.span
          layoutId="sidebar-active-indicator"
          className="sidebar-item__indicator"
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        />
      ) : null}
      <span className={cn('relative flex-shrink-0', !active && 'text-[var(--dashboard-text-muted)]')}>
        {item.icon}
        {!expanded ? badge : null}
      </span>
      {expanded ? (
        <>
          <span className="min-w-0 flex-1 truncate text-[13px]">{item.label}</span>
          {badge}
        </>
      ) : null}
    </>
  );

  return (
    <NavTooltip label={item.label} show={!expanded}>
      {item.href === '#' ? (
        <button type="button" onClick={() => onNav(item.href)} className={className}>
          {content}
        </button>
      ) : (
        <Link
          href={navHref}
          onClick={() => onNav(item.href)}
          className={className}
          aria-current={active ? 'page' : undefined}
        >
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
  flyoutOpen,
  flyoutPos,
  onFlyoutToggle,
}: {
  item: NavItemData;
  pathname: string;
  expanded: boolean;
  onNav: (href: string) => void;
  getNavHref: (href: string) => string;
  flyoutOpen: boolean;
  flyoutPos: { left: number; top: number } | null;
  onFlyoutToggle: (anchor: HTMLElement | null) => void;
}) {
  const subItems = item.subItems ?? [];
  const anySubActive = itemHasActiveSub(item, pathname);
  const [open, setOpen] = useState(false);
  const displayOpen = open || anySubActive;
  const anchorRef = useRef<HTMLButtonElement>(null);
  const flyoutRef = useRef<HTMLDivElement>(null);

  if (!expanded) {
    return (
      <>
        <NavTooltip label={item.label} show={!flyoutOpen}>
          <button
            ref={anchorRef}
            type="button"
            aria-haspopup="menu"
            aria-expanded={flyoutOpen}
            onClick={() => onFlyoutToggle(anchorRef.current)}
            className={cn(
              'sidebar-item justify-center px-0 py-2 transition-all duration-150',
              anySubActive ? 'sidebar-item--parent-active' : undefined,
            )}
          >
            <span className={cn('flex-shrink-0', !anySubActive && 'text-[var(--dashboard-text-muted)]')}>
              {item.icon}
            </span>
          </button>
        </NavTooltip>
        <SidebarFlyout
          open={flyoutOpen}
          pos={flyoutPos}
          anchorRef={anchorRef}
          flyoutRef={flyoutRef}
          title={item.label}
          onClose={() => {
            if (flyoutOpen) onFlyoutToggle(anchorRef.current);
          }}
        >
          {subItems.map((sub) => {
            const subActive = isSubNavActive(sub.href, pathname);
            return (
              <Link
                key={sub.href}
                href={getNavHref(sub.href)}
                role="menuitem"
                onClick={() => {
                  onNav(sub.href);
                  if (flyoutOpen) onFlyoutToggle(null);
                }}
                className={cn(
                  'app-popover-item block rounded-lg px-3 py-2 text-[13px] transition-colors',
                  subActive ? 'sidebar-sublink--active font-medium' : undefined,
                )}
                aria-current={subActive ? 'page' : undefined}
              >
                {sub.label}
              </Link>
            );
          })}
        </SidebarFlyout>
      </>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={displayOpen}
        className={cn(
          'sidebar-item px-2.5 py-2 text-left transition-all duration-150',
          anySubActive ? 'sidebar-item--parent-active' : undefined,
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
            anySubActive && 'text-[var(--dashboard-accent)]',
          )}
        />
      </button>
      <div
        className={cn(
          'grid transition-[grid-template-rows,opacity] duration-200 ease-in-out',
          displayOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        )}
      >
        <div className="overflow-hidden">
          <div className="sidebar-sublink-guide mt-0.5 space-y-0 pb-0.5">
            {subItems.map((sub) => {
              const subActive = isSubNavActive(sub.href, pathname);
              return (
                <Link
                  key={sub.href}
                  href={getNavHref(sub.href)}
                  onClick={() => onNav(sub.href)}
                  className={cn('sidebar-sublink', subActive && 'sidebar-sublink--active')}
                  aria-current={subActive ? 'page' : undefined}
                >
                  {subActive ? <span className="sidebar-sublink-guide__dot" aria-hidden /> : null}
                  {sub.label}
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
  getNavHref,
  alertCount,
  openFlyoutKey,
  openFlyoutPos,
  onFlyoutToggle,
}: {
  section: NavSection;
  pathname: string;
  expanded: boolean;
  onNav: (href: string) => void;
  getNavHref: (href: string) => string;
  alertCount?: number;
  openFlyoutKey: string | null;
  openFlyoutPos: { left: number; top: number } | null;
  onFlyoutToggle: (key: string, anchor: HTMLElement | null) => void;
}) {
  return (
    <div>
      {expanded ? (
        <div className="sidebar-section-label">{section.title}</div>
      ) : (
        <div className="sidebar-section-divider" aria-hidden />
      )}
      <div className="space-y-0.5 px-2">
        {section.items.map((item) => {
          if (item.subItems?.length) {
            const flyoutKey = `${section.id}:${item.label}`;
            return (
              <NavItemWithSubmenu
                key={item.label}
                item={item}
                pathname={pathname}
                expanded={expanded}
                onNav={onNav}
                getNavHref={getNavHref}
                flyoutOpen={openFlyoutKey === flyoutKey}
                flyoutPos={openFlyoutKey === flyoutKey ? openFlyoutPos : null}
                onFlyoutToggle={(anchor) => onFlyoutToggle(flyoutKey, anchor)}
              />
            );
          }
          const active = isNavActive(item.href, pathname);
          const badge = item.href === INTEGRIDAD_HREF ? alertCount : undefined;
          return (
            <NavItem
              key={item.href}
              item={item}
              active={active}
              expanded={expanded}
              onNav={onNav}
              navHref={getNavHref(item.href)}
              showIndicator
              badgeCount={badge}
            />
          );
        })}
      </div>
    </div>
  );
}

function SidebarSearchButton({
  expanded,
  onSearchOpen,
}: {
  expanded: boolean;
  onSearchOpen?: () => void;
}) {
  if (!onSearchOpen) return null;

  const isMac =
    typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform);
  const shortcut = isMac ? '⌘K' : 'Ctrl+K';

  if (!expanded) {
    return (
      <div className="px-2 pb-1">
        <NavTooltip label={`Buscar (${shortcut})`} show>
          <button
            type="button"
            onClick={onSearchOpen}
            className="sidebar-search-btn mx-auto h-8 w-8 items-center justify-center px-0 py-0"
            aria-label="Buscar"
          >
            <Search className="h-4 w-4" />
          </button>
        </NavTooltip>
      </div>
    );
  }

  return (
    <div className="px-2 pb-1">
      <button
        type="button"
        onClick={onSearchOpen}
        className="sidebar-search-btn px-2.5 py-2 text-[12px]"
      >
        <Search className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate font-medium">Buscar…</span>
        <kbd className="sidebar-kbd">{shortcut}</kbd>
      </button>
    </div>
  );
}

interface SidebarProps {
  expanded?: boolean;
  onExpandedChange?: (v: boolean) => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  onSearchOpen?: () => void;
  alertCount?: number;
}

export default function Sidebar({
  expanded,
  onExpandedChange,
  mobileOpen,
  onMobileClose,
  onSearchOpen,
  alertCount = 0,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signOut, user } = useAuth();
  const { theme } = useTheme();

  const isExpanded = expanded ?? true;
  const [flyout, setFlyout] = useState<{
    key: string;
    pathname: string;
    left: number;
    top: number;
  } | null>(null);
  const openFlyoutKey = flyout?.pathname === pathname ? flyout.key : null;
  const openFlyoutPos =
    flyout?.pathname === pathname ? { left: flyout.left, top: flyout.top } : null;

  const getNavHref = useCallback(
    (href: string) => buildNavHref(href, searchParams),
    [searchParams],
  );

  const handleNav = useCallback(() => {
    setFlyout(null);
    onMobileClose?.();
  }, [onMobileClose]);

  const handleFlyoutToggle = useCallback(
    (key: string, anchor: HTMLElement | null) => {
      setFlyout((current) => {
        if (current?.key === key && current.pathname === pathname) return null;
        if (!anchor) return null;
        const rect = anchor.getBoundingClientRect();
        return { key, pathname, left: rect.right + 8, top: rect.top };
      });
    },
    [pathname],
  );

  const handleSignOut = useCallback(async () => {
    await signOut();
    router.push('/');
  }, [signOut, router]);

  const initials = (user?.email?.charAt(0) ?? 'U').toUpperCase();
  const iconSurface = sidebarIconSurface(theme);

  const shellClass = cn(
    'flex flex-col flex-shrink-0',
    'transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
    isExpanded ? 'w-[240px]' : 'w-[68px]',
    'h-full max-h-full rounded-xl border border-[var(--dashboard-border)] bg-[var(--dashboard-bg)] py-3',
  );

  const dockContent = (showClose?: boolean, onClose?: () => void, showCollapseToggle?: boolean) => (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div
        className={cn(
          'sidebar-header-group mb-2 flex items-center gap-3 border-b border-[var(--dashboard-border)] pb-3',
          isExpanded ? 'px-3' : 'justify-center px-3',
        )}
      >
        <MineosLogo
          variant="icon"
          surface={iconSurface}
          className={cn('shrink-0 object-[center_46%]', isExpanded ? 'h-9 w-9' : 'h-8 w-8')}
          alt=""
        />
        {isExpanded ? (
          <>
            <div className="flex min-w-0 flex-1 flex-col gap-px leading-none">
              <span className="text-[14px] font-extrabold tracking-tight text-[var(--dashboard-text)]">
                La Fe
              </span>
              <span className="sidebar-brand-accent text-[9px] font-bold uppercase tracking-[0.18em]">
                MineOS
              </span>
            </div>
            {showCollapseToggle ? (
              <button
                type="button"
                onClick={() => onExpandedChange?.(!isExpanded)}
                aria-label="Plegar menú"
                title="Plegar menú"
                className="sidebar-header-toggle sidebar-header-toggle--hover"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            ) : null}
            {showClose && onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="sidebar-header-toggle"
                aria-label="Cerrar menú"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </>
        ) : null}
      </div>

      {!isExpanded && showCollapseToggle ? (
        <div className="flex justify-center pb-1">
          <NavTooltip label="Expandir menú" show>
            <button
              type="button"
              onClick={() => onExpandedChange?.(true)}
              aria-label="Expandir menú"
              className="sidebar-header-toggle"
            >
              <PanelLeft className="h-4 w-4" />
            </button>
          </NavTooltip>
        </div>
      ) : null}

      <SidebarSearchButton expanded={isExpanded} onSearchOpen={onSearchOpen} />

      {/* Standalone items */}
      <div className="space-y-0.5 px-2">
        {standaloneItems.map((item) => (
          <NavItem
            key={item.href}
            item={item}
            active={isNavActive(item.href, pathname)}
            expanded={isExpanded}
            onNav={handleNav}
            navHref={getNavHref(item.href)}
            showIndicator
          />
        ))}
      </div>

      <div className={cn('border-t border-[var(--dashboard-border)]', isExpanded ? 'mx-3 my-2' : 'mx-2 my-2')} />

      {/* Sections */}
      <MotionConfig reducedMotion="user">
        <LayoutGroup id="sidebar-nav">
          <nav className="sidebar-nav-scroll scroll-y-fade min-h-0 flex-1 space-y-1 overflow-x-hidden overflow-y-auto">
            {navigation.map((section) => (
              <Section
                key={section.id}
                section={section}
                pathname={pathname}
                expanded={isExpanded}
                onNav={handleNav}
                getNavHref={getNavHref}
                alertCount={alertCount}
                openFlyoutKey={openFlyoutKey}
                openFlyoutPos={openFlyoutPos}
                onFlyoutToggle={handleFlyoutToggle}
              />
            ))}
          </nav>
        </LayoutGroup>
      </MotionConfig>

      {/* Footer */}
      <div className="mt-auto shrink-0 border-t border-[var(--dashboard-border)] px-2 pt-3">
        <SidebarAccountMenu
          expanded={isExpanded}
          email={user?.email}
          initials={initials}
          onSignOut={handleSignOut}
        />
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <aside
        data-sidebar
        data-expanded={isExpanded}
        className={cn('relative z-40 hidden md:flex', shellClass)}
      >
        {dockContent(undefined, undefined, true)}
      </aside>

      {/* Mobile backdrop */}
      {mobileOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/55 backdrop-blur-md md:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      ) : null}

      {/* Mobile drawer */}
      <aside
        data-sidebar
        className={cn(
          'fixed inset-y-3 left-3 z-50 flex w-[min(18.5rem,calc(100vw-1.5rem))] flex-col md:hidden',
          'rounded-2xl border border-[var(--dashboard-border)]',
          'bg-[color-mix(in_srgb,var(--dashboard-bg)_78%,transparent)]',
          'px-3 py-3 shadow-[0_24px_80px_rgba(0,0,0,0.55)]',
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
