'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const TABS = [
  { href: '/admin/gastos', label: 'Registros' },
  { href: '/admin/gastos/resumen', label: 'Resumen de Gastos' },
  { href: '/admin/gastos/conceptos', label: 'Catálogo' },
] as const;

export function GastosSubNav() {
  const pathname = usePathname();

  return (
    <nav
      className="gastos-subnav mb-2 flex shrink-0 gap-1 overflow-x-auto custom-scrollbar"
      aria-label="Secciones de gastos"
    >
      {TABS.map((tab) => {
        const active =
          tab.href === '/admin/gastos'
            ? pathname === '/admin/gastos'
            : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'gastos-subnav__tab shrink-0 rounded-lg border px-3 py-1.5 text-[11px] font-bold transition-colors',
              active ? 'gastos-subnav__tab--active' : 'gastos-subnav__tab--idle',
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
