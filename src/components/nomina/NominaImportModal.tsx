'use client';

import { toast } from 'sonner';
import { toastError } from '@/lib/app-toast';

import { useMemo, useState, useTransition } from 'react';
import {
  Upload,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Users,
  Sparkles,
  FileText,
  ArrowLeft,
} from 'lucide-react';
import { PageFormModal } from '@/components/ui/PageFormModal';
import {
  NominaImportWizard,
  type NominaImportResult,
} from '@/components/nomina/NominaImportWizard';
import { parseNominaMatrixFromFile } from '@/lib/nomina/import-parser';
import { inferAllProfiles } from '@/lib/nomina/inference';
import { describePayrollWeekCount } from '@/lib/nomina/week-utils';
import type { InferredWorkerProfile, ParsedNominaPeriod } from '@/lib/nomina/types';
import type { EmpleadoParseado } from '@/lib/parse-nomina-file';
import { cn } from '@/lib/utils';

type Stage = 'smart' | 'roster' | 'planilla';

type Props = {
  open: boolean;
  onClose: () => void;
  area: string;
  data: Array<{ cedula: string; salario_base?: number | null }>;
  weekStart: string;
  canEdit: boolean;
  onWeekDetected?: (inicio: string, fin: string) => void;
  onImported?: (result?: NominaImportResult) => void;
};

