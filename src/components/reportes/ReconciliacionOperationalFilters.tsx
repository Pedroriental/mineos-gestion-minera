'use client';

import { memo } from 'react';
import { cn } from '@/lib/utils';
import { reportesUi as ui } from '@/components/reportes/reportes-ui';

type Props = {
  molinos: string[];
  minas: string[];
  selectedMolinos: string[];
  selectedMinas: string[];
  onToggleMolino: (molino: string) => void;
  onToggleMina: (mina: string) => void;
  onClear: () => void;
};

function FilterChipGroup({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  if (options.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <label className={ui.fieldLabel}>{label}</label>
      <div className="flex flex-wrap gap-1">
        {options.map((opt) => {
          const active = selected.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onToggle(opt)}
              className={cn(ui.chipBase, ui.chipPill, active ? ui.chipActive : ui.chipInactive)}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export const ReconciliacionOperationalFilters = memo(function ReconciliacionOperationalFilters({
  molinos,
  minas,
  selectedMolinos,
  selectedMinas,
  onToggleMolino,
  onToggleMina,
  onClear,
}: Props) {
  const hasFilters = selectedMolinos.length > 0 || selectedMinas.length > 0;

  return (
    <div className="space-y-2 border-t border-[var(--dashboard-border)] pt-2">
      <div className="flex items-center justify-between gap-2">
        <p className={ui.sectionTitle}>Filtros operativos</p>
        {hasFilters ? (
          <button
            type="button"
            onClick={onClear}
            className="text-[10px] font-medium text-zinc-500 hover:text-zinc-300"
          >
            Limpiar
          </button>
        ) : null}
      </div>
      <FilterChipGroup
        label="Molino"
        options={molinos}
        selected={selectedMolinos}
        onToggle={onToggleMolino}
      />
      <FilterChipGroup
        label="Mina"
        options={minas}
        selected={selectedMinas}
        onToggle={onToggleMina}
      />
    </div>
  );
});
