'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Search,
  ChevronRight,
  LayoutGrid,
  BookOpen,
  Wrench,
  Zap,
  Receipt,
  Package,
  Users,
  Flame,
  BarChart2,
  CircleDollarSign,
  Database,
  FileSearch,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import type { UserRole } from '@/lib/types';

const ALL_ROUTES = [
  { label: 'Dashboard', href: '/dashboard', section: 'Principal', icon: LayoutGrid, roles: ['admin_developer', 'admin', 'mining_supervisor', 'mill_supervisor'] as UserRole[] },
  { label: 'Reporte y Balances', href: '/reportes-balances', section: 'Principal', icon: CircleDollarSign, roles: ['admin_developer', 'admin', 'mining_supervisor', 'mill_supervisor'] as UserRole[] },
  { label: 'Constructor de Reportes', href: '/reportes/constructor', section: 'Principal', icon: FileSearch, roles: ['admin_developer', 'admin', 'mining_supervisor', 'mill_supervisor'] as UserRole[] },
  { label: 'Resumen Ejecutivo', href: '/operaciones/resumen', section: 'Administración', icon: BookOpen, roles: ['admin_developer', 'admin'] as UserRole[] },
  { label: 'Base de Trabajadores', href: '/admin/trabajadores', section: 'Administración', icon: Users, roles: ['admin_developer', 'admin'] as UserRole[] },
  { label: 'Nómina Molino', href: '/planta/nomina', section: 'Administración', icon: Users, roles: ['admin_developer', 'admin', 'mill_supervisor'] as UserRole[] },
  { label: 'Nómina Mina', href: '/mina/nomina', section: 'Administración', icon: Users, roles: ['admin_developer', 'admin', 'mining_supervisor'] as UserRole[] },
  { label: 'Gastos', href: '/admin/gastos', section: 'Administración', icon: Receipt, roles: ['admin_developer', 'admin'] as UserRole[] },
  { label: 'Inventario', href: '/admin/inventario', section: 'Administración', icon: Package, roles: ['admin_developer', 'admin'] as UserRole[] },
  { label: 'Biblioteca de Variables', href: '/plataforma/biblioteca-variables', section: 'Administración', icon: Database, roles: ['admin_developer'] as UserRole[] },
  { label: 'Voladuras', href: '/mina/voladuras', section: 'Mina', icon: Zap, roles: ['admin_developer', 'admin', 'mining_supervisor'] as UserRole[] },
  { label: 'Extracción', href: '/mina/extraccion', section: 'Mina', icon: Wrench, roles: ['admin_developer', 'admin', 'mining_supervisor'] as UserRole[] },
  { label: 'Quemado de Planchas', href: '/mina/quemado', section: 'Molino', icon: Flame, roles: ['admin_developer', 'admin', 'mining_supervisor'] as UserRole[] },
  { label: 'Equipos', href: '/mina/equipos', section: 'Mina', icon: Wrench, roles: ['admin_developer', 'admin', 'mining_supervisor'] as UserRole[] },
  { label: 'Producción', href: '/planta/produccion', section: 'Molino', icon: BarChart2, roles: ['admin_developer', 'admin', 'mill_supervisor'] as UserRole[] },
  { label: 'Acarreo', href: '/planta/acarreo', section: 'Molino', icon: Package, roles: ['admin_developer', 'admin', 'mill_supervisor'] as UserRole[] },
] as const;

export function AppSearchModal({
  onClose,
  onNavigate,
}: {
  onClose: () => void;
  onNavigate: (href: string) => void;
}) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { role } = useAuth();

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
          r.roles.includes(role) &&
          (r.label.toLowerCase().includes(query.toLowerCase()) ||
           r.section.toLowerCase().includes(query.toLowerCase())),
      )
    : ALL_ROUTES.filter((r) => r.roles.includes(role));

  const grouped: Record<string, any[]> = {};
  filtered.forEach((r) => {
    (grouped[r.section] ??= []).push(r);
  });

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-start justify-center pt-20 px-4 bg-black/60 backdrop-blur-[3px]"
      onClick={onClose}
    >
      <div
        className="app-popover w-full max-w-lg overflow-hidden rounded-2xl shadow-2xl"
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
                {routes.map((r) => {
                  const Icon = r.icon;
                  return (
                    <button
                      key={r.href}
                      onClick={() => onNavigate(r.href)}
                      className="app-popover-item w-full flex items-center gap-3 px-4 py-2.5 text-[13px] transition-colors text-left"
                    >
                      <span className="text-zinc-600 flex-shrink-0">
                        <Icon className="w-4 h-4" />
                      </span>
                      <span className="font-medium flex-1">{r.label}</span>
                      <ChevronRight className="w-3 h-3 text-zinc-700" />
                    </button>
                  );
                })}
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