export function NominaImportModal({
  open,
  onClose,
  area,
  data,
  weekStart,
  canEdit,
  onWeekDetected,
  onImported,
}: Props) {
  const [stage, setStage] = useState<Stage>('smart');
  const [importTab, setImportTab] = useState<'excel' | 'pdf'>('excel');
  const [parsedEmps, setParsedEmps] = useState<EmpleadoParseado[]>([]);
  const [importingState, setImportingState] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{ nuevos: number; actualizados: number } | null>(
    null,
  );
  const [planillaPeriod, setPlanillaPeriod] = useState<ParsedNominaPeriod | null>(null);
  const [planillaProfiles, setPlanillaProfiles] = useState<InferredWorkerProfile[]>([]);
  const [detectHint, setDetectHint] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function reset() {
    setParsedEmps([]);
    setImportResult(null);
    setParseError(null);
    setPlanillaPeriod(null);
    setPlanillaProfiles([]);
    setDetectHint(null);
    setStage('smart');
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSmartFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(null);
    setDetectHint(null);
    setImportingState(true);

    try {
      const period = await parseNominaMatrixFromFile(file);
      const { payrollWeeks, hasBonoColumn } = describePayrollWeekCount(period);
      const hasData = period.stats.workerCount > 0 && period.grandTotal > 0;

      if (payrollWeeks >= 1 && hasData) {
        const weekStarts = period.weekColumns.map((c) => c.weekStart);
        const allRows = period.sections.flatMap((s) => s.rows);
        const profiles = inferAllProfiles(allRows, weekStarts, period.weekColumns);
        const firstWeek = weekStarts[0];
        const lastWeek = period.weekColumns[period.weekColumns.length - 1]?.weekEnd ?? firstWeek;

        if (firstWeek) onWeekDetected?.(firstWeek, lastWeek);

        setPlanillaPeriod(period);
        setPlanillaProfiles(profiles);
        setStage('planilla');

        if (payrollWeeks > 1) {
          const bonoNote = hasBonoColumn ? ' · incl. columna bono transporte' : '';
          setDetectHint(
            `Histórico: ${payrollWeeks} semanas laborales (${period.rangeStart} — ${period.rangeEnd})${bonoNote}`,
          );
        } else if (firstWeek === weekStart) {
          setDetectHint('Semana actual detectada — al importar quedará en archivo y podrá verse en vista previa');
        } else {
          setDetectHint(`Planilla de una semana (${firstWeek}) — periodo histórico`);
        }
        setImportingState(false);
        e.target.value = '';
        return;
      }

      if (payrollWeeks >= 1 && !hasData) {
        setParseError(
          'Se reconoció la estructura pero sin montos ni trabajadores. Revise que el archivo tenga cédulas y valores en las columnas de semana.',
        );
        setImportingState(false);
        e.target.value = '';
        return;
      }
    } catch (err) {
      if (file.name.toLowerCase().endsWith('.pdf')) {
        setParseError(
          err instanceof Error
            ? err.message
            : 'No se pudo leer la planilla PDF. Use el Excel/PDF matricial de nómina (Mina + Molinos).',
        );
        setImportingState(false);
        e.target.value = '';
        return;
      }
    }

    if (file.name.toLowerCase().endsWith('.pdf')) {
      setParseError(
        'No se detectaron semanas ni montos en el PDF. Verifique que sea la planilla matricial con encabezados Del/al y filas de trabajadores (Mina + Molinos).',
      );
      setImportingState(false);
      e.target.value = '';
      return;
    }

    await processRosterFromFile(file);
    e.target.value = '';
  }

  async function processRosterFromFile(file: File) {
    setParseError(null);
    setParsedEmps([]);
    setImportResult(null);
    try {
      let detectedInicio = weekStart;
      if (importTab === 'excel') {
        const { parseExcelNomina, detectWeekRangeFromExcel } = await import('@/lib/parse-nomina-file');
        const XLSX = await import('xlsx');
        const arrayBuffer = await file.arrayBuffer();
        const wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: false });
        const detected = detectWeekRangeFromExcel(wb);
        if (detected.inicio && detected.fin) {
          detectedInicio = detected.inicio;
          onWeekDetected?.(detected.inicio, detected.fin);
        }
        const all = await parseExcelNomina(file, detectedInicio || undefined);
        const emps = all.filter((emp) => emp.area === area);
        if (emps.length === 0) {
          setParseError(`No se detectaron trabajadores de ${area} en este archivo.`);
        } else {
          setParsedEmps(emps);
          setStage('roster');
          setDetectHint(`Roster ${area.toUpperCase()}: ${emps.length} trabajadores`);
        }
      } else {
        const { parsePdfNomina, detectWeekRange } = await import('@/lib/parse-nomina-file');
        const pdfjsLib = await import('pdfjs-dist');
        // Worker local en /public/ para no depender de CDN (funciona offline)
        (pdfjsLib as unknown as { GlobalWorkerOptions: { workerSrc: string } }).GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
        const ab = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
        let textForDetection = '';
        for (let pg = 1; pg <= Math.min(2, pdf.numPages); pg++) {
          const page = await pdf.getPage(pg);
          const content = await page.getTextContent();
          textForDetection +=
            content.items.map((it) => ('str' in it ? it.str : '')).join(' ') + '\n';
        }
        const detected = detectWeekRange(textForDetection);
        if (detected.inicio && detected.fin) {
          detectedInicio = detected.inicio;
          onWeekDetected?.(detected.inicio, detected.fin);
        }
        const all = await parsePdfNomina(file, detectedInicio || undefined);
        const emps = all.filter((emp) => emp.area === area);
        if (emps.length === 0) setParseError(`No se detectaron trabajadores de ${area}.`);
        else {
          setParsedEmps(emps);
          setStage('roster');
          setDetectHint(`Roster ${area.toUpperCase()}: ${emps.length} trabajadores`);
        }
      }
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Error procesando archivo.');
    } finally {
      setImportingState(false);
    }
  }

  async function handleRosterFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportingState(true);
    await processRosterFromFile(file);
    // Resetear el input para que onChange se dispare si se re-selecciona el mismo archivo
    e.target.value = '';
  }

  const importDiffs = useMemo(() => {
    return parsedEmps.map((parsed) => {
      const match = data.find((p) => p.cedula === parsed.cedula);
      let status: 'nuevo' | 'cambio' | 'identico' = 'nuevo';
      let delta = 0;
      if (match) {
        status =
          Number(match.salario_base) === Number(parsed.salario_semanal) ? 'identico' : 'cambio';
        delta = Number(parsed.salario_semanal) - Number(match.salario_base || 0);
      }
      return { parsed, status, delta };
    });
  }, [parsedEmps, data]);

  function handleImportConfirm() {
    const valid = parsedEmps.filter((e) => e._valid);
    if (valid.length === 0) {
      toastError('No hay empleados válidos.');
      return;
    }
    startTransition(async () => {
      const { importarPersonalAction } = await import('@/lib/actions/nomina');
      const res = await importarPersonalAction(valid, area);
      if (res.ok) {
        setImportResult(res.data);
        onImported?.();
      } else {
        toastError(res.message);
      }
    });
  }

  const panelClass =
    stage === 'planilla'
      ? 'sm:max-w-4xl max-h-[min(90dvh,820px)] flex flex-col overflow-hidden p-0 sm:rounded-2xl'
      : 'sm:max-w-lg';

  return (
    <PageFormModal open={open} onClose={handleClose} panelClassName={panelClass}>
      {/* ── Header ── */}
      <div
        className={cn(
          'relative shrink-0',
          stage === 'planilla' && 'border-b border-white/5 px-6 py-5 sm:px-8',
          stage !== 'planilla' && 'px-6 pt-6 pb-4 sm:px-8 sm:pt-8',
        )}
      >
        <button
          type="button"
          onClick={handleClose}
          className="absolute right-5 top-5 flex h-7 w-7 items-center justify-center rounded-full text-white/30 transition hover:bg-white/8 hover:text-white/70 sm:right-6 sm:top-6"
          aria-label="Cerrar"
        >
          ×
        </button>

        <div className="flex items-center gap-3 pr-10">
          {stage !== 'smart' && (
            <button
              type="button"
              onClick={reset}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white/30 transition hover:bg-white/8 hover:text-white/60"
              aria-label="Volver al inicio"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <div>
            <h3 className="page-form-modal-title text-xl font-bold tracking-wide text-white/90">
              Importar nómina
            </h3>
            {stage === 'smart' && (
              <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">
                Sube Excel o PDF — detecta{' '}
                <strong className="text-zinc-400">planilla matricial</strong> o{' '}
                <strong className="text-zinc-400">roster</strong> automáticamente.
              </p>
            )}
            {stage === 'planilla' && detectHint && (
              <p className="mt-1 text-xs leading-relaxed text-emerald-300/90">{detectHint}</p>
            )}
            {stage === 'roster' && detectHint && (
              <p className="mt-1 text-xs leading-relaxed text-amber-300/90">{detectHint}</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div
        className={cn(
          'min-h-0 flex-1',
          stage === 'planilla' ? 'overflow-y-auto px-6 py-6 sm:px-8' : 'px-6 pb-6 sm:px-8 sm:pb-8',
        )}
      >
        {/* ── Stage: SMART ── */}
        {stage === 'smart' && (
          <div className="space-y-3">
            {/* Drop zone principal */}
            <div className="relative overflow-hidden rounded-2xl border border-dashed border-amber-500/30 bg-gradient-to-br from-amber-500/6 via-transparent to-zinc-900/30 transition-all hover:border-amber-400/50 hover:from-amber-500/10">
              <input
                type="file"
                accept=".xlsx,.xls,.pdf"
                onChange={handleSmartFile}
                disabled={importingState || !canEdit}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
              <div className="px-6 py-8">
                {importingState ? (
                  <div className="flex flex-col items-center gap-3 text-center">
                    <Loader2 className="h-9 w-9 animate-spin text-amber-500" />
                    <span className="text-sm font-semibold text-white/60">Analizando archivo…</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/10">
                      <Sparkles className="h-7 w-7 text-amber-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white/80">
                        Arrastre o seleccione planilla / roster
                      </p>
                      <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
                        .xlsx · .xls · .pdf
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Chips informativos en fila */}
              <div className="flex flex-wrap gap-2 border-t border-white/5 bg-black/20 px-6 py-3">
                {[
                  { icon: FileText, label: 'Multi-semana → histórico' },
                  { icon: FileText, label: 'Una semana → semana detectada' },
                  { icon: Users, label: `Lista de personal → roster ${area.toUpperCase()}` },
                ].map(({ icon: Icon, label }) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/6 bg-zinc-800/60 px-2.5 py-1 text-[10px] text-zinc-400"
                  >
                    <Icon className="h-3 w-3 shrink-0" />
                    {label}
                  </span>
                ))}
              </div>
            </div>

            {/* Acción secundaria */}
            <button
              type="button"
              onClick={() => setStage('roster')}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-800 py-2.5 text-[11px] font-semibold text-zinc-500 transition hover:border-zinc-700 hover:text-zinc-300"
            >
              <Users className="h-3.5 w-3.5" />
              Importar solo roster de {area.toUpperCase()}
            </button>
          </div>
        )}

        {/* ── Stage: PLANILLA ── */}
        {stage === 'planilla' && planillaPeriod ? (
          <NominaImportWizard
            embedded
            skipUpload
            initialPeriod={planillaPeriod}
            initialProfiles={planillaProfiles}
            onComplete={(result) => {
              onImported?.(result);
              handleClose();
            }}
          />
        ) : null}

        {/* ── Stage: ROSTER — subir archivo ── */}
        {stage === 'roster' && !parsedEmps.length && (
          <div className="space-y-4">
            {/* Tabs Excel / PDF */}
            <div className="flex w-fit gap-1 rounded-xl border border-zinc-800 bg-zinc-900/60 p-1">
              {(['excel', 'pdf'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setImportTab(tab)}
                  className={cn(
                    'rounded-lg px-5 py-2 text-xs font-bold uppercase tracking-wider transition-all',
                    importTab === tab
                      ? 'border border-amber-500/30 bg-amber-500/15 text-amber-300'
                      : 'border border-transparent text-white/30 hover:text-white/60',
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Drop zone roster */}
            <div className="relative overflow-hidden rounded-2xl border border-dashed border-zinc-700/60 bg-zinc-900/20 transition-all hover:border-amber-500/40 hover:bg-amber-500/4">
              <input
                type="file"
                accept={importTab === 'excel' ? '.xlsx,.xls' : '.pdf'}
                onChange={handleRosterFile}
                disabled={importingState || !canEdit}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
              <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
                {importingState ? (
                  <Loader2 className="h-9 w-9 animate-spin text-amber-500" />
                ) : (
                  <>
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-800/60">
                      <Upload className="h-5 w-5 text-zinc-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white/60">
                        Reporte de personal ({area})
                      </p>
                      <p className="mt-0.5 text-[11px] text-zinc-600">
                        {importTab === 'excel' ? '.xlsx · .xls' : '.pdf'}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Stage: ROSTER — lista de empleados ── */}
        {stage === 'roster' && parsedEmps.length > 0 && (
          <div className="space-y-4">
            {/* Stats rápidos */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-white/5 bg-zinc-900/40 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Trabajadores</p>
                <p className="mt-1 text-xl font-bold tabular-nums text-white/90">{parsedEmps.length}</p>
              </div>
              <div className="rounded-xl border border-amber-500/15 bg-amber-500/5 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Área</p>
                <p className="mt-1 text-xl font-bold tabular-nums text-amber-400">{area.toUpperCase()}</p>
              </div>
            </div>

            {/* Tabla de empleados */}
            <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/50">
              <div className="max-h-52 overflow-y-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-900 text-[10px] uppercase tracking-widest text-white/40">
                    <tr>
                      <th className="px-3 py-2.5">Nombre</th>
                      <th className="px-3 py-2.5 text-zinc-600">Cédula</th>
                      <th className="px-3 py-2.5 text-right">Sueldo</th>
                      <th className="px-3 py-2.5 text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/40 text-white/80">
                    {importDiffs.map((diff, i) => (
                      <tr key={i} className="transition hover:bg-white/2">
                        <td className="px-3 py-2.5 font-semibold">{diff.parsed.nombre_completo}</td>
                        <td className="px-3 py-2.5 font-mono text-[10px] text-white/35">{diff.parsed.cedula}</td>
                        <td className="px-3 py-2.5 text-right font-bold tabular-nums text-amber-400">
                          ${Number(diff.parsed.salario_semanal).toFixed(2)}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {diff.status === 'nuevo' && (
                            <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold uppercase text-emerald-400">
                              Nuevo
                            </span>
                          )}
                          {diff.status === 'cambio' && (
                            <span className="rounded-full border border-yellow-500/25 bg-yellow-500/10 px-2 py-0.5 text-[9px] font-bold uppercase text-yellow-400">
                              {diff.delta > 0 ? '+' : ''}{diff.delta}
                            </span>
                          )}
                          {diff.status === 'identico' && (
                            <span className="rounded-full border border-zinc-700 bg-zinc-800/60 px-2 py-0.5 text-[9px] font-bold uppercase text-zinc-400">
                              OK
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Éxito */}
            {importResult && (
              <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/8 p-4">
                <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-400" />
                <p className="text-xs font-semibold text-emerald-300">Importación exitosa</p>
              </div>
            )}

            {/* Acciones */}
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={reset} className="btn-secondary flex-1 py-2.5 text-xs font-bold">
                Otro archivo
              </button>
              {!importResult && (
                <button
                  type="button"
                  onClick={handleImportConfirm}
                  disabled={isPending}
                  className="btn-primary flex-[2] py-2.5 text-xs font-bold"
                >
                  {isPending ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Importando…
                    </span>
                  ) : (
                    'Confirmar roster'
                  )}
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Error ── */}
        {parseError && (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/8 p-3.5 text-xs text-red-400">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{parseError}</span>
          </div>
        )}
      </div>

      {/* ── Footer (solo planilla) ── */}
      {stage === 'planilla' && planillaPeriod ? (
        <div className="shrink-0 border-t border-white/5 px-6 py-4 sm:px-8">
          <button
            type="button"
            onClick={reset}
            className="btn-secondary w-full justify-center text-xs"
          >
            Otro archivo
          </button>
        </div>
      ) : null}
    </PageFormModal>
  );
}
