'use client';

import { useState, useCallback, useTransition } from 'react';
import { Play, Download, FileText, Loader2 } from 'lucide-react';
import { ModuleSelector } from './ModuleSelector';
import { DynamicFilterPanel } from './DynamicFilterPanel';
import { PresetManager } from './PresetManager';
import { ReportPreview } from './ReportPreview';
import { executeReportAction } from '@/lib/actions/report-actions';
import { downloadUnifiedReportPDF } from '@/lib/reports/report-pdf-generator';
import { downloadUnifiedReportCSV } from '@/lib/reports/report-csv-generator';
import type { ReportModule, ReportPayload, ModuleFilters, ExecuteReportResult } from '@/lib/reports/report-types';

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function monthAgoStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function ReportBuilder() {
  const [modules, setModules] = useState<ReportModule[]>(['produccion']);
  const [filters, setFilters] = useState<Partial<Record<ReportModule, ModuleFilters>>>({});
  const [dateFrom, setDateFrom] = useState(monthAgoStr());
  const [dateTo, setDateTo] = useState(todayStr());
  const [groupBy, setGroupBy] = useState('dia');
  const [result, setResult] = useState<ExecuteReportResult | null>(null);
  const [running, startTransition] = useTransition();
  const [exporting, setExporting] = useState<'pdf' | 'csv' | null>(null);

  const buildPayload = useCallback((): ReportPayload => ({
    dateFrom,
    dateTo,
    modules,
    filters,
    groupBy,
  }), [dateFrom, dateTo, modules, filters, groupBy]);

  const execute = useCallback(() => {
    const payload = buildPayload();
    startTransition(async () => {
      const res = await executeReportAction(payload);
      setResult(res);
    });
  }, [buildPayload]);

  const handleLoadPreset = useCallback((payload: ReportPayload) => {
    if (payload.dateFrom) setDateFrom(payload.dateFrom);
    if (payload.dateTo) setDateTo(payload.dateTo);
    if (payload.modules?.length) setModules(payload.modules);
    if (payload.filters) setFilters(payload.filters);
    if (payload.groupBy) setGroupBy(payload.groupBy);
  }, []);

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
      {/* Sidebar: Filters */}
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

      {/* Main: Preview */}
      <div className="lg:col-span-3 space-y-4">
        {/* Toolbar */}
        {result && (
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
        )}

        <div className="rounded-lg border border-white/5 bg-zinc-900/15 p-4 min-h-[400px]">
          <ReportPreview result={result} loading={running} />
        </div>
      </div>
    </div>
  );
}
