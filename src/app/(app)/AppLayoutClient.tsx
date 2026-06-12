'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter, usePathname } from 'next/navigation';
import {
  Loader2, Eye, Search, BellRing, ChevronRight, Sun, Moon,
} from 'lucide-react';
import { useTheme } from '@/lib/theme-context';
import Sidebar from '@/components/Sidebar';
import { RouteTransitionGuard } from '@/components/app/RouteTransitionGuard';
import { useIdleTimeout } from '@/hooks/useIdleTimeout';
import { useIsMobile } from '@/hooks/useIsMobile';
import IdleWarningModal from '@/components/IdleWarningModal';
import { MobileShell, MobileRouteContent, MobileAppHeader } from '@/components/mobile';
import { cn } from '@/lib/utils';
import { Suspense } from 'react';
import GlobalDateRangePicker from '@/components/ui/GlobalDateRangePicker';
import { getAppSectionMeta } from '@/lib/app-section-meta';
import { isNominaWorkspacePath } from '@/lib/mobile-nav';
import type { DashboardAlert } from '@/lib/dashboard-alerts';

const AppSearchModal = dynamic(
  () => import('@/components/app/AppSearchModal').then((m) => m.AppSearchModal),
  { ssr: false },
);

function BellPanel({
  onClose,
  onNavigate,
  alerts,
}: {
  onClose: () => void;
  onNavigate: (href: string) => void;
  alerts: DashboardAlert[];
}) {
  return (
    <div className="app-popover bell-panel w-80 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl shadow-2xl">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-500">
          Centro de Notificaciones
        </span>
        <button
          onClick={onClose}
          className="text-lg leading-none text-zinc-600 hover:text-zinc-400"
        >
          &times;
        </button>
      </div>
      <div className="max-h-[300px] overflow-y-auto p-1.5">
        {alerts.length > 0 ? (
          alerts.map((alert) => (
            <button
              key={alert.id}
              onClick={() => {
                onNavigate(alert.href);
                onClose();
              }}
              className="app-popover-item flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-red-500/20 bg-red-500/10 text-red-400">
                <BellRing className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-zinc-200">{alert.title}</p>
                <p className="truncate text-[11px] text-zinc-500">Atención requerida</p>
              </div>
              <ChevronRight className="ml-auto h-3.5 w-3.5 shrink-0 text-zinc-700" />
            </button>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
            <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800/50 text-zinc-600">
              <BellRing className="h-5 w-5" />
            </span>
            <p className="text-[13px] font-medium text-zinc-400">Todo está en orden</p>
            <p className="text-[11px] text-zinc-600">No tienes notificaciones pendientes</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AppLayoutClient({
  children,
  alerts: initialAlerts = [],
}: {
  children: React.ReactNode;
  alerts?: DashboardAlert[];
}) {
  const { user, loading, isGuest, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router   = useRouter();
  const pathname = usePathname();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen,    setSearchOpen]    = useState(false);
  const [bellOpen,      setBellOpen]      = useState(false);
  const [bellCoords,    setBellCoords]    = useState({ top: 56, right: 56 });
  const [alerts,        setAlerts]        = useState<DashboardAlert[]>(initialAlerts);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('mineos-sidebar-expanded');
      if (saved !== null) setSidebarExpanded(saved === 'true');
    } catch {}
  }, []);

  const handleSidebarExpandedChange = useCallback((v: boolean) => {
    setSidebarExpanded(v);
    try { localStorage.setItem('mineos-sidebar-expanded', String(v)); } catch {}
  }, []);
  const isMobile = useIsMobile();

  const bellBtnRef = useRef<HTMLButtonElement>(null);
  const sectionMeta = getAppSectionMeta(pathname);

  const handleNav = useCallback(
    (href: string) => {
      setSearchOpen(false);
      setBellOpen(false);
      router.push(href);
    },
    [router],
  );

  const openBell = useCallback(() => {
    if (bellBtnRef.current) {
      const r = bellBtnRef.current.getBoundingClientRect();
      setBellCoords({ top: r.bottom + 8, right: window.innerWidth - r.right });
    }
    setBellOpen((v) => !v);
  }, []);

  // Ctrl+K search shortcut
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleIdleTimeout = useCallback(async () => {
    await signOut();
    router.push('/');
  }, [signOut, router]);

  const { showWarning, countdown, stayActive } = useIdleTimeout(
    handleIdleTimeout,
    !!user && !isGuest,
  );

  useEffect(() => {
    if (!loading && !user && !isGuest) router.push('/');
  }, [user, loading, isGuest, router]);

  useEffect(() => {
    setMobileMenuOpen(false);
    setSearchOpen(false);
    setBellOpen(false);
  }, [pathname]);

  if (loading) {
    return (
      <div className="flex h-[100dvh] w-full items-center justify-center bg-[var(--app-chrome-bg)]">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--dashboard-accent)]" />
      </div>
    );
  }

  if (!user && !isGuest) return null;

  if (isMobile) {
    return (
      <>
        <RouteTransitionGuard />
        <Sidebar
          mobileOpen={mobileMenuOpen}
          onMobileClose={() => setMobileMenuOpen(false)}
          onSearchOpen={() => setSearchOpen(true)}
          alertCount={alerts.length}
        />
        <MobileShell
          header={
            <MobileAppHeader
              onMenuPress={() => setMobileMenuOpen(true)}
              onBellPress={openBell}
              bellActive={bellOpen}
              alertCount={alerts.length}
              theme={theme}
              onToggleTheme={toggleTheme}
              headerAction={
                !pathname.startsWith('/admin/gastos') ? (
                  <Suspense fallback={<div className="mobile-shell__header-date mobile-shell__header-date--skeleton" aria-hidden />}>
                    <GlobalDateRangePicker variant="mobile" />
                  </Suspense>
                ) : null
              }
            />
          }
        >
          {isGuest && (
            <div className="mobile-shell__guest-banner flex shrink-0 items-center justify-between gap-2 border-b px-4 py-2 text-[11px]">
              <div className="flex items-center gap-2">
                <Eye className="h-3 w-3 shrink-0 opacity-70" />
                <span className="font-medium">Modo observador</span>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await signOut();
                  router.push('/');
                }}
                className="text-[10px] font-bold uppercase tracking-wider opacity-80"
              >
                Salir
              </button>
            </div>
          )}
          <MobileRouteContent
            sectionMeta={sectionMeta}
            pathname={pathname}
            flush={
              pathname !== '/dashboard' &&
              pathname !== '/operaciones/resumen' &&
              !isNominaWorkspacePath(pathname)
            }
            dense
            hideSectionLead={isNominaWorkspacePath(pathname)}
          >
            {children}
          </MobileRouteContent>
        </MobileShell>

        {bellOpen && (
          <div
            className="bell-panel-backdrop fixed inset-0 z-[8998] bg-black/50 backdrop-blur-[2px]"
            onClick={() => setBellOpen(false)}
            aria-hidden
          />
        )}
        {bellOpen && (
          <div
            id="bell-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Centro de notificaciones"
            className="bell-panel-host fixed inset-x-0 top-[calc(2.75rem+env(safe-area-inset-top)+0.5rem)] z-[9000] flex justify-center px-3"
          >
            <BellPanel onClose={() => setBellOpen(false)} onNavigate={handleNav} alerts={alerts} />
          </div>
        )}

        {searchOpen && (
          <AppSearchModal
            onClose={() => setSearchOpen(false)}
            onNavigate={(href) => {
              setSearchOpen(false);
              router.push(href);
            }}
          />
        )}

        {showWarning && (
          <IdleWarningModal
            countdown={countdown}
            onStayActive={stayActive}
            onSignOut={handleIdleTimeout}
          />
        )}
      </>
    );
  }

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden relative bg-[var(--app-chrome-bg)]">
      <RouteTransitionGuard />
      {/* ── App Shell — fondo exterior (chrome) + panel de contenido ── */}
      <div className="relative z-10 flex h-full w-full gap-2 p-2 sm:gap-3 sm:p-3 md:gap-3 md:p-4" data-app-shell>
        <Sidebar
          expanded={sidebarExpanded}
          onExpandedChange={handleSidebarExpandedChange}
          mobileOpen={mobileMenuOpen}
          onMobileClose={() => setMobileMenuOpen(false)}
          onSearchOpen={() => setSearchOpen(true)}
          alertCount={alerts.length}
        />

        {/* ── Right column: rounded content card ── */}
        <div className="app-main-panel flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-[var(--dashboard-border)] bg-[var(--dashboard-bg)]">

          <div className="app-viewport-canvas relative flex min-h-0 w-full flex-1 flex-col overflow-hidden">
          {/* ── Guest Banner ── */}
          {isGuest && (
            <div className="z-40 flex shrink-0 items-center justify-between gap-3 border-b border-amber-800/20 bg-amber-950/20 px-5 py-1.5">
              <div className="flex items-center gap-2">
                <Eye className="w-3 h-3 text-amber-500/70 shrink-0" />
                <span className="text-amber-400/75 font-medium text-[11px] tracking-wide">
                  Modo Observador — solo lectura
                </span>
              </div>
              <button
                onClick={async () => { await signOut(); router.push('/'); }}
                className="text-[10px] font-bold uppercase tracking-widest text-amber-500/60 hover:text-amber-300 transition-colors"
              >
                Salir
              </button>
            </div>
          )}

          {/* ── Topbar ── */}
          <header
            data-topbar
            className="sticky top-0 z-[100] flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-[var(--dashboard-border)] bg-[var(--dashboard-header-bg)] px-5 py-2 backdrop-blur-[12px]"
          >
            {/* Left: hamburger (mobile) */}
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="shrink-0 rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-white/5 hover:text-white md:hidden"
                aria-label="Abrir menú"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              {sectionMeta ? (
                <div className="app-topbar-context min-w-0">
                  <div className="app-topbar-context__heading">
                    <sectionMeta.Icon
                      className={cn('app-topbar-context__icon', sectionMeta.iconClassName)}
                      aria-hidden
                    />
                    <h1
                      className={cn(
                        'app-topbar-context__title',
                        sectionMeta.titleClassName ?? 'text-[var(--dashboard-text)]',
                      )}
                    >
                      {sectionMeta.title}
                    </h1>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => setSearchOpen(true)}
                className="group hidden w-[27.5rem] max-w-[42vw] cursor-pointer items-center gap-2 rounded-xl border border-[var(--dashboard-border)] bg-[var(--dashboard-card-muted)] px-3 py-2 transition-colors hover:border-[var(--dashboard-accent)]/35 lg:flex"
              >
                <Search className="h-3.5 w-3.5 shrink-0 text-[var(--dashboard-text-muted)] group-hover:text-[var(--dashboard-text)]" />
                <span className="select-none text-[12px] font-medium text-[var(--dashboard-text-muted)] group-hover:text-[var(--dashboard-text)]">
                  Buscar...
                </span>
              </button>

              <Suspense fallback={<div className="global-date-trigger global-date-trigger--skeleton hidden h-8 animate-pulse sm:flex" aria-hidden />}>
                {!pathname.startsWith('/admin/gastos') && <GlobalDateRangePicker />}
              </Suspense>

              <button
                onClick={toggleTheme}
                aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--dashboard-border)] bg-[var(--dashboard-card-muted)] text-[var(--dashboard-text-muted)] transition-all hover:text-[var(--dashboard-text)]"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>

              <button
                ref={bellBtnRef}
                onClick={openBell}
                aria-label={bellOpen ? 'Cerrar notificaciones' : 'Abrir notificaciones'}
                aria-expanded={bellOpen}
                aria-controls="bell-panel"
                className={cn(
                  'relative flex h-8 w-8 items-center justify-center rounded-xl border transition-all',
                  bellOpen
                    ? 'border-[var(--dashboard-accent)]/35 bg-[var(--dashboard-accent-soft)] text-[var(--dashboard-accent)]'
                    : 'border-[var(--dashboard-border)] bg-[var(--dashboard-card-muted)] text-[var(--dashboard-text-muted)] hover:text-[var(--dashboard-text)]',
                )}
              >
                <BellRing className="w-4 h-4" />
                {alerts.length > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-red-500 border-2 border-[var(--dashboard-header-bg)]" />
                )}
              </button>
            </div>
          </header>

          {/* ── Main Content ── */}
          <main className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
            {pathname === '/dashboard' ? (
              children
            ) : (
              <div className="app-page-scroll scroll-y-fade" data-main-content>
                <div className="app-page-inner pb-[calc(72px+env(safe-area-inset-bottom))] md:pb-6">
                  {children}
                </div>
              </div>
            )}
          </main>

          {/* Backdrop de campana: solo cubre el panel principal, no la sidebar */}
          {bellOpen && (
            <div
              className="absolute inset-0 z-[8998]"
              onClick={() => setBellOpen(false)}
              aria-hidden
            />
          )}
          {bellOpen && (
            <div
              id="bell-panel"
              role="dialog"
              aria-modal="true"
              aria-label="Centro de notificaciones"
              style={{ position: 'fixed', top: bellCoords.top, right: bellCoords.right, zIndex: 9000 }}
            >
              <BellPanel onClose={() => setBellOpen(false)} onNavigate={handleNav} alerts={alerts} />
            </div>
          )}
          </div>
        </div>
      </div>

      {/* ── Search Modal ── */}
      {searchOpen && (
        <AppSearchModal
          onClose={() => setSearchOpen(false)}
          onNavigate={(href) => {
            setSearchOpen(false);
            router.push(href);
          }}
        />
      )}

      {/* ── Idle Timeout Modal ── */}
      {showWarning && (
        <IdleWarningModal
          countdown={countdown}
          onStayActive={stayActive}
          onSignOut={handleIdleTimeout}
        />
      )}
    </div>
  );
}

