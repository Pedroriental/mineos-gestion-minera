'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter, usePathname } from 'next/navigation';
import {
  Loader2, Eye, Search, BellRing, LogOut, User, ChevronRight,
  LayoutDashboard, BookOpen, ShieldCheck, Wrench, Zap, Receipt,
  Package, ShoppingCart, Users, Flame, FlaskConical, BarChart2,
  ClipboardList, TestTube2, Calculator, Sun, Moon,
} from 'lucide-react';
import { useTheme } from '@/lib/theme-context';
import Sidebar from '@/components/Sidebar';
import MobileBottomNav from '@/components/MobileBottomNav';
import { useIdleTimeout } from '@/hooks/useIdleTimeout';
import IdleWarningModal from '@/components/IdleWarningModal';
import { cn } from '@/lib/utils';

// ── All navigable routes (for search palette) ────────────────────────────
const ALL_ROUTES = [
  { label: 'Dashboard',          href: '/dashboard',              section: 'Principal',      icon: <LayoutDashboard className="w-4 h-4" /> },
  { label: 'Nómina Molino',      href: '/planta/nomina',          section: 'Administración', icon: <Users className="w-4 h-4" /> },
  { label: 'Nómina Mina',        href: '/mina/nomina',            section: 'Administración', icon: <Users className="w-4 h-4" /> },
  { label: 'Gastos',             href: '/admin/gastos',           section: 'Administración', icon: <Receipt className="w-4 h-4" /> },
  { label: 'Inventario',         href: '/admin/inventario',       section: 'Administración', icon: <Package className="w-4 h-4" /> },
  { label: 'Compras',            href: '/admin/compras',          section: 'Administración', icon: <ShoppingCart className="w-4 h-4" /> },
  { label: 'Voladuras',          href: '/mina/voladuras',         section: 'Mina',           icon: <Zap className="w-4 h-4" /> },
  { label: 'Extracción',         href: '/mina/extraccion',        section: 'Mina',           icon: <Wrench className="w-4 h-4" /> },
  { label: 'Quemado de Planchas',href: '/mina/quemado',           section: 'Mina',           icon: <Flame className="w-4 h-4" /> },
  { label: 'Equipos',            href: '/mina/equipos',           section: 'Mina',           icon: <Wrench className="w-4 h-4" /> },
  { label: 'Seguridad',          href: '/mina/seguridad',         section: 'Mina',           icon: <ShieldCheck className="w-4 h-4" /> },
  { label: 'Producción',         href: '/planta/produccion',      section: 'Molino',         icon: <BarChart2 className="w-4 h-4" /> },
  { label: 'Recepción',          href: '/planta/recepcion',       section: 'Molino',         icon: <Package className="w-4 h-4" /> },
  { label: 'Procesamiento',      href: '/planta/procesamiento',   section: 'Molino',         icon: <FlaskConical className="w-4 h-4" /> },
  { label: 'Arenas',             href: '/planta/arenas',          section: 'Molino',         icon: <FlaskConical className="w-4 h-4" /> },
  { label: 'Resumen Ejecutivo',  href: '/operaciones/resumen',    section: 'Operaciones',     icon: <BookOpen className="w-4 h-4" /> },
  { label: 'Libro de Guardia',   href: '/operaciones/guardia',    section: 'Operaciones',     icon: <ClipboardList className="w-4 h-4" /> },
  { label: 'Control de Leyes',   href: '/operaciones/leyes',      section: 'Operaciones',     icon: <TestTube2 className="w-4 h-4" /> },
  { label: 'Costo por Gramo',    href: '/operaciones/costos',     section: 'Operaciones',     icon: <Calculator className="w-4 h-4" /> },
];

