'use client';

import { memo } from 'react';
import { cn } from '@/lib/utils';
import { AppSelect } from '@/components/ui/AppSelect';
import { reportesUi as ui } from '@/components/reportes/reportes-ui';
import type { CrossModuleJoin, ReportModule } from '@/lib/reports/report-types';

const CROSS_TYPES: Array<{ value: CrossModuleJoin['type']; label: string }> = [
  { value: 'molino', label: 'Molino' },
  { value: 'mina', label: 'Mina' },
  { value: 'vertical', label: 'Vertical / material' },
  { value: 'fecha', label: 'Fecha exacta' },
];

const RPC_CROSS_MODULES: ReportModule[] = [
  'produccion',
  'extraccion',
  'quemado',
  'voladuras',
  'gastos',
  'nomina',
];

type Props = {
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  crossJoin: CrossModuleJoin | null;
  onChange: (cross: CrossModuleJoin | null) => void;
  selectedModules: ReportModule[];
};

export const CrossModuleJoinPanel = memo(function CrossModuleJoinPanel({
  enabled,
  onEnabledChange,
  crossJoin,
  onChange,
  selectedModules,
}: Props) {
  const eligible = selectedModules.filter((m) => RPC_CROSS_MODULES.includes(m));
  const include = crossJoin?.include ?? eligible;
  const current: CrossModuleJoin = crossJoin
    ? { ...crossJoin, include: crossJoin.include ?? eligible }
    : { type: 'molino', value: '', include: eligible };

  const toggleModule = (mod: ReportModule) => {
    const include = current.include.includes(mod)
      ? current.include.filter((m) => m !== mod)
      : [...current.include, mod];
    onChange({ ...current, include });
  };

  if (eligible.length < 2) return null;

  return (
    <div className="space-y-1.5 rounded-lg border border-white/5 bg-zinc-900/20 p-2.5">
      <label className="flex items-center gap-2 text-[11px] text-zinc-400">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onEnabledChange(e.target.checked)}
          className="rounded border-white/10"
        />
        Cruce entre módulos (RPC)
      </label>
      {enabled ? (
        <div className="space-y-2">
          <p className="text-[10px] leading-snug text-zinc-500">
            Filtra registros crudos por valor común. Balance y Reconciliación siguen en motor en vivo.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={cn(ui.fieldLabel, 'mb-0.5 block')}>Tipo</label>
              <AppSelect
                value={current.type}
                onChange={(v) => onChange({ ...current, type: v as CrossModuleJoin['type'] })}
                options={CROSS_TYPES.map((t) => ({ value: t.value, label: t.label }))}
              />
            </div>
            <div>
              <label className={cn(ui.fieldLabel, 'mb-0.5 block')}>Valor</label>
              <input
                type="text"
                value={current.value}
                onChange={(e) => onChange({ ...current, value: e.target.value })}
                placeholder={current.type === 'vertical' ? 'Ej: V1' : 'Valor exacto'}
                className={cn(ui.input, 'text-[11px] w-full')}
              />
            </div>
          </div>
          <div>
            <p className="text-[10px] text-zinc-500 mb-1">Incluir módulos</p>
            <div className="flex flex-wrap gap-1">
              {eligible.map((mod) => {
                const active = current.include.includes(mod);
                return (
                  <button
                    key={mod}
                    type="button"
                    onClick={() => toggleModule(mod)}
                    className={cn(
                      'rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors',
                      active
                        ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                        : 'border-white/5 text-zinc-500 hover:border-white/10',
                    )}
                  >
                    {mod}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
});
