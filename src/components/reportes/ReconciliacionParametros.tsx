'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { saveReconciliationParams } from '@/lib/actions/reconciliation-actions';
import type { DateRange } from '@/lib/reports/report-types';
import type { MacroSummary, ReconciliationParams } from '@/lib/reconciliation/types';
import { formatPrecioOroConFuente } from '@/lib/reconciliation/format-precio-oro';
import { metaForPeriod, periodCalendarDays } from '@/lib/reconciliation/projection';
import type { ReconciliationRawInputs } from '@/lib/reconciliation/types';
import type { NominaDivisionParam } from '@/lib/reconciliation/nomina-divisiones';
import { ReconciliacionNominaDivisiones } from '@/components/reportes/ReconciliacionNominaDivisiones';
import { AppSelect } from '@/components/ui/AppSelect';
import { reportesUi as ui } from '@/components/reportes/reportes-ui';
import { cn } from '@/lib/utils';

type FieldDef = {
  key: keyof ReconciliationParams;
  label: string;
  title?: string;
  step?: string;
  type?: 'number' | 'select';
  options?: { value: string; label: string }[];
};

const SECTIONS: Array<{ title: string; fields: FieldDef[] }> = [
  {
    title: 'Metas',
    fields: [
      { key: 'metaOroGDia', label: 'Oro (g/día)', title: 'Proyección y cumplimiento oro', step: '0.1' },
      { key: 'metaSacosDia', label: 'Sacos (día)', step: '1' },
      { key: 'metaMargenPct', label: 'Margen %', step: '0.1' },
      { key: 'metaRecoveryPct', label: 'Recovery %', step: '0.1' },
      { key: 'metaUtilidadMinUsd', label: 'Utilidad mín. USD', title: '0 = solo exige utilidad positiva', step: '1' },
    ],
  },
  {
    title: 'Tolerancias',
    fields: [
      { key: 'tolSacosMinaPlantaPct', label: 'Sacos mina→planta %', step: '0.1' },
      { key: 'tolOroPlantaQuemadoPct', label: 'Oro planta→quemado %', step: '0.1' },
      { key: 'tolNominaVsSemanasPct', label: 'Nómina %', step: '0.1' },
      { key: 'tolRpcIngresoPct', label: 'Ingreso vs RPC %', step: '0.1' },
    ],
  },
  {
    title: 'Precio y costo',
    fields: [
      {
        key: 'precioOroFuente',
        label: 'Fuente oro',
        title: 'Automático: último precio en Supabase (goldapi.io o respaldo). Manual: valor de abajo.',
        type: 'select',
        options: [
          { value: 'cache', label: 'Automático' },
          { value: 'manual', label: 'Manual' },
        ],
      },
      { key: 'precioOroManualUsd', label: 'Manual USD/g', step: '0.01' },
      { key: 'metaCostoPorGramoUsd', label: 'Costo/g máx.', title: '0 = no validar', step: '0.01' },
    ],
  },
];

