'use client';

import { useState, useTransition, useMemo, useEffect, Fragment } from 'react';
import {
  Upload,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Users,
  Calendar,
  Layers,
  LayoutGrid,
  Table2,
} from 'lucide-react';
import { parseNominaMatrixFromFile } from '@/lib/nomina/import-parser';
import { inferAllProfiles } from '@/lib/nomina/inference';
import { importarNominaHistoricaAction, getPersonalMapAction } from '@/lib/actions/nomina-actions';
import type { InferredWorkerProfile, ParsedNominaPeriod, ParsedNominaSection } from '@/lib/nomina/types';
import { NominaImportFidelityPanel, type ImportFidelityReport } from '@/components/nomina/NominaImportFidelityPanel';
import { cn } from '@/lib/utils';

/* ─────────────────────────────────────────────────────────────────────────────
   Componente de tabla de vista previa
   ───────────────────────────────────────────────────────────────────────────── */

function ImportPreviewTable({ period }: { period: ParsedNominaPeriod }) {
  const weeks = period.weekColumns;

  // Agrupar filas por sección
  const sections = period.sections.filter((s) => s.rows.some((r) => r._valid));

  if (sections.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-xs text-zinc-500">
        No se detectaron trabajadores válidos en el archivo.
      </div>
    );
  }

  // Totales por columna (semana) para la fila de totales globales
  const colTotals = weeks.map((w) =>
    sections.flatMap((s) => s.rows.filter((r) => r._valid)).reduce((sum, row) => {
      const cell = row.weeks[w.weekStart];
      return sum + (cell?.amount ?? 0);
    }, 0),
  );

  return (
    <div className="flex flex-col gap-0 overflow-x-auto rounded-xl border border-white/8 bg-zinc-950/60">
      <table className="w-full min-w-max border-collapse text-[11px]">
        <thead>
          <tr className="border-b border-white/8 bg-zinc-900/80">
            <th className="sticky left-0 z-10 min-w-[180px] bg-zinc-900/95 px-3 py-2.5 text-left font-semibold uppercase tracking-wider text-zinc-400">
              Trabajador
            </th>
            <th className="min-w-[70px] bg-zinc-900/95 px-2 py-2.5 text-center font-semibold uppercase tracking-wider text-zinc-500">
              Cédula
            </th>
            {weeks.map((w) => (
              <th
                key={w.weekStart}
                className="min-w-[88px] px-2 py-2.5 text-right font-semibold uppercase tracking-wider text-zinc-400"
              >
                <span className="block text-[9px] text-zinc-600">{w.weekStart}</span>
                <span>{w.header || w.rawHeader || 'Sem'}</span>
              </th>
            ))}
            <th className="min-w-[88px] px-3 py-2.5 text-right font-bold uppercase tracking-wider text-amber-500/80">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {sections.map((section: ParsedNominaSection) => {
            const validRows = section.rows.filter((r) => r._valid);
            if (validRows.length === 0) return null;

            return (
              <Fragment key={section.id}>
                {/* Fila cabecera de sección */}
                <tr className="border-t border-white/5 bg-zinc-900/40">
                  <td
                    colSpan={2 + weeks.length + 1}
                    className="sticky left-0 px-3 py-1.5"
                  >
                    <span className="mr-2 rounded bg-zinc-800 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-zinc-400">
                      {section.area}
                    </span>
                    <span className="text-[10px] font-semibold text-zinc-300">{section.title}</span>
                    <span className="ml-2 text-[10px] text-zinc-600">
                      ({validRows.length} trabajadores · ${section.sectionTotal.toFixed(2)})
                    </span>
                  </td>
                </tr>

                {/* Filas de trabajadores */}
                {validRows.map((row, ri) => {
                  return (
                    <tr
                      key={`${section.id}-${row.cedula}-${ri}`}
                      className={cn(
                        'border-t border-white/4 transition-colors hover:bg-white/2',
                        ri % 2 === 0 ? 'bg-zinc-950/20' : 'bg-transparent',
                      )}
                    >
                      {/* Nombre */}
                      <td className="sticky left-0 z-10 min-w-[180px] bg-inherit px-3 py-2">
                        <span className="block max-w-[170px] truncate font-medium text-zinc-200">
                          {row.nombre_completo}
                        </span>
                        <span className="text-[9px] text-zinc-500">{row.cargo}</span>
                      </td>
                      {/* Cédula */}
                      <td className="px-2 py-2 text-center tabular-nums text-zinc-500">
                        {row.cedula}
                      </td>
                      {/* Semanas */}
                      {weeks.map((w) => {
                        const cell = row.weeks[w.weekStart];
                        const amount = cell?.amount ?? 0;
                        const estado = cell?.estado;
                        const isLibre = estado === 'libre' || w.columnKind === 'libre';
                        const isNoLaborado = estado === 'no_laborado' || amount <= 0;

                        return (
                          <td key={w.weekStart} className="px-2 py-2 text-right tabular-nums">
                            {amount > 0 ? (
                              <span
                                className={cn(
                                  'inline-block rounded px-1.5 py-0.5 font-semibold',
                                  isLibre
                                    ? 'bg-sky-500/10 text-sky-300'
                                    : 'bg-emerald-500/10 text-emerald-300',
                                )}
                              >
                                ${amount.toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-zinc-700">
                                {isNoLaborado ? '—' : '$0.00'}
                              </span>
                            )}
                          </td>
                        );
                      })}
                      {/* Total fila */}
                      <td className="px-3 py-2 text-right tabular-nums font-bold text-amber-400/90">
                        ${row.total.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </Fragment>
            );
          })}

          {/* Fila de totales globales */}
          <tr className="border-t-2 border-amber-500/20 bg-amber-500/5">
            <td
              colSpan={2}
              className="sticky left-0 bg-amber-950/20 px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-amber-400"
            >
              Total general
            </td>
            {colTotals.map((total, i) => (
              <td key={i} className="px-2 py-2.5 text-right tabular-nums text-xs font-bold text-amber-300">
                ${total.toFixed(2)}
              </td>
            ))}
            <td className="px-3 py-2.5 text-right tabular-nums text-sm font-extrabold text-amber-400">
              ${period.grandTotal.toFixed(2)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}


type Step = 'upload' | 'preview' | 'inference' | 'done';

export type NominaImportResult = {
  rangeStart: string;
  rangeEnd: string;
  totalUsd: number;
  semanaCount: number;
};

const STEPS: { id: Step; label: string; icon: typeof Upload; num: number }[] = [
  { id: 'upload',    label: 'Archivo',  icon: Upload,         num: 1 },
  { id: 'preview',   label: 'Matriz',   icon: FileSpreadsheet, num: 2 },
  { id: 'inference', label: 'Rotación', icon: Users,           num: 3 },
  { id: 'done',      label: 'Listo',    icon: CheckCircle2,    num: 4 },
];

export function NominaImportWizard({
  userId,
  initialPeriod = null,
  initialProfiles = [],
  skipUpload = false,
  embedded = false,
  onComplete,
}: {
  userId?: string;
  initialPeriod?: ParsedNominaPeriod | null;
  initialProfiles?: InferredWorkerProfile[];
  skipUpload?: boolean;
  embedded?: boolean;
  onComplete?: (result?: NominaImportResult) => void;
}) {
  const [step, setStep] = useState<Step>(skipUpload && initialPeriod ? 'preview' : 'upload');
  const [period, setPeriod] = useState<ParsedNominaPeriod | null>(initialPeriod);
  const [profiles, setProfiles] = useState<InferredWorkerProfile[]>(initialProfiles);
  const [error, setError] = useState<string | null>(null);
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const [savedFidelity, setSavedFidelity] = useState<ImportFidelityReport | null>(null);
  const [isPending, startTransition] = useTransition();
  const [existingPersonal, setExistingPersonal] = useState<any[]>([]);

  useEffect(() => {
    getPersonalMapAction().then((res) => {
      if (res.ok && res.data) setExistingPersonal(res.data);
    });
  }, []);

  const existingPersonalMap = useMemo(
    () => new Map(existingPersonal.map((p) => [p.cedula, p])),
    [existingPersonal],
  );

  useEffect(() => {
    if (initialPeriod) {
      setPeriod(initialPeriod);
      if (initialProfiles.length) setProfiles(initialProfiles);
      if (skipUpload) setStep('preview');
    }
  }, [initialPeriod, initialProfiles, skipUpload]);

  const lowConfidence = useMemo(() => profiles.filter((p) => p.needsReview), [profiles]);
  const stepIndex = STEPS.findIndex((s) => s.id === step);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setResultMsg(null);
    setSavedFidelity(null);
    try {
      const parsed = await parseNominaMatrixFromFile(file);
      const weekStarts = parsed.weekColumns.map((c) => c.weekStart);
      const allRows = parsed.sections.flatMap((s) => s.rows);
      const inferred = inferAllProfiles(allRows, weekStarts, parsed.weekColumns);
      setPeriod(parsed);
      setProfiles(inferred);
      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al parsear archivo');
    }
    e.target.value = '';
  }

  function confirmImport() {
    if (!period) return;
    startTransition(async () => {
      const res = await importarNominaHistoricaAction({
        period,
        profiles,
        userId,
        label: `Import ${period.rangeStart} — ${period.rangeEnd}`,
      });
      if (res.ok) {
        setResultMsg(res.message);
        const data = res.data as (NominaImportResult & { fidelity?: ImportFidelityReport }) | undefined;
        if (data?.fidelity) setSavedFidelity(data.fidelity);
        setStep('done');
        onComplete?.(
          data?.rangeStart
            ? {
                rangeStart: data.rangeStart,
                rangeEnd: data.rangeEnd,
                totalUsd: data.totalUsd ?? period.grandTotal,
                semanaCount: data.semanaCount ?? period.weekColumns.length,
              }
            : {
                rangeStart: period.rangeStart,
                rangeEnd: period.rangeEnd,
                totalUsd: period.grandTotal,
                semanaCount: period.weekColumns.length,
              },
        );
      } else {
        setError(res.message);
      }
    });
  }

  return (
    <div className={cn('flex flex-col gap-5', embedded && 'gap-4')}>

      {/* ══════════════════════════════════════
          STEPPER — barra de progreso + pasos
          ══════════════════════════════════════ */}
      <div className="relative">
        {/* Línea de fondo */}
        <div className="absolute left-0 right-0 top-[18px] h-px bg-zinc-800" />
        {/* Línea de progreso */}
        <div
          className="absolute left-0 top-[18px] h-px bg-amber-500/50 transition-all duration-500"
          style={{ width: `${(stepIndex / (STEPS.length - 1)) * 100}%` }}
        />
        {/* Pasos */}
        <nav aria-label="Pasos de importación" className="relative flex justify-between">
          {STEPS.map((s, i) => {
            const done = i < stepIndex;
            const active = s.id === step;
            return (
              <div key={s.id} className="flex flex-col items-center gap-2">
                {/* Círculo */}
                <div
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-full border-2 text-xs font-bold transition-all',
                    active && 'border-amber-500 bg-amber-500/20 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.3)]',
                    done && !active && 'border-emerald-500/60 bg-emerald-500/15 text-emerald-400',
                    !active && !done && 'border-zinc-700 bg-zinc-900 text-zinc-600',
                  )}
                >
                  {done && !active ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <span>{s.num}</span>
                  )}
                </div>
                {/* Label */}
                <span
                  className={cn(
                    'text-[10px] font-semibold uppercase tracking-wider',
                    active && 'text-amber-300',
                    done && !active && 'text-emerald-400/80',
                    !active && !done && 'text-zinc-600',
                  )}
                >
                  {s.label}
                </span>
              </div>
            );
          })}
        </nav>
      </div>

      {/* ══════════════════════════════════════
          STEP: UPLOAD
          ══════════════════════════════════════ */}
      {step === 'upload' && (
        <div className="relative overflow-hidden rounded-2xl border border-dashed border-zinc-700 bg-gradient-to-b from-zinc-900/30 to-zinc-950/20 transition-all hover:border-amber-500/40">
          <input
            type="file"
            accept=".xlsx,.xls,.pdf"
            onChange={handleFile}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
          <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/10">
              <Upload className="h-6 w-6 text-amber-500/80" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-200">Planilla Excel o PDF</p>
              <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-zinc-500">
                Detecta automáticamente histórico multi-semana, semana cerrada o roster
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════
          STEPS: PREVIEW + INFERENCE
          ══════════════════════════════════════ */}
      {period && step !== 'upload' && step !== 'done' && (
        <div className="flex flex-col gap-4">

          {/* ── Barra superior: fecha/stats + total ── */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/5 bg-zinc-900/50 px-5 py-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800">
                <Calendar className="h-4 w-4 text-zinc-400" />
              </div>
              <div>
                <p className="text-sm font-semibold tabular-nums text-white/90">
                  {period.rangeStart} — {period.rangeEnd}
                </p>
                <p className="text-[11px] text-zinc-500">
                  {period.stats.workerCount} trabajadores · {period.weekColumns.length} semana
                  {period.weekColumns.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-5 py-2 text-center">
              <p className="text-[9px] font-bold uppercase tracking-wider text-amber-500/50">Total USD</p>
              <p className="text-lg font-bold tabular-nums text-amber-400">
                ${period.grandTotal.toLocaleString('es', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {/* Advertencias del parser */}
          {period.stats.warnings.length > 0 && (
            <div className="flex items-start gap-3 rounded-xl border border-sky-500/25 bg-sky-500/8 px-4 py-3 text-xs leading-relaxed text-sky-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
              <span>{period.stats.warnings.join(' ')}</span>
            </div>
          )}

          {/* ── Cuerpo en 2 columnas ── */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

            {/* Columna izquierda: fidelidad + nota */}
            <div className="flex flex-col gap-3">
              <NominaImportFidelityPanel
                period={period}
                profiles={profiles}
                existingPersonal={existingPersonalMap}
              />
              <div className="flex items-start gap-2.5 rounded-xl border border-zinc-700/40 bg-zinc-800/20 px-4 py-3">
                <Layers className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-500" />
                <p className="text-[11px] leading-relaxed text-zinc-400">
                  Todo el personal y las semanas se guardan en{' '}
                  <strong className="text-zinc-200">Nómina Mina</strong>. La sección de origen
                  (Molinos, vertical, etc.) queda en el detalle de cada trabajador.
                </p>
              </div>
            </div>

            {/* Columna derecha: misma altura que la izquierda vía posición absoluta */}
            <div className="relative">
              {/* Inset-0 → se estira al alto del row (= col izquierda) sin afectarlo */}
              <div className="absolute inset-0 flex flex-col overflow-hidden rounded-xl border border-white/5 bg-zinc-900/30">
                {/* Encabezado */}
                <div className="flex shrink-0 items-center gap-2 border-b border-white/5 px-4 py-2.5">
                  <LayoutGrid className="h-3.5 w-3.5 text-zinc-500" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                    Secciones ({period.sections.length})
                  </span>
                </div>
                {/* Lista con scroll interno */}
                <div className="min-h-0 flex-1 overflow-y-auto">
                  {period.sections.map((s, i) => (
                    <div
                      key={s.id}
                      className={cn(
                        'flex items-center justify-between gap-3 px-4 py-2.5 transition hover:bg-white/2',
                        i > 0 && 'border-t border-white/4',
                      )}
                    >
                      <div className="min-w-0">
                        <span className="mr-1.5 inline-block rounded bg-zinc-800 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-zinc-400">
                          {s.area}
                        </span>
                        <span className="text-xs text-zinc-300">{s.title}</span>
                      </div>
                      <span className="shrink-0 text-xs tabular-nums font-semibold text-zinc-100">
                        ${s.sectionTotal.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Tabla de vista previa completa (trabajadores × semanas) ── */}
          <div className="flex flex-col gap-0 overflow-hidden rounded-xl border border-white/8 bg-zinc-900/30">
            {/* Encabezado de la sección */}
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/5 bg-zinc-900/50 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <Table2 className="h-3.5 w-3.5 text-zinc-400" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  Vista previa — {period.stats.workerCount} trabajadores · {period.weekColumns.length} semanas
                </span>
              </div>
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-400">
                Validar datos antes de confirmar
              </span>
            </div>
            {/* Tabla con scroll horizontal + vertical */}
            <div className="max-h-[320px] overflow-auto">
              <ImportPreviewTable period={period} />
            </div>
          </div>

          {/* ── CTAs ── */}
          {step === 'preview' && (
            <button
              type="button"
              onClick={() => setStep('inference')}
              className="btn-primary w-full justify-center py-3 text-xs"
            >
              Revisar rotación inferida
            </button>
          )}

          {step === 'inference' && (
            <div className="flex flex-col gap-3 border-t border-white/5 pt-4">
              {lowConfidence.length > 0 && (
                <div className="flex gap-3 rounded-xl border border-amber-500/25 bg-amber-500/8 px-4 py-3 text-xs leading-relaxed text-amber-200">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    {lowConfidence.length}{' '}
                    {lowConfidence.length === 1 ? 'trabajador' : 'trabajadores'} con confianza &lt;
                    85% — se importan igual; puede ajustar rotación después en la base.
                  </span>
                </div>
              )}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep('preview')}
                  className="btn-secondary flex-1 justify-center py-3 text-xs"
                >
                  Volver
                </button>
                <button
                  type="button"
                  onClick={confirmImport}
                  disabled={isPending}
                  className="btn-primary flex-[2] justify-center py-3 text-xs"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Importando…
                    </>
                  ) : (
                    'Confirmar e importar'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}


      {/* ══════════════════════════════════════
          STEP: DONE
          ══════════════════════════════════════ */}
      {step === 'done' && resultMsg && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/8 p-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/15">
              <CheckCircle2 className="h-7 w-7 text-emerald-400" />
            </div>
            <p className="text-sm font-semibold text-emerald-200">{resultMsg}</p>
          </div>
          {period && savedFidelity && (
            <NominaImportFidelityPanel
              period={period}
              profiles={profiles}
              savedReport={savedFidelity}
            />
          )}
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/8 p-3.5 text-xs text-red-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
