'use client';

import { memo } from 'react';
import { cn } from '@/lib/utils';
import type { ReportModule } from '@/lib/reports/report-types';

const MODULE_LABELS: Record<ReportModule, string> = {
  produccion: 'Producción',
  extraccion: 'Extracción',
  quemado: 'Quemado',
  voladuras: 'Voladuras',
  gastos: 'Gastos',
  nomina: 'Nómina',
  balance: 'Balance',
  reconciliacion: 'Reconciliación',
};

const ALL_MODULES: ReportModule[] = [
  'produccion', 'extraccion', 'quemado', 'voladuras', 'gastos', 'nomina', 'balance',
];

type Props = {
  selected: ReportModule[];
  onChange: (modules: ReportModule[]) => void;
};

export const ModuleSelector = memo(function ModuleSelector({ selected, onChange }: Props) {
  const toggle = (m: ReportModule) => {
    onChange(
      selected.includes(m) ? selected.filter((x) => x !== m) : [...selected, m],
    );
  };

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
        Módulos
      </p>
      <div className="flex flex-wrap gap-1.5">
        {ALL_MODULES.map((m) => {
          const active = selected.includes(m);
          return (
            <button
              key={m}
              type="button"
              onClick={() => toggle(m)}
              className={cn(
                'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all duration-150',
                active
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                  : 'border-white/5 bg-transparent text-zinc-500 hover:border-white/10 hover:text-zinc-400',
              )}
            >
              {MODULE_LABELS[m]}
            </button>
          );
        })}
      </div>
    </div>
  );
});
