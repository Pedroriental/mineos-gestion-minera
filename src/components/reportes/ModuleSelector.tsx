'use client';

import { memo } from 'react';
import { cn } from '@/lib/utils';
import type { ReportModule } from '@/lib/reports/report-types';
import { reportesUi as ui } from '@/components/reportes/reportes-ui';

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
  'produccion', 'extraccion', 'quemado', 'voladuras', 'gastos', 'nomina', 'balance', 'reconciliacion',
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
      <p className={ui.sectionTitle}>Módulos</p>
      <div className="flex flex-wrap gap-1.5">
        {ALL_MODULES.map((m) => {
          const active = selected.includes(m);
          return (
            <button
              key={m}
              type="button"
              onClick={() => toggle(m)}
              className={cn(
                ui.chipBase,
                ui.chipPill,
                active ? ui.chipActive : ui.chipInactive,
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
