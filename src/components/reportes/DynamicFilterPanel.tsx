'use client';

import { memo, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { FILTRABLE_COLUMNS } from '@/lib/reports/filtrable-columns';
import type { ReportModule, ModuleFilters } from '@/lib/reports/report-types';

type Props = {
  modules: ReportModule[];
  filters: Partial<Record<ReportModule, ModuleFilters>>;
  onChangeFilters: (module: ReportModule, updates: ModuleFilters) => void;
  dateFrom: string;
  dateTo: string;
  onChangeDateFrom: (v: string) => void;
  onChangeDateTo: (v: string) => void;
  groupBy: string;
  onChangeGroupBy: (v: string) => void;
};

const MODULE_NAMES: Record<string, string> = {
  produccion: 'Producción', extraccion: 'Extracción', quemado: 'Quemado',
  voladuras: 'Voladuras', gastos: 'Gastos', nomina: 'Nómina', balance: 'Balance',
};

const FIELD_CLASSES =
  'w-full rounded-lg border border-white/5 bg-zinc-900/40 px-2.5 py-1.5 text-[12px] text-white outline-none focus:border-zinc-500/40 focus:ring-1 focus:ring-zinc-500/15';

export const DynamicFilterPanel = memo(function DynamicFilterPanel({
  modules,
  filters,
  onChangeFilters,
  dateFrom,
  dateTo,
  onChangeDateFrom,
  onChangeDateTo,
  groupBy,
  onChangeGroupBy,
}: Props) {
  const cascadingModules = useMemo(() => {
    const result: ReportModule[] = [];
    for (const m of modules) {
      result.push(m);
      if (m === 'gastos') {
        if (modules.includes('nomina') && !result.includes('nomina')) result.push('nomina');
        if (modules.includes('balance') && !result.includes('balance')) result.push('balance');
      }
    }
    return result;
  }, [modules]);

  const getFilterValue = (mod: ReportModule, key: string, asArray = false): string[] | string => {
    const f = filters[mod];
    if (!f) return asArray ? [] : '';
    const val = f[key];
    if (val === undefined || val === null) return asArray ? [] : '';
    if (Array.isArray(val)) return val;
    if (typeof val === 'object' && 'in' in val) return (val as { in: string[] }).in;
    if (typeof val === 'object' && 'regex' in val) return (val as { regex: string }).regex;
    if (typeof val === 'string' || typeof val === 'number') return String(val);
    return asArray ? [] : '';
  };

  const toggleMulti = (mod: ReportModule, key: string, value: string) => {
    const current = getFilterValue(mod, key, true) as string[];
    const next = current.includes(value)
      ? current.filter((x) => x !== value)
      : [...current, value];
    onChangeFilters(mod, { ...filters[mod], [key]: next.length > 0 ? next : undefined } as ModuleFilters);
  };

  const setRange = (mod: ReportModule, key: string, op: 'gte' | 'lte', raw: string) => {
    const n = Number(raw);
    const current = (filters[mod]?.[key] as Record<string, number>) ?? {};
    if (isNaN(n)) {
      delete current[op];
      if (Object.keys(current).length === 0) {
        const next = { ...filters[mod] } as Record<string, unknown>;
        delete next[key];
        onChangeFilters(mod, next as ModuleFilters);
        return;
      }
    }
    onChangeFilters(mod, { ...filters[mod], [key]: { ...current, [op]: isNaN(n) ? undefined : n } } as ModuleFilters);
  };

  const setRegex = (mod: ReportModule, key: string, raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      const next = { ...filters[mod] } as Record<string, unknown>;
      delete next[key];
      onChangeFilters(mod, next as ModuleFilters);
      return;
    }
    onChangeFilters(mod, { ...filters[mod], [key]: { regex: trimmed } } as ModuleFilters);
  };

  const setText = (mod: ReportModule, key: string, raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      const next = { ...filters[mod] } as Record<string, unknown>;
      delete next[key];
      onChangeFilters(mod, next as ModuleFilters);
      return;
    }
    onChangeFilters(mod, { ...filters[mod], [key]: trimmed } as ModuleFilters);
  };

  const combinedGroupByOptions = useMemo(() => {
    const seen = new Set<string>();
    const opts: { key: string; label: string }[] = [];
    for (const m of modules) {
      const cfg = FILTRABLE_COLUMNS[m as keyof typeof FILTRABLE_COLUMNS];
      if (!cfg) continue;
      for (const g of cfg.groupByOptions) {
        if (seen.has(g)) continue;
        seen.add(g);
        opts.push({ key: g, label: g.charAt(0).toUpperCase() + g.slice(1) });
      }
    }
    return opts;
  }, [modules]);

  return (
    <div className="space-y-4">
      {/* Dates */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Fechas</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-zinc-500 block mb-0.5">Desde</label>
            <input type="date" value={dateFrom} onChange={(e) => onChangeDateFrom(e.target.value)} className={FIELD_CLASSES} />
          </div>
          <div>
            <label className="text-[10px] text-zinc-500 block mb-0.5">Hasta</label>
            <input type="date" value={dateTo} onChange={(e) => onChangeDateTo(e.target.value)} className={FIELD_CLASSES} />
          </div>
        </div>
      </div>

      {/* Group by */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Agrupar por</p>
        <select value={groupBy} onChange={(e) => onChangeGroupBy(e.target.value)} className={FIELD_CLASSES}>
          {combinedGroupByOptions.map((g) => (
            <option key={g.key} value={g.key}>{g.label}</option>
          ))}
        </select>
      </div>

      {/* Per-module filters */}
      {cascadingModules.map((mod) => {
        const cfg = FILTRABLE_COLUMNS[mod as keyof typeof FILTRABLE_COLUMNS];
        if (!cfg) return null;

        return (
          <div key={mod} className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
              {MODULE_NAMES[mod] ?? mod}
            </p>
            <div className="space-y-1.5">
              {cfg.columns.map((col) => {
                if (col.type === 'date') return null;

                if (col.type === 'enum' || col.type === 'multi') {
                  const currentVals = getFilterValue(mod, col.key, true) as string[];
                  const options = col.values ?? [];
                  return (
                    <div key={col.key}>
                      <label className="text-[10px] text-zinc-500 block mb-0.5">{col.label}</label>
                      <div className="flex flex-wrap gap-1">
                        {options.map((opt) => {
                          const active = currentVals.includes(opt);
                          return (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => toggleMulti(mod, col.key, opt)}
                              className={cn(
                                'rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors',
                                active
                                  ? 'border-zinc-500/40 bg-zinc-800/70 text-zinc-200'
                                  : 'border-white/5 bg-transparent text-zinc-500 hover:border-white/10 hover:text-zinc-400',
                              )}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                }

                if (col.type === 'range') {
                  const current = (filters[mod]?.[col.key] as Record<string, number>) ?? {};
                  return (
                    <div key={col.key}>
                      <label className="text-[10px] text-zinc-500 block mb-0.5">
                        {col.label} {col.unit ? `(${col.unit})` : ''}
                      </label>
                      <div className="grid grid-cols-2 gap-1">
                        <input
                          type="number" step="any" placeholder="Min"
                          value={current.gte ?? ''}
                          onChange={(e) => setRange(mod, col.key, 'gte', e.target.value)}
                          className={cn(FIELD_CLASSES, 'text-[11px]')}
                        />
                        <input
                          type="number" step="any" placeholder="Max"
                          value={current.lte ?? ''}
                          onChange={(e) => setRange(mod, col.key, 'lte', e.target.value)}
                          className={cn(FIELD_CLASSES, 'text-[11px]')}
                        />
                      </div>
                    </div>
                  );
                }

                if (col.type === 'regex') {
                  return (
                    <div key={col.key}>
                      <label className="text-[10px] text-zinc-500 block mb-0.5">{col.label}</label>
                      <input
                        type="text" placeholder="Ej: ^V[1-3]"
                        value={getFilterValue(mod, col.key) as string}
                        onChange={(e) => setRegex(mod, col.key, e.target.value)}
                        className={cn(FIELD_CLASSES, 'text-[11px]')}
                      />
                    </div>
                  );
                }

                if (col.type === 'text') {
                  return (
                    <div key={col.key}>
                      <label className="text-[10px] text-zinc-500 block mb-0.5">{col.label}</label>
                      <input
                        type="text"
                        value={getFilterValue(mod, col.key) as string}
                        onChange={(e) => setText(mod, col.key, e.target.value)}
                        className={cn(FIELD_CLASSES, 'text-[11px]')}
                      />
                    </div>
                  );
                }

                return null;
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
});
