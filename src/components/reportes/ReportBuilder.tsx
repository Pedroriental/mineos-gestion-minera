'use client';

import { useState, useCallback, useTransition, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Play, Download, FileText, Loader2, CircleDollarSign, SlidersHorizontal } from 'lucide-react';
import { ModuleSelector } from './ModuleSelector';
import { DynamicFilterPanel } from './DynamicFilterPanel';
import { PresetManager } from './PresetManager';
import { ReportPreview } from './ReportPreview';
import { CrossModuleJoinPanel } from './CrossModuleJoinPanel';
import { executeReportAction } from '@/lib/actions/report-actions';
import { decodeReportPayloadFromSearchParams } from '@/lib/reports/report-deep-link';
import { FACTORY_REPORT_PRESETS } from '@/lib/reports/factory-presets';
import { validateReportPayload } from '@/lib/reports/report-builder-validation';
import {
  downloadConstructorCSV,
  downloadConstructorPDF,
} from '@/lib/reports/constructor-exports';
import {
  MobileFilterSheet,
  MobileFilterTrigger,
  useMobileFilterSheet,
} from '@/components/mobile';
import { reportesUi as ui } from '@/components/reportes/reportes-ui';
import { cn } from '@/lib/utils';
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
  const autoRunFromUrl = deepLinkPayload.autoRun === true;

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
  const autoRunDone = useRef(false);
  const { open: filtersOpen, setOpen: setFiltersOpen, close: closeFilters } = useMobileFilterSheet();

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

  const validation = useMemo(() => validateReportPayload(buildPayload()), [buildPayload]);

  const execute = useCallback(() => {
    const payload = buildPayload();
    const check = validateReportPayload(payload);
    if (!check.ok) return;

    startTransition(async () => {
      const res = await executeReportAction(payload);
      setResult(res);
    });
  }, [buildPayload]);

  useEffect(() => {
    if (!hydratedFromUrl || !autoRunFromUrl || autoRunDone.current) return;
    autoRunDone.current = true;
    execute();
  }, [hydratedFromUrl, autoRunFromUrl, execute]);

  const handleLoadPreset = useCallback((payload: ReportPayload) => {
    applyPayloadToState(payload, setters);
  }, [setters]);

  const handleExportPDF = useCallback(async () => {
    if (!result) return;
    setExporting('pdf');
    try {
      await downloadConstructorPDF(result, buildPayload());
    } finally {
      setExporting(null);
    }
  }, [result, buildPayload]);

  const handleExportCSV = useCallback(async () => {
    if (!result) return;
    setExporting('csv');
    try {
      await downloadConstructorCSV(result, buildPayload());
    } finally {
      setExporting(null);
    }
  }, [result, buildPayload]);

  const liveContext = useMemo(
    () => ({
      dateFrom,
      dateTo,
      groupBy,
      filters,
    }),
    [dateFrom, dateTo, groupBy, filters],
  );

  const sidebarContent = (
    <>
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
        <p className={ui.sectionTitle}>Plantillas rápidas</p>
        <div className="flex flex-col gap-1">
          {FACTORY_REPORT_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => handleLoadPreset(preset.payload)}
              className={ui.presetButton}
            >
              <p className={ui.presetTitle}>{preset.name}</p>
              <p className={ui.presetDesc}>{preset.description}</p>
            </button>
          ))}
        </div>
      </div>

      <PresetManager currentPayload={buildPayload()} onLoad={handleLoadPreset} />

      {!validation.ok ? (
        <div className={ui.validationBanner}>
          {validation.messages.map((msg) => (
            <p key={msg} className={ui.validationText}>
              {msg}
            </p>
          ))}
        </div>
      ) : null}

      <button
        type="button"
        onClick={execute}
        disabled={running || !validation.ok}
        className={ui.btnExecute}
      >
        {running ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Play className="h-4 w-4" />
        )}
        {running ? 'Ejecutando...' : 'Ejecutar Reporte'}
      </button>
    </>
  );

  return (
    <div className="report-builder grid grid-cols-1 lg:grid-cols-4 gap-4">
      <MobileFilterTrigger
        label="Filtros del constructor"
        subtitle={`${dateFrom} — ${dateTo}`}
        showBadge={modules.length > 1 || !validation.ok}
        onOpen={() => setFiltersOpen(true)}
        className="lg:hidden"
      />

      <div className={cn(ui.sidebar, 'hidden lg:block lg:col-span-1')}>
        {sidebarContent}
      </div>

      <div className="lg:col-span-3 space-y-4 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/reportes-balances" className={ui.linkSubtle}>
            <CircleDollarSign className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Ver en hub de reportes
          </Link>
        </div>

        {result ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className={ui.metaText}>
              {result.dateRange?.from} → {result.dateRange?.to}
              {result.groupBy ? ` · Agrupado por ${result.groupBy}` : ''}
            </span>
            <div className={cn(ui.exportActions, 'ml-auto gap-1.5')}>
              <button
                type="button"
                onClick={handleExportCSV}
                disabled={exporting !== null}
                className={ui.btnSecondary}
              >
                {exporting === 'csv' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                CSV
              </button>
              <button
                type="button"
                onClick={handleExportPDF}
                disabled={exporting !== null}
                className={ui.btnSecondary}
              >
                {exporting === 'pdf' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                PDF
              </button>
            </div>
          </div>
        ) : null}

        <div className={cn(ui.previewPanel, 'min-h-[400px]')}>
          <ReportPreview result={result} loading={running} liveContext={liveContext} />
        </div>
      </div>

      <MobileFilterSheet
        open={filtersOpen}
        onClose={closeFilters}
        title="Constructor de reportes"
        icon={<SlidersHorizontal className="h-4 w-4" />}
      >
        <div className="space-y-3">{sidebarContent}</div>
      </MobileFilterSheet>
    </div>
  );
}
