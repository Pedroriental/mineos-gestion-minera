'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter, usePathname } from 'next/navigation';
import {
  Loader2, Eye, Search, BellRing, ChevronRight,
  LayoutGrid, BookOpen, ClipboardList, Sun, Moon,
} from 'lucide-react';
import { useTheme } from '@/lib/theme-context';
import Sidebar from '@/components/Sidebar';
import { RouteTransitionGuard } from '@/components/app/RouteTransitionGuard';
import MobileBottomNav from '@/components/MobileBottomNav';
import { useIdleTimeout } from '@/hooks/useIdleTimeout';
import IdleWarningModal from '@/components/IdleWarningModal';
import { cn } from '@/lib/utils';
import { Suspense } from 'react';
import GlobalDateRangePicker from '@/components/ui/GlobalDateRangePicker';
import { getAppSectionMeta } from '@/lib/app-section-meta';

const AppSearchModal = dynamic(
  () => import('@/components/app/AppSearchModal').then((m) => m.AppSearchModal),
  { ssr: false },
);

// ── Quick Access Panel ────────────────────────────────────────────────────
function BellPanel({
  onClose,
  onNavigate,
}: {
  onClose: () => void;
  onNavigate: (href: string) => void;
}) {
  const quickLinks = [
    {
      label: 'Resumen Ejecutivo',
      href: '/operaciones/resumen',
      icon: <BookOpen className="w-4 h-4" />,
      desc: 'Ver KPIs del período',
    },
    {
      label: 'Libro de Guardia',
      href: '/operaciones/guardia',
      icon: <ClipboardList className="w-4 h-4" />,
      desc: 'Registros de turno',
    },
    {
      label: 'Dashboard',
      href: '/dashboard',
      icon: <LayoutGrid className="w-4 h-4" />,
      desc: 'Vista general',
    },
  ];

  return (
    <div className="app-popover w-72 overflow-hidden rounded-xl shadow-2xl">
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-500">
          Acceso Rápido
        </span>
        <button
          onClick={onClose}
          className="text-zinc-600 hover:text-zinc-400 text-lg leading-none"
        >
          &times;
        </button>
      </div>
      <div className="p-1.5">
        {quickLinks.map((l) => (
          <button
            key={l.href}
            onClick={() => {
              onNavigate(l.href);
              onClose();
            }}
            className="app-popover-item w-full flex items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors"
          >
            <span className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 flex-shrink-0">
              {l.icon}
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-zinc-300 truncate">{l.label}</p>
              <p className="text-[11px] text-zinc-600 truncate">{l.desc}</p>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-zinc-700 ml-auto flex-shrink-0" />
          </button>
        ))}
      </div>
      <div className="px-4 py-2.5 border-t border-zinc-800/60">
        <p className="text-[10px] text-zinc-600 text-center">Sin notificaciones nuevas</p>
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, isGuest, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router   = useRouter();
  const pathname = usePathname();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [searchOpen,    setSearchOpen]    = useState(false);
  const [bellOpen,      setBellOpen]      = useState(false);
  const [bellCoords,    setBellCoords]    = useState({ top: 56, right: 56 });


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

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden relative bg-[var(--app-chrome-bg)]">
      <RouteTransitionGuard />
      {/* ── App Shell — fondo exterior (chrome) + panel de contenido ── */}
      <div className="relative z-10 flex h-full w-full gap-2 p-2 sm:gap-3 sm:p-3 md:gap-3 md:p-4" data-app-shell>
        <Sidebar
          variant="dashboard"
          mobileOpen={mobileMenuOpen}
          onMobileClose={() => setMobileMenuOpen(false)}
        />

        {/* ── Right column: rounded content card ── */}
        <div className="app-main-panel flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-[var(--dashboard-border)] bg-[var(--dashboard-bg)]">

          <div className="app-viewport-canvas flex min-h-0 w-full flex-1 flex-col overflow-hidden">
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

              <Suspense fallback={<div className="hidden h-8 w-[27.5rem] max-w-[42vw] animate-pulse rounded-lg bg-[var(--dashboard-card-muted)] sm:block" />}>
                <GlobalDateRangePicker />
              </Suspense>

              <button
                onClick={toggleTheme}
                title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--dashboard-border)] bg-[var(--dashboard-card-muted)] text-[var(--dashboard-text-muted)] transition-all hover:text-[var(--dashboard-text)]"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>

              <button
                ref={bellBtnRef}
                onClick={openBell}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-xl border transition-all',
                  bellOpen
                    ? 'border-[var(--dashboard-accent)]/35 bg-[var(--dashboard-accent-soft)] text-[var(--dashboard-accent)]'
                    : 'border-[var(--dashboard-border)] bg-[var(--dashboard-card-muted)] text-[var(--dashboard-text-muted)] hover:text-[var(--dashboard-text)]',
                )}
              >
                <BellRing className="w-4 h-4" />
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
          </div>
        </div>
      </div>

      {/* ── Dropdown overlay backdrop ── */}
      {bellOpen && (
        <div
          className="fixed inset-0 z-[8998]"
          onClick={() => setBellOpen(false)}
        />
      )}
      {bellOpen && (
        <div style={{ position: 'fixed', top: bellCoords.top, right: bellCoords.right, zIndex: 9000 }}>
          <BellPanel onClose={() => setBellOpen(false)} onNavigate={handleNav} />
        </div>
      )}

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

      {/* ── Mobile Bottom Nav ── */}
      <MobileBottomNav onMorePress={() => setMobileMenuOpen(true)} />

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

