'use client';

import { useState, useCallback, useTransition, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Play, Download, FileText, Loader2, CircleDollarSign } from 'lucide-react';
import { ModuleSelector } from './ModuleSelector';
import { DynamicFilterPanel } from './DynamicFilterPanel';
import { PresetManager } from './PresetManager';
import { ReportPreview } from './ReportPreview';
import { CrossModuleJoinPanel } from './CrossModuleJoinPanel';
import { executeReportAction } from '@/lib/actions/report-actions';
import { downloadUnifiedReportPDF } from '@/lib/reports/report-pdf-generator';
import { downloadUnifiedReportCSV } from '@/lib/reports/report-csv-generator';
import { decodeReportPayloadFromSearchParams } from '@/lib/reports/report-deep-link';
import { FACTORY_REPORT_PRESETS } from '@/lib/reports/factory-presets';
import type {
  ReportModule,
  ReportPayload,
  ModuleFilters,
  ExecuteReportResult,
  CrossModuleJoin,
} from '@/lib/reports/report-types';

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function monthAgoStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function applyPayloadToState(
  payload: Partial<ReportPayload>,
  setters: {
    setDateFrom: (v: string) => void;
    setDateTo: (v: string) => void;
    setModules: (v: ReportModule[]) => void;
    setFilters: (v: Partial<Record<ReportModule, ModuleFilters>>) => void;
    setGroupBy: (v: string) => void;
    setCrossJoinEnabled: (v: boolean) => void;
    setCrossJoin: (v: CrossModuleJoin | null) => void;
  },
) {
  if (payload.dateFrom) setters.setDateFrom(payload.dateFrom);
  if (payload.dateTo) setters.setDateTo(payload.dateTo);
  if (payload.modules?.length) setters.setModules(payload.modules);
  if (payload.filters) setters.setFilters(payload.filters);
  if (payload.groupBy) setters.setGroupBy(payload.groupBy);
  if (payload.crossModuleJoin) {
    setters.setCrossJoinEnabled(true);
    setters.setCrossJoin(payload.crossModuleJoin);
  } else {
    setters.setCrossJoinEnabled(false);
    setters.setCrossJoin(null);
  }
}