// ── Search palette ────────────────────────────────────────────────────────
function SearchModal({
  onClose,
  onNavigate,
}: {
  onClose: () => void;
  onNavigate: (href: string) => void;
}) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const filtered = query.trim()
    ? ALL_ROUTES.filter(
        (r) =>
          r.label.toLowerCase().includes(query.toLowerCase()) ||
          r.section.toLowerCase().includes(query.toLowerCase()),
      )
    : ALL_ROUTES;

  const grouped = filtered.reduce(
    (acc, r) => {
      (acc[r.section] ??= []).push(r);
      return acc;
    },
    {} as Record<string, typeof ALL_ROUTES>,
  );

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-start justify-center pt-20 px-4 bg-black/60 backdrop-blur-[3px]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-zinc-800">
          <Search className="w-4 h-4 text-zinc-600 flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar módulo o página..."
            className="flex-1 bg-transparent text-[14px] text-white/90 placeholder-zinc-600 outline-none"
          />
          <kbd className="text-[10px] text-zinc-600 border border-zinc-700 rounded px-1.5 py-0.5 font-mono">
            ESC
          </kbd>
        </div>

        <div className="max-h-[360px] overflow-y-auto py-2">
          {Object.keys(grouped).length === 0 ? (
            <p className="text-center text-zinc-600 text-sm py-8">Sin resultados</p>
          ) : (
            Object.entries(grouped).map(([section, routes]) => (
              <div key={section} className="mb-1">
                <p className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-600">
                  {section}
                </p>
                {routes.map((r) => (
                  <button
                    key={r.href}
                    onClick={() => onNavigate(r.href)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors text-left"
                  >
                    <span className="text-zinc-600 flex-shrink-0">{r.icon}</span>
                    <span className="font-medium flex-1">{r.label}</span>
                    <ChevronRight className="w-3 h-3 text-zinc-700" />
                  </button>
                ))}
              </div>
            ))
          )}
        </div>

        <div className="px-4 py-2 border-t border-zinc-800/60 flex items-center gap-4">
          <span className="text-[10px] text-zinc-600">
            {filtered.length} módulo{filtered.length !== 1 ? 's' : ''}
          </span>
          <span className="text-[10px] text-zinc-600 ml-auto">↵ para navegar</span>
        </div>
      </div>
    </div>
  );
}

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
      icon: <LayoutDashboard className="w-4 h-4" />,
      desc: 'Vista general',
    },
  ];

  return (
    <div className="w-72 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden">
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
            className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left hover:bg-zinc-900 transition-colors"
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

// ── User Menu ─────────────────────────────────────────────────────────────
function UserMenu({
  email,
  isGuest,
  onSignOut,
  onClose,
}: {
  email: string;
  isGuest: boolean;
  onSignOut: () => void;
  onClose: () => void;
}) {
  return (
    <div className="w-64 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden">
      <div className="px-4 py-4 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-500/15 border-2 border-amber-500/30 flex items-center justify-center flex-shrink-0">
            <span className="text-amber-300 font-black text-sm">
              {email?.charAt(0).toUpperCase() ?? 'U'}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-zinc-200 truncate">{email}</p>
            <span
              className={cn(
                'inline-flex items-center gap-1 mt-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full',
                isGuest
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
              )}
            >
              {isGuest ? <Eye className="w-2.5 h-2.5" /> : <User className="w-2.5 h-2.5" />}
              {isGuest ? 'Observador' : 'Administrador'}
            </span>
          </div>
        </div>
      </div>
      <div className="p-1.5">
        <button
          onClick={() => {
            onSignOut();
            onClose();
          }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] text-red-400/80 hover:text-red-400 hover:bg-red-500/[0.08] transition-colors font-medium"
        >
          <LogOut className="w-4 h-4" />
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}

// ── Live Date chip ────────────────────────────────────────────────────────
function LiveDate() {
  const [date, setDate] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setDate(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  const str = date
    .toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
    .toUpperCase();
  return (
    <div className="hidden sm:flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5">
      <svg
        className="w-3.5 h-3.5 text-zinc-600 flex-shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
      <span className="text-[11px] font-semibold text-zinc-500 tracking-wide">{str}</span>
    </div>
  );
}

// ── Minimal inline "watermark" ingot background ───────────────────────────
function GoldBackground({ theme }: { theme: 'dark' | 'light' }) {
  if (theme === 'light') {
    return (
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#EDE8DF] via-[#F0EBE1] to-[#E8E2D6]" />
        {/* Subtle ingot watermark — very low opacity */}
        <svg
          className="absolute inset-0 w-full h-full opacity-[0.04]"
          viewBox="0 0 1440 900"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            <linearGradient id="lgTA" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#C8A840" />
              <stop offset="100%" stopColor="#8A6C10" />
            </linearGradient>
          </defs>
          <g transform="translate(870,560) rotate(-6)">
            <polygon points="0,32  380,32  350,0  -30,0" fill="url(#lgTA)" />
            <polygon points="0,32  380,32  380,172  0,172" fill="#B08010" />
          </g>
          <g transform="translate(882,447) rotate(-6)">
            <polygon points="0,30  360,30  332,0  -28,0" fill="url(#lgTA)" />
            <polygon points="0,30  360,30  360,160  0,160" fill="#B08010" />
          </g>
          <g transform="translate(1140,600) rotate(7)">
            <polygon points="0,24  290,24  268,0  -22,0" fill="url(#lgTA)" />
            <polygon points="0,24  290,24  290,130  0,130" fill="#B08010" />
          </g>
        </svg>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
      {/* Pure zinc-950 base — professional & clean */}
      <div className="absolute inset-0 bg-[#09090b]" />

      {/* Gold ingot SVG scene — ultra-low opacity (~3%) watermark */}
      <svg
        className="absolute inset-0 w-full h-full opacity-[0.035]"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient id="igTA" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F5D050" />
            <stop offset="100%" stopColor="#B89020" />
          </linearGradient>
          <filter id="ingotBlur">
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>

        {/* Pile 1 — 3 stacked bars */}
        <g transform="translate(870,560) rotate(-6)" filter="url(#ingotBlur)">
          <polygon points="0,32  380,32  350,0  -30,0"   fill="url(#igTA)" />
          <polygon points="0,32  380,32  380,172  0,172" fill="#C89418" />
          <polygon points="380,32  350,0  350,140  380,172" fill="#9E6C0A" />
        </g>
        <g transform="translate(882,447) rotate(-6)" filter="url(#ingotBlur)">
          <polygon points="0,30  360,30  332,0  -28,0"   fill="url(#igTA)" />
          <polygon points="0,30  360,30  360,160  0,160" fill="#C89418" />
          <polygon points="360,30  332,0  332,130  360,160" fill="#9E6C0A" />
        </g>
        <g transform="translate(894,340) rotate(-6)" filter="url(#ingotBlur)">
          <polygon points="0,28  338,28  312,0  -26,0"   fill="url(#igTA)" />
          <polygon points="0,28  338,28  338,148  0,148" fill="#C89418" />
          <polygon points="338,28  312,0  312,120  338,148" fill="#9E6C0A" />
        </g>

        {/* Pile 2 — far right */}
        <g transform="translate(1140,600) rotate(7)" filter="url(#ingotBlur)">
          <polygon points="0,24  290,24  268,0  -22,0"   fill="url(#igTA)" />
          <polygon points="0,24  290,24  290,130  0,130" fill="#B08010" />
        </g>
        <g transform="translate(1150,497) rotate(7)" filter="url(#ingotBlur)">
          <polygon points="0,22  272,22  252,0  -20,0"   fill="url(#igTA)" />
          <polygon points="0,22  272,22  272,120  0,120" fill="#B08010" />
        </g>

        {/* Bottom-left solo ingot */}
        <g transform="translate(-30,700) rotate(14)" filter="url(#ingotBlur)">
          <polygon points="0,20  230,20  212,0  -18,0"   fill="url(#igTA)" />
          <polygon points="0,20  230,20  230,105  0,105" fill="#B08010" />
        </g>
      </svg>
    </div>
  );
}

// ── App Layout ─────────────────────────────────────────────────────────────
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
  const isDashboard = pathname === '/dashboard';

  const handleNav = useCallback(
    (href: string) => {
      setSearchOpen(false);
      setBellOpen(false);
      setUserMenuOpen(false);
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
  }, [pathname]);

  if (loading) {
    return (
      <div className="h-[100dvh] w-full flex items-center justify-center bg-[#09090b]">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    );
  }

  if (!user && !isGuest) return null;

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden relative">
      <GoldBackground theme={theme} />

      {/* ── App Shell ── */}
      <div className="relative z-10 flex w-full h-full" data-app-shell>

        {/* ── Sidebar ── */}
        <div
          data-sidebar
          className="hidden md:block shrink-0 z-20 transition-[width] duration-250 ease-in-out"
          style={{ width: sidebarExpanded ? 240 : 68 }}
        >
          <Sidebar
            mobileOpen={mobileMenuOpen}
            onMobileClose={() => setMobileMenuOpen(false)}
            expanded={sidebarExpanded}
            onExpandedChange={setSidebarExpanded}
          />
        </div>

        {/* ── Right column: topbar + content ── */}
        <div className="flex-1 flex flex-col min-w-0">

          {/* ── Guest Observer Toast Banner — minimal & non-intrusive ── */}
          {isGuest && (
            <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-1.5 bg-amber-950/20 border-b border-amber-800/25 z-40">
              <div className="flex items-center gap-2">
                <Eye className="w-3 h-3 text-amber-500/70 shrink-0" />
                <span className="text-amber-400/75 font-medium text-[11px] tracking-wide">
                  Modo Observador — solo lectura
                </span>
              </div>
              <button
                onClick={async () => {
                  await signOut();
                  router.push('/');
                }}
                className="text-[10px] font-bold uppercase tracking-widest text-amber-500/60 hover:text-amber-300 transition-colors"
              >
                Salir
              </button>
            </div>
          )}

          {/* ── Topbar ── */}
          <header
            data-topbar
            className="shrink-0 h-14 flex items-center justify-between px-4 md:px-5 gap-3 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800/60"
          >
            {/* Left: hamburger (mobile) + brand */}
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="md:hidden p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
                aria-label="Abrir menú"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              {/* Brand */}
              <div className="flex items-center gap-2.5">
                <div className="hidden md:flex w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M2 18 L7 8 L10 13 L13 8 L18 18 Z" opacity="0.85" />
                    <circle cx="14" cy="5" r="2.5" opacity="0.7" />
                  </svg>
                </div>
                <div className="hidden sm:flex flex-col leading-tight">
                  <span className="text-[13px] font-extrabold text-white/90 tracking-tight">La Fe</span>
                  <span className="text-[9px] text-amber-400/60 font-bold tracking-[0.18em] uppercase">MineOS</span>
                </div>
                <div className="hidden sm:block h-5 w-px bg-zinc-800 mx-1" />
              </div>
            </div>

            {/* Right: search + date + theme + bell + avatar */}
            <div className="flex items-center gap-2">
              {/* Search trigger */}
              <button
                onClick={() => setSearchOpen(true)}
                className="hidden lg:flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl px-3 py-2 w-44 transition-colors cursor-pointer group"
              >
                <Search className="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-400 transition-colors flex-shrink-0" />
                <span className="text-[12px] text-zinc-600 group-hover:text-zinc-400 transition-colors font-medium select-none">
                  Buscar...
                </span>
              </button>

              <LiveDate />

              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                className="w-8 h-8 rounded-xl border border-zinc-800 flex items-center justify-center transition-all bg-zinc-900 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 light-topbar-btn"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>

              {/* Bell */}
              <button
                ref={bellBtnRef}
                onClick={openBell}
                className={cn(
                  'w-8 h-8 rounded-xl border flex items-center justify-center transition-all',
                  bellOpen
                    ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800',
                )}
              >
                <BellRing className="w-4 h-4" />
              </button>


            </div>
          </header>

          {/* ── Main Content ── */}
          {isDashboard ? (
            <main
              className="flex-1 overflow-y-auto overflow-x-hidden w-full pb-[calc(56px+env(safe-area-inset-bottom))] md:pb-0"
            >
              {children}
            </main>
          ) : (
            <main
              className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-5 sm:px-6 md:py-6 lg:px-8 pb-[calc(72px+env(safe-area-inset-bottom))] md:pb-6"
              data-main-content
            >
              <div className="max-w-[1400px] mx-auto w-full">
                {children}
              </div>
            </main>
          )}
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
        <SearchModal
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