export function ReconciliacionParametros({
  params,
  macro,
  dateRange,
  inputs,
  onSaved,
}: {
  params: ReconciliationParams;
  macro: MacroSummary;
  dateRange: DateRange;
  inputs?: ReconciliationRawInputs;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    ...params,
    nominaDivisiones: params.nominaDivisiones ?? [],
  });
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const update = (key: keyof ReconciliationParams, value: string) => {
    setForm((prev) => {
      if (key === 'precioOroFuente') {
        return { ...prev, precioOroFuente: value as 'cache' | 'manual' };
      }
      return { ...prev, [key]: Number(value) };
    });
  };

  const setNominaDivisiones = (nominaDivisiones: NominaDivisionParam[]) => {
    setForm((prev) => ({ ...prev, nominaDivisiones }));
  };

  const nominaReferenciaUsd = Math.max(
    inputs?.nominaSemanasUsd ?? 0,
    inputs?.nominaRegistrosUsd ?? 0,
  );

  const handleSave = () => {
    setMsg(null);
    startTransition(async () => {
      const res = await saveReconciliationParams(form);
      setMsg(res.ok ? res.message ?? 'Guardado' : res.message);
      if (res.ok) onSaved();
    });
  };

  const diasPeriodo = periodCalendarDays(dateRange.from, dateRange.to);
  const metaPreviewG = metaForPeriod(form.metaOroGDia, dateRange.from, dateRange.to);
  const periodoLabel = `${format(parseISO(dateRange.from), 'dd/MM/yyyy')} – ${format(parseISO(dateRange.to), 'dd/MM/yyyy')}`;

  return (
    <div className="space-y-6 pt-1">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-500">
            Parámetros
          </h3>
          <p className="text-[11px] text-zinc-600 max-w-md leading-relaxed">
            Metas y tolerancias para las reglas. Se guardan en biblioteca.
          </p>
        </div>
        <Link
          href="/plataforma/biblioteca-variables"
          className="text-[10px] font-medium text-amber-400/80 hover:text-amber-400 shrink-0"
        >
          Biblioteca
        </Link>
      </div>

      <div className="rounded-lg border border-white/5 bg-zinc-900/25 px-3 py-3 space-y-2.5 sm:max-w-2xl">
        <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-600">
          Contexto del periodo
        </p>
        <ul className="space-y-2 text-[11px] leading-snug">
          <li className="flex flex-col gap-0.5 sm:flex-row sm:gap-2 sm:items-baseline">
            <span className="text-zinc-500 shrink-0 sm:w-28">Rango de fechas</span>
            <span className="text-white/85 tabular-nums">{periodoLabel}</span>
          </li>
          <li className="flex flex-col gap-0.5 sm:flex-row sm:gap-2 sm:items-baseline">
            <span className="text-zinc-500 shrink-0 sm:w-28">Precio oro usado</span>
            <span className="text-white/85 tabular-nums">{formatPrecioOroConFuente(macro)}</span>
          </li>
          <li className="flex flex-col gap-0.5 sm:flex-row sm:gap-2 sm:items-baseline">
            <span className="text-zinc-500 shrink-0 sm:w-28">Meta oro periodo</span>
            <span className="text-white/85 tabular-nums">
              {metaPreviewG.toFixed(1)} g
              <span className="text-zinc-500 font-normal">
                {' '}
                = {form.metaOroGDia} g/día × {diasPeriodo} días
              </span>
            </span>
          </li>
        </ul>
      </div>

      <section className="border-t border-white/5 pt-6">
        <h4 className="mb-3 text-[10px] font-bold uppercase tracking-wider text-zinc-600">
          Reparto de nómina
        </h4>
        <ReconciliacionNominaDivisiones
          divisiones={form.nominaDivisiones ?? []}
          onChange={setNominaDivisiones}
          nominaReferenciaUsd={nominaReferenciaUsd}
        />
      </section>

      {SECTIONS.map((section, i) => (
        <section
          key={section.title}
          className={cn('border-t border-white/5 pt-6')}
        >
          <h4 className="mb-3 text-[10px] font-bold uppercase tracking-wider text-zinc-600">
            {section.title}
          </h4>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:max-w-2xl lg:max-w-3xl">
            {section.fields.map((f) => (
              <label key={f.key} className="block min-w-0" title={f.title}>
                <span className="mb-1 block text-[11px] text-zinc-400">{f.label}</span>
                {f.type === 'select' ? (
                  <AppSelect
                    value={form[f.key] as string}
                    onChange={(v) => update(f.key, v)}
                    options={f.options ?? []}
                  />
                ) : (
                  <input
                    type="number"
                    step={f.step}
                    value={form[f.key] as number}
                    onChange={(e) => update(f.key, e.target.value)}
                    className={cn(ui.input, 'tabular-nums')}
                  />
                )}
              </label>
            ))}
          </div>
        </section>
      ))}

      <div className="flex flex-wrap items-center gap-3 border-t border-white/5 pt-5 sm:max-w-2xl">
        <button
          type="button"
          disabled={isPending}
          onClick={handleSave}
          className="btn-primary text-xs disabled:opacity-50"
        >
          {isPending ? 'Guardando…' : 'Guardar y recalcular'}
        </button>
        {msg && <p className="text-xs text-zinc-500">{msg}</p>}
      </div>
    </div>
  );
}