export function ReportBuilder() {
  const searchParams = useSearchParams();
  const deepLinkPayload = useMemo(
    () => decodeReportPayloadFromSearchParams(searchParams),
    [searchParams],
  );

  const [modules, setModules] = useState<ReportModule[]>(['produccion']);
  const [filters, setFilters] = useState<Partial<Record<ReportModule, ModuleFilters>>>({});
  const [dateFrom, setDateFrom] = useState(monthAgoStr());
  const [dateTo, setDateTo] = useState(todayStr());
  const [groupBy, setGroupBy] = useState('dia');
  const [crossJoinEnabled, setCrossJoinEnabled] = useState(false);
  const [crossJoin, setCrossJoin] = useState<CrossModuleJoin | null>(null);
  const [result, setResult] = useState<ExecuteReportResult | null>(null);
  const [running, startTransition] = useTransition();
  const [exporting, setExporting] = useState<'pdf' | 'csv' | null>(null);
  const [hydratedFromUrl, setHydratedFromUrl] = useState(false);

  const setters = useMemo(
    () => ({
      setDateFrom,
      setDateTo,
      setModules,
      setFilters,
      setGroupBy,
      setCrossJoinEnabled,
      setCrossJoin,
    }),
    [],
  );

  useEffect(() => {
    if (hydratedFromUrl) return;
    const hasDeepLink =
      deepLinkPayload.dateFrom ||
      deepLinkPayload.dateTo ||
      deepLinkPayload.modules?.length ||
      deepLinkPayload.filters ||
      deepLinkPayload.crossModuleJoin;
    if (hasDeepLink) {
      applyPayloadToState(deepLinkPayload, setters);
    }
    setHydratedFromUrl(true);
  }, [deepLinkPayload, hydratedFromUrl, setters]);

  const buildPayload = useCallback((): ReportPayload => ({
    dateFrom,
    dateTo,
    modules,
    filters,
    groupBy,
    crossModuleJoin:
      crossJoinEnabled && crossJoin?.value?.trim() && (crossJoin.include?.length ?? 0) > 0
        ? crossJoin
        : null,
  }), [dateFrom, dateTo, modules, filters, groupBy, crossJoinEnabled, crossJoin]);

  const execute = useCallback(() => {
    const payload = buildPayload();
    startTransition(async () => {
      const res = await executeReportAction(payload);
      setResult(res);
    });
  }, [buildPayload]);

  const handleLoadPreset = useCallback((payload: ReportPayload) => {
    applyPayloadToState(payload, setters);
  }, [setters]);

  const handleExportPDF = useCallback(async () => {
    if (!result) return;
    setExporting('pdf');
    try {
      await downloadUnifiedReportPDF(result, dateFrom, dateTo, groupBy);
    } finally {
      setExporting(null);
    }
  }, [result, dateFrom, dateTo, groupBy]);

  const handleExportCSV = useCallback(async () => {
    if (!result) return;
    setExporting('csv');
    try {
      await downloadUnifiedReportCSV(result, groupBy);
    } finally {
      setExporting(null);
    }
  }, [result, groupBy]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      <div className="lg:col-span-1 space-y-3 rounded-lg border border-white/5 bg-zinc-900/20 p-4">
        <ModuleSelector selected={modules} onChange={setModules} />

        <DynamicFilterPanel
          modules={modules}
          filters={filters}
          onChangeFilters={(mod, updates) =>
            setFilters((prev) => ({ ...prev, [mod]: updates }))
          }
          dateFrom={dateFrom}
          dateTo={dateTo}
          onChangeDateFrom={setDateFrom}
          onChangeDateTo={setDateTo}
          groupBy={groupBy}
          onChangeGroupBy={setGroupBy}
        />

        <CrossModuleJoinPanel
          enabled={crossJoinEnabled}
          onEnabledChange={setCrossJoinEnabled}
          crossJoin={crossJoin}
          onChange={setCrossJoin}
          selectedModules={modules}
        />

        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
            Plantillas rápidas
          </p>
          <div className="flex flex-col gap-1">
            {FACTORY_REPORT_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleLoadPreset(preset.payload)}
                className="rounded-md border border-transparent px-2 py-1.5 text-left transition-colors hover:border-white/5 hover:bg-white/[0.03]"
              >
                <p className="text-[11px] text-zinc-300">{preset.name}</p>
                <p className="text-[9px] text-zinc-500 truncate">{preset.description}</p>
              </button>
            ))}
          </div>
        </div>

        <PresetManager currentPayload={buildPayload()} onLoad={handleLoadPreset} />

        <button
          type="button"
          onClick={execute}
          disabled={running || modules.length === 0}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500/15 border border-amber-500/30 px-3 py-2 text-[12px] font-semibold text-amber-300 hover:bg-amber-500/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {running ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          {running ? 'Ejecutando...' : 'Ejecutar Reporte'}
        </button>
      </div>

      <div className="lg:col-span-3 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/reportes-balances"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] font-medium text-zinc-400 transition-colors hover:border-amber-500/30 hover:text-amber-300"
          >
            <CircleDollarSign className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Ver en hub de reportes
          </Link>
        </div>

        {result ? (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-zinc-500">
              {result.dateRange?.from} → {result.dateRange?.to}
              {result.groupBy ? ` · Agrupado por ${result.groupBy}` : ''}
            </span>
            <div className="ml-auto flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleExportCSV}
                disabled={exporting !== null}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-transparent px-3 py-1.5 text-[11px] font-medium text-zinc-300 hover:bg-white/5 disabled:opacity-40"
              >
                {exporting === 'csv' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                CSV
              </button>
              <button
                type="button"
                onClick={handleExportPDF}
                disabled={exporting !== null}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-transparent px-3 py-1.5 text-[11px] font-medium text-zinc-300 hover:bg-white/5 disabled:opacity-40"
              >
                {exporting === 'pdf' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                PDF
              </button>
            </div>
          </div>
        ) : null}

        <div className="rounded-lg border border-white/5 bg-zinc-900/15 p-4 min-h-[400px]">
          <ReportPreview result={result} loading={running} />
        </div>
      </div>
    </div>
  );
}
