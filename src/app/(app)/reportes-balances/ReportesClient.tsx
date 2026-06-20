'use client';

import { useMemo, useState, useCallback } from 'react';
import type { FilterOptions, ReportModule, DateRange } from '@/lib/reports/report-types';
import { normalizeFilterOptions } from '@/lib/reports/hub/report-tab-fetch';
import { downloadReportPDF } from '@/lib/reports/report-pdf-generator';
import { downloadReportCSV } from '@/lib/reports/report-csv-generator';
import {
  Loader2,
  Calendar,
  Download,
  FileText,
  FileSpreadsheet,
  TrendingUp,
  Coins,
  Users,
  Flame,
  Zap,
  Receipt,
  Calculator,
  HardHat,
  Beaker,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { format, parseISO, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { AppDateRangeFields } from '@/components/ui/AppDateRangeFields';
import { AppSelect } from '@/components/ui/AppSelect';
import { ReportesTabs } from '@/components/reportes/ReportesTabs';
import { ReconciliacionPanel } from '@/components/reportes/ReconciliacionPanel';
import { BalanceReportPanel } from '@/components/reportes/BalanceReportPanel';
import { reportesUi as ui } from '@/components/reportes/reportes-ui';
import { reportesTableColSpan } from '@/lib/reports/hub/report-tab-fetch';
import { useReportTabData } from '@/hooks/useReportTabData';
import { HubConstructorLink } from '@/components/reportes/HubConstructorLink';
import { buildHubTabConstructorPayload } from '@/lib/reports/hub-constructor-payload';
import { cn } from '@/lib/utils';
import {
  ReportesTableFooter,
} from '@/components/reportes/ReportesTableFooter';
import { ReportesTableRowPadding } from '@/components/reportes/ReportesTableRowPadding';
import { useDataTablePagination } from '@/hooks/useDataTablePagination';
import { MobileFilterTrigger, MobileFilterSheet, useMobileFilterSheet } from '@/components/mobile';
import { useBiblioteca } from '@/contexts/biblioteca-context';
import type { NominaDivisionAmount } from '@/lib/reconciliation/nomina-divisiones';
import { resolveNominaSplitCols } from '@/lib/reports/hub/nomina-split-cols';

interface ReportesClientProps {
  initialOptions: FilterOptions;
}

export default function ReportesClient({ initialOptions: rawOptions }: ReportesClientProps) {
  const initialOptions = useMemo(() => normalizeFilterOptions(rawOptions), [rawOptions]);
  const { nominaDivisiones } = useBiblioteca();
  const [activeTab, setActiveTab] = useState<ReportModule>('reconciliacion');

  // ── 1. Date Range States ──────────────────────────────────
  const [dateRange, setDateRange] = useState<DateRange>({
    from: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    to: format(new Date(), 'yyyy-MM-dd'),
  });

  // ── 2. Filter States per Module ──────────────────────────
  // Producción
  const [selectedMolinos, setSelectedMolinos] = useState<string[]>([]);
  const [selectedMateriales, setSelectedMateriales] = useState<string[]>([]);
  const [selectedTurnosProd, setSelectedTurnosProd] = useState<string[]>([]);
  const [groupByProd, setGroupByProd] = useState<'dia' | 'semana' | 'mes' | 'molino' | 'material'>('dia');

  // Nómina
  const [selectedAreasNom, setSelectedAreasNom] = useState<string[]>([]);
  const [selectedCargosNom, setSelectedCargosNom] = useState<string[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('');
  const [groupByNom, setGroupByNom] = useState<'semana' | 'mes' | 'area' | 'cargo' | 'trabajador'>('semana');

  // Voladuras
  const [selectedMinasVol, setSelectedMinasVol] = useState<string[]>([]);
  const [selectedVerticalesVol, setSelectedVerticalesVol] = useState<string[]>([]);
  const [selectedTurnosVol, setSelectedTurnosVol] = useState<string[]>([]);
  const [groupByVol, setGroupByVol] = useState<'dia' | 'semana' | 'mina'>('dia');

  // Quemado
  const [selectedTurnosQuem, setSelectedTurnosQuem] = useState<string[]>([]);
  const [groupByQuem, setGroupByQuem] = useState<'dia' | 'semana' | 'mes' | 'plancha'>('dia');

  // Extracción
  const [selectedMinasExt, setSelectedMinasExt] = useState<string[]>([]);
  const [selectedVerticalesExt, setSelectedVerticalesExt] = useState<string[]>([]);
  const [selectedTurnosExt, setSelectedTurnosExt] = useState<string[]>([]);
  const [groupByExt, setGroupByExt] = useState<'dia' | 'semana' | 'mina'>('dia');

  // Gastos
  const [selectedCategoriasGst, setSelectedCategoriasGst] = useState<string[]>([]);
  const [selectedTiposGst, setSelectedTiposGst] = useState<string[]>([]);
  const [searchProveedor, setSearchProveedor] = useState<string>('');
  const [groupByGst, setGroupByGst] = useState<'dia' | 'semana' | 'mes' | 'categoria'>('dia');

  const tabFilters = useMemo(
    () => ({
      produccion: {
        molinos: selectedMolinos,
        materiales: selectedMateriales,
        turnos: selectedTurnosProd,
        groupBy: groupByProd,
      },
      nomina: {
        areas: selectedAreasNom,
        cargos: selectedCargosNom,
        personalId: selectedWorkerId,
        groupBy: groupByNom,
        nominaDivisiones: nominaDivisiones ?? [],
      },
      voladuras: {
        minas: selectedMinasVol,
        verticales: selectedVerticalesVol,
        turnos: selectedTurnosVol,
        groupBy: groupByVol,
      },
      quemado: {
        turnos: selectedTurnosQuem,
        groupBy: groupByQuem,
      },
      extraccion: {
        minas: selectedMinasExt,
        verticales: selectedVerticalesExt,
        turnos: selectedTurnosExt,
        groupBy: groupByExt,
      },
      gastos: {
        categorias: selectedCategoriasGst,
        tipos: selectedTiposGst,
        proveedor: searchProveedor,
        groupBy: groupByGst,
      },
    }),
    [
      selectedMolinos,
      selectedMateriales,
      selectedTurnosProd,
      groupByProd,
      selectedAreasNom,
      selectedCargosNom,
      selectedWorkerId,
      groupByNom,
      nominaDivisiones,
      selectedMinasVol,
      selectedVerticalesVol,
      selectedTurnosVol,
      groupByVol,
      selectedTurnosQuem,
      groupByQuem,
      selectedMinasExt,
      selectedVerticalesExt,
      selectedTurnosExt,
      groupByExt,
      selectedCategoriasGst,
      selectedTiposGst,
      searchProveedor,
      groupByGst,
    ],
  );

  const isOperationalTab =
    activeTab !== 'reconciliacion' && activeTab !== 'balance';

  const hubConstructorPayload = useMemo(
    () =>
      buildHubTabConstructorPayload({
        dateRange,
        tab: activeTab,
        tabFilters,
      }),
    [activeTab, dateRange, tabFilters],
  );

  const { aggregated, error, isPending } = useReportTabData({
    activeTab,
    dateRange,
    filters: tabFilters,
    enabled: isOperationalTab,
  });

  const nominaSplitCols = resolveNominaSplitCols(
    activeTab,
    aggregated?.kpis?.divisiones as NominaDivisionAmount[] | undefined,
    nominaDivisiones,
  );
  const showNominaSplit = activeTab === 'nomina' && nominaSplitCols.length > 0;

  const tableRows = aggregated?.rows ?? [];
  const {
    tableAreaRef,
    pageIndex,
    setPageIndex,
    pageCount,
    visibleRows: pageRows,
    emptyRowSlots,
    rangeLabel,
  } = useDataTablePagination(tableRows, [
    activeTab,
    dateRange.from,
    dateRange.to,
    groupByProd,
    groupByNom,
    groupByVol,
    groupByQuem,
    groupByExt,
    groupByGst,
    selectedMolinos,
    selectedMateriales,
    selectedTurnosProd,
    selectedAreasNom,
    selectedCargosNom,
    selectedWorkerId,
    selectedMinasVol,
    selectedVerticalesVol,
    selectedTurnosVol,
    selectedTurnosQuem,
    selectedMinasExt,
    selectedVerticalesExt,
    selectedTurnosExt,
    selectedCategoriasGst,
    selectedTiposGst,
    searchProveedor,
    tableRows.length,
  ]);

  const tableFooterMeta = useMemo(() => {
    if (!aggregated || tableRows.length === 0) return null;

    const rangeWithUnit = `${rangeLabel} agrup.`;
    const kpis = aggregated.kpis as Record<string, unknown>;
    const fmtUsd = (value: unknown) =>
      `$${Number(value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const fmtNum = (value: unknown) => Number(value ?? 0).toLocaleString();

    let tabMeta: { summaryLabel: string; summaryValue: string };
    switch (activeTab) {
      case 'produccion':
        tabMeta = {
          summaryLabel: 'Oro total',
          summaryValue: `${fmtNum(kpis.oroTotalGrams)} g`,
        };
        break;
      case 'nomina':
        tabMeta = {
          summaryLabel: 'Total nómina',
          summaryValue: fmtUsd(kpis.totalPagado),
        };
        break;
      case 'voladuras':
        tabMeta = {
          summaryLabel: 'Disparos',
          summaryValue: String(kpis.disparosCount ?? 0),
        };
        break;
      case 'quemado':
        if (groupByQuem === 'plancha' && kpis.totalPlanchas !== undefined) {
          tabMeta = {
            summaryLabel: 'Planchas analizadas',
            summaryValue: `${fmtNum(kpis.totalPlanchas)} planchas · ${fmtNum(kpis.oroTotalG)} g Oro`,
          };
        } else {
          tabMeta = {
            summaryLabel: 'Oro puro',
            summaryValue: `${fmtNum(kpis.oroTotalG)} g`,
          };
        }
        break;
      case 'extraccion':
        tabMeta = {
          summaryLabel: 'Sacos extraídos',
          summaryValue: fmtNum(kpis.sacosTotal),
        };
        break;
      case 'gastos':
        tabMeta = {
          summaryLabel: 'Total gastado',
          summaryValue: fmtUsd(kpis.totalGastado),
        };
        break;
      default:
        tabMeta = {
          summaryLabel: 'Total visible',
          summaryValue: String(pageRows.length),
        };
    }

    return {
      ...tabMeta,
      countLabel: rangeWithUnit,
    };
  }, [activeTab, aggregated, pageRows.length, rangeLabel, tableRows.length, groupByQuem]);

  // ── 6. Download Handlers ──────────────────────────────────
  const handleDownloadPDF = () => {
    if (!aggregated) return;
    const groupOpt =
      activeTab === 'produccion' ? groupByProd :
      activeTab === 'nomina' ? groupByNom :
      activeTab === 'voladuras' ? groupByVol :
      activeTab === 'quemado' ? groupByQuem :
      activeTab === 'extraccion' ? groupByExt :
      groupByGst;
    downloadReportPDF(activeTab, aggregated, dateRange, groupOpt);
  };

  const handleDownloadCSV = () => {
    if (!aggregated) return;
    const groupOpt =
      activeTab === 'produccion' ? groupByProd :
      activeTab === 'nomina' ? groupByNom :
      activeTab === 'voladuras' ? groupByVol :
      activeTab === 'quemado' ? groupByQuem :
      activeTab === 'extraccion' ? groupByExt :
      groupByGst;
    downloadReportCSV(activeTab, aggregated, groupOpt);
  };

  // ── 7. Toggle Option Helper ────────────────────────────────
  const toggleOption = (list: string[], setList: (v: string[]) => void, value: string) => {
    if (list.includes(value)) {
      setList(list.filter((x) => x !== value));
    } else {
      setList([...list, value]);
    }
  };

  const filterChipClass = (active: boolean, extra?: string) =>
    cn('border transition-all duration-150', extra, active ? ui.chipActive : ui.chipInactive);

  const {
    isMobile,
    open: filtersOpen,
    setOpen: setFiltersOpen,
    close: closeFilters,
  } = useMobileFilterSheet();

  const reportesFilterActiveCount = useMemo(() => {
    let count = 0;
    if (activeTab === 'produccion') {
      count += selectedMolinos.length + selectedMateriales.length + selectedTurnosProd.length;
    } else if (activeTab === 'nomina') {
      count += selectedAreasNom.length + selectedCargosNom.length + (selectedWorkerId ? 1 : 0);
    } else if (activeTab === 'voladuras') {
      count += selectedMinasVol.length + selectedVerticalesVol.length + selectedTurnosVol.length;
    } else if (activeTab === 'quemado') {
      count += selectedTurnosQuem.length;
    } else if (activeTab === 'extraccion') {
      count += selectedMinasExt.length + selectedVerticalesExt.length;
    } else if (activeTab === 'gastos') {
      count += selectedCategoriasGst.length;
    }
    return count;
  }, [
    activeTab,
    selectedMolinos,
    selectedMateriales,
    selectedTurnosProd,
    selectedAreasNom,
    selectedCargosNom,
    selectedWorkerId,
    selectedMinasVol,
    selectedVerticalesVol,
    selectedTurnosVol,
    selectedTurnosQuem,
    selectedMinasExt,
    selectedVerticalesExt,
    selectedCategoriasGst,
  ]);

  const workerSelectOptions = useMemo(
    () => [
      { value: '', label: 'Todos los trabajadores' },
      ...(initialOptions.nomina?.personal ?? []).map((p) => ({
        value: p.id,
        label: `${p.nombre_completo} (${p.cedula})`,
      })),
    ],
    [initialOptions.nomina?.personal],
  );

  const reportesFiltersPanel = (
    <div className="reportes-page__filters-mobile flex w-full min-w-0 flex-col gap-4">
<h3 className={ui.sectionTitle}>Rango de fechas</h3>
          <AppDateRangeFields
            from={dateRange.from}
            to={dateRange.to}
            onFromChange={(from) => setDateRange({ ...dateRange, from })}
            onToChange={(to) => setDateRange({ ...dateRange, to })}
            labelClassName={ui.fieldLabel}
          />

          <div className={cn(ui.divider, 'space-y-4 pt-4')}>
            <h3 className={ui.sectionTitle}>Filtros</h3>

            {/* DYNAMIC COMPONENT-SPECIFIC FILTERS */}
            {activeTab === 'produccion' && (
              <div className="space-y-3">
                {/* Molino */}
                <div className="space-y-1.5">
                  <label className={ui.fieldLabel}>Molino / Continuo</label>
                  <div className="flex flex-wrap gap-1">
                    {initialOptions.produccion.molinos.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => toggleOption(selectedMolinos, setSelectedMolinos, m)}
                        className={`px-2.5 py-1 text-[11px] font-medium rounded-full border transition-all duration-150 ${
                          selectedMolinos.includes(m)
                            ? ui.chipActive
                            : ui.chipInactive
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Material */}
                <div className="space-y-1.5">
                  <label className={ui.fieldLabel}>Material de Origen</label>
                  <div className="flex flex-wrap gap-1">
                    {initialOptions.produccion.materiales.map((mat) => (
                      <button
                        key={mat}
                        type="button"
                        onClick={() => toggleOption(selectedMateriales, setSelectedMateriales, mat)}
                        className={`px-2.5 py-1 text-[11px] font-medium rounded-full border transition-all duration-150 ${
                          selectedMateriales.includes(mat)
                            ? ui.chipActive
                            : ui.chipInactive
                        }`}
                      >
                        {mat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Turno */}
                <div className="space-y-1.5">
                  <label className={ui.fieldLabel}>Turno Operativo</label>
                  <div className="flex gap-1">
                    {['dia', 'noche'].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => toggleOption(selectedTurnosProd, setSelectedTurnosProd, t)}
                        className={`flex-1 px-2.5 py-1 text-[11px] font-semibold capitalize rounded-lg border transition-all duration-150 ${
                          selectedTurnosProd.includes(t)
                            ? ui.chipActive
                            : ui.chipInactive
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Agrupar */}
                <div className={cn(ui.divider, 'flex flex-col gap-1.5 pt-2')}>
                  <label className={ui.fieldLabel}>Agrupar Datos por</label>
                  <AppSelect
                    value={groupByProd}
                    onChange={(v) => setGroupByProd(v as typeof groupByProd)}
                    options={[
                      { value: 'dia', label: 'Por Día' },
                      { value: 'semana', label: 'Por Semana' },
                      { value: 'mes', label: 'Por Mes' },
                      { value: 'molino', label: 'Por Molino' },
                      { value: 'material', label: 'Por Material' },
                    ]}
                  />
                </div>
              </div>
            )}

            {activeTab === 'nomina' && (
              <div className="space-y-3">
                {/* Area */}
                <div className="space-y-1.5">
                  <label className={ui.fieldLabel}>Área Operativa</label>
                  <div className="flex flex-wrap gap-1">
                    {['mina', 'planta', 'administracion', 'seguridad', 'transporte'].map((a) => (
                      <button
                        key={a}
                        type="button"
                        onClick={() => toggleOption(selectedAreasNom, setSelectedAreasNom, a)}
                        className={`px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider rounded-full border transition-all duration-150 ${
                          selectedAreasNom.includes(a)
                            ? ui.chipActive
                            : ui.chipInactive
                        }`}
                      >
                        {a === 'planta' ? 'Molino' : a}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cargo */}
                <div className="space-y-1.5">
                  <label className={ui.fieldLabel}>Cargos Específicos</label>
                  <div className="flex flex-wrap gap-1.5">
                    {initialOptions.nomina.cargos.map((cg) => (
                      <button
                        key={cg}
                        type="button"
                        onClick={() => toggleOption(selectedCargosNom, setSelectedCargosNom, cg)}
                        className={`px-2 py-0.5 text-[10px] rounded-md border transition-all duration-150 ${
                          selectedCargosNom.includes(cg)
                            ? ui.chipActive
                            : ui.chipInactive
                        }`}
                      >
                        {cg}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Trabajador */}
                <div className="flex flex-col gap-1.5">
                  <label className={ui.fieldLabel}>Trabajador Singular</label>
                  <AppSelect
                    value={selectedWorkerId}
                    onChange={setSelectedWorkerId}
                    options={workerSelectOptions}
                    placeholder="Todos los trabajadores"
                  />
                </div>

                {/* Agrupar */}
                <div className={cn(ui.divider, 'flex flex-col gap-1.5 pt-2')}>
                  <label className={ui.fieldLabel}>Agrupar Nómina por</label>
                  <AppSelect
                    value={groupByNom}
                    onChange={(v) => setGroupByNom(v as typeof groupByNom)}
                    options={[
                      { value: 'semana', label: 'Por Semana' },
                      { value: 'mes', label: 'Por Mes' },
                      { value: 'area', label: 'Por Área Operativa' },
                      { value: 'cargo', label: 'Por Cargo de Personal' },
                      { value: 'trabajador', label: 'Por Trabajador' },
                    ]}
                  />
                </div>
              </div>
            )}

            {activeTab === 'voladuras' && (
              <div className="space-y-3">
                {/* Minas */}
                <div className="space-y-1.5">
                  <label className={ui.fieldLabel}>Zonas de Mina</label>
                  <div className="reportes-ui__filter-stack flex flex-col gap-1.5">
                    {initialOptions.voladuras.minas.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => toggleOption(selectedMinasVol, setSelectedMinasVol, m)}
                        className={filterChipClass(
                          selectedMinasVol.includes(m),
                          'w-full rounded-full px-2.5 py-1.5 text-left text-[11px] font-medium',
                        )}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Verticales */}
                <div className="space-y-1.5">
                  <label className={ui.fieldLabel}>Frentes Verticales</label>
                  <div className="reportes-ui__filter-stack flex flex-col gap-1.5">
                    {initialOptions.voladuras.verticales.map((vt) => (
                      <button
                        key={vt}
                        type="button"
                        onClick={() => toggleOption(selectedVerticalesVol, setSelectedVerticalesVol, vt)}
                        className={filterChipClass(
                          selectedVerticalesVol.includes(vt),
                          'w-full rounded-md px-2.5 py-1.5 text-left text-[11px]',
                        )}
                      >
                        {vt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Turno */}
                <div className="space-y-1.5">
                  <label className={ui.fieldLabel}>Turno de Disparo</label>
                  <div className="flex gap-1">
                    {['dia', 'noche'].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => toggleOption(selectedTurnosVol, setSelectedTurnosVol, t)}
                        className={`flex-1 px-2.5 py-1 text-[11px] font-semibold capitalize rounded-lg border transition-all duration-150 ${
                          selectedTurnosVol.includes(t)
                            ? ui.chipActive
                            : ui.chipInactive
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Agrupar */}
                <div className={cn(ui.divider, 'flex flex-col gap-1.5 pt-2')}>
                  <label className={ui.fieldLabel}>Agrupar Voladuras por</label>
                  <AppSelect
                    value={groupByVol}
                    onChange={(v) => setGroupByVol(v as typeof groupByVol)}
                    options={[
                      { value: 'dia', label: 'Por Día' },
                      { value: 'semana', label: 'Por Semana' },
                      { value: 'mina', label: 'Por Mina' },
                    ]}
                  />
                </div>
              </div>
            )}

            {activeTab === 'quemado' && (
              <div className="space-y-3">
                {/* Turno */}
                <div className="space-y-1.5">
                  <label className={ui.fieldLabel}>Turno de Quemado</label>
                  <div className="flex gap-1">
                    {['dia', 'noche'].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => toggleOption(selectedTurnosQuem, setSelectedTurnosQuem, t)}
                        className={`flex-1 px-2.5 py-1 text-[11px] font-semibold capitalize rounded-lg border transition-all duration-150 ${
                          selectedTurnosQuem.includes(t)
                            ? ui.chipActive
                            : ui.chipInactive
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Agrupar */}
                <div className={cn(ui.divider, 'flex flex-col gap-1.5 pt-2')}>
                  <label className={ui.fieldLabel}>Agrupar por</label>
                  <AppSelect
                    value={groupByQuem}
                    onChange={(v) => setGroupByQuem(v as typeof groupByQuem)}
                    options={[
                      { value: 'dia', label: 'Por Día' },
                      { value: 'semana', label: 'Por Semana' },
                      { value: 'mes', label: 'Por Mes' },
                      { value: 'plancha', label: 'Por Plancha' },
                    ]}
                  />
                </div>
              </div>
            )}

            {activeTab === 'extraccion' && (
              <div className="space-y-3">
                {/* Minas */}
                <div className="space-y-1.5">
                  <label className={ui.fieldLabel}>Zonas de Mina</label>
                  <div className="flex flex-wrap gap-1">
                    {initialOptions.extraccion.minas.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => toggleOption(selectedMinasExt, setSelectedMinasExt, m)}
                        className={`px-2.5 py-1 text-[11px] font-medium rounded-full border transition-all duration-150 ${
                          selectedMinasExt.includes(m)
                            ? ui.chipActive
                            : ui.chipInactive
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Verticales */}
                <div className="space-y-1.5">
                  <label className={ui.fieldLabel}>Frentes Verticales</label>
                  <div className="flex flex-wrap gap-1">
                    {initialOptions.extraccion.verticales.map((vt) => (
                      <button
                        key={vt}
                        type="button"
                        onClick={() => toggleOption(selectedVerticalesExt, setSelectedVerticalesExt, vt)}
                        className={`px-2 py-0.5 text-[11px] rounded-md border transition-all duration-150 ${
                          selectedVerticalesExt.includes(vt)
                            ? ui.chipActive
                            : ui.chipInactive
                        }`}
                      >
                        {vt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Turno */}
                <div className="space-y-1.5">
                  <label className={ui.fieldLabel}>Turno Operativo</label>
                  <div className="flex gap-1">
                    {['dia', 'noche'].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => toggleOption(selectedTurnosExt, setSelectedTurnosExt, t)}
                        className={`flex-1 px-2.5 py-1 text-[11px] font-semibold capitalize rounded-lg border transition-all duration-150 ${
                          selectedTurnosExt.includes(t)
                            ? ui.chipActive
                            : ui.chipInactive
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Agrupar */}
                <div className={cn(ui.divider, 'flex flex-col gap-1.5 pt-2')}>
                  <label className={ui.fieldLabel}>Agrupar por</label>
                  <AppSelect
                    value={groupByExt}
                    onChange={(v) => setGroupByExt(v as typeof groupByExt)}
                    options={[
                      { value: 'dia', label: 'Por Día' },
                      { value: 'semana', label: 'Por Semana' },
                      { value: 'mina', label: 'Por Mina' },
                    ]}
                  />
                </div>
              </div>
            )}

            {activeTab === 'gastos' && (
              <div className="space-y-3">
                {/* Categorías */}
                <div className="space-y-1.5">
                  <label className={ui.fieldLabel}>Categorías de Gastos</label>
                  <div className="reportes-ui__filter-stack flex flex-col gap-1.5">
                    {initialOptions.gastos.categorias.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleOption(selectedCategoriasGst, setSelectedCategoriasGst, c.id)}
                        className={filterChipClass(
                          selectedCategoriasGst.includes(c.id),
                          'w-full rounded-md px-2.5 py-1.5 text-left text-[11px]',
                        )}
                      >
                        {c.nombre}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tipo de Gasto */}
                <div className="space-y-1.5">
                  <label className={ui.fieldLabel}>Tipos Administrativos</label>
                  <div className="flex flex-wrap gap-1">
                    {['mina', 'planta', 'general', 'transporte', 'seguridad', 'administrativo'].map((tp) => (
                      <button
                        key={tp}
                        type="button"
                        onClick={() => toggleOption(selectedTiposGst, setSelectedTiposGst, tp)}
                        className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-md border transition-all duration-150 ${
                          selectedTiposGst.includes(tp)
                            ? ui.chipActive
                            : ui.chipInactive
                        }`}
                      >
                        {tp === 'planta' ? 'Molino' : tp}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Proveedor / Factura buscador */}
                <div className="flex flex-col gap-1.5">
                  <label className={ui.fieldLabel}>Buscar Proveedor / Factura</label>
                  <input
                    type="text"
                    value={searchProveedor}
                    onChange={(e) => setSearchProveedor(e.target.value)}
                    placeholder="Escriba aquí..."
                    className={ui.input}
                  />
                </div>

                {/* Agrupar */}
                <div className={cn(ui.divider, 'flex flex-col gap-1.5 pt-2')}>
                  <label className={ui.fieldLabel}>Agrupar por</label>
                  <AppSelect
                    value={groupByGst}
                    onChange={(v) => setGroupByGst(v as typeof groupByGst)}
                    options={[
                      { value: 'dia', label: 'Por Día' },
                      { value: 'semana', label: 'Por Semana' },
                      { value: 'mes', label: 'Por Mes' },
                      { value: 'categoria', label: 'Por Categoría' },
                    ]}
                  />
                </div>
              </div>
            )}

          </div>
    </div>
  );

  return (
    <div className="reportes-page flex min-h-0 w-full flex-1 flex-col gap-2 overflow-hidden sm:gap-2.5">
      <ReportesTabs
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
        }}
      />

      {activeTab === 'reconciliacion' ? (
        <ReconciliacionPanel initialOptions={initialOptions} />
      ) : activeTab === 'balance' ? (
        <BalanceReportPanel initialOptions={initialOptions} />
      ) : (
      <>
      {isMobile ? (
        <div className="reportes-page__filter-bar">
          <MobileFilterTrigger
            activeCount={reportesFilterActiveCount}
            label="Filtros del reporte"
            subtitle={`${dateRange.from} — ${dateRange.to}`}
            onOpen={() => setFiltersOpen(true)}
          />
        </div>
      ) : null}
      <div className="reportes-page__grid grid min-h-0 flex-1 grid-cols-1 items-stretch gap-3 md:grid-cols-4 md:gap-4">
        {/* LEFT COLUMN: FILTERS (Glassmorphic Card) */}
        <div
          className={cn(
            ui.sidebar,
            'reportes-page__sidebar hidden md:flex md:min-h-0 md:min-w-0 md:overflow-y-auto md:overscroll-contain custom-scrollbar',
          )}
        >
          {reportesFiltersPanel}
        </div>

        {/* RIGHT COLUMN: PREVIEW & DOWNLOADS */}
        <div className="reportes-page__preview-col md:col-span-3 flex h-full min-h-0 min-w-0 flex-1 flex-col">
          {/* PREVIEW CONTAINER */}
          <div className={ui.previewPanel}>
            <div className="reportes-ui__preview-head flex shrink-0 flex-col gap-2.5">
              <h2 className={cn(ui.previewTitle, 'flex items-center gap-2')}>
                Vista previa
                {isPending && <Loader2 className={cn('w-3.5 h-3.5 animate-spin', ui.metaText)} />}
              </h2>
              {aggregated && aggregated.rows.length > 0 && (
                <div className={cn(ui.exportActions, 'flex-wrap items-center gap-2')}>
                  <HubConstructorLink payload={hubConstructorPayload} />
                  <button type="button" onClick={handleDownloadPDF} className={ui.btnExport}>
                    <FileText className="h-4 w-4 shrink-0" />
                    PDF
                  </button>
                  <button type="button" onClick={handleDownloadCSV} className={ui.btnExport}>
                    <FileSpreadsheet className="h-4 w-4 shrink-0" />
                    CSV
                  </button>
                </div>
              )}
            </div>

            {/* ERROR STATE */}
            {error && (
              <div className="flex gap-3 items-center p-4 rounded-xl border border-red-500/20 bg-red-500/5">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p className="text-sm font-semibold">{error}</p>
              </div>
            )}

            {/* LOADING STATE */}
            {isPending && !aggregated && (
              <div className={ui.emptyState}>
                <Loader2 className={cn('h-6 w-6 animate-spin', ui.metaText)} />
                <p className={ui.emptyTitle}>Cargando datos…</p>
              </div>
            )}

            {/* NO DATA STATE */}
            {!isPending && (!aggregated || aggregated.rows.length === 0) && !error && (
              <div className={ui.emptyState}>
                <HelpCircle className="h-8 w-8 text-[var(--dashboard-text-muted)] opacity-60" />
                <p className={ui.emptyTitle}>No se encontraron registros</p>
                <p className={ui.emptyHint}>
                  Prueba ampliando el rango de fechas o seleccionando menos filtros dinámicos.
                </p>
              </div>
            )}

            {/* DATA RENDER: KPIs + TABLE */}
            {aggregated && aggregated.rows.length > 0 && !error && (
              <div className="reportes-ui__preview-body flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
                {/* 1. KPIs Row */}
                <div className="reportes-ui__kpi-grid grid shrink-0 grid-cols-2 gap-2 md:grid-cols-4">
                  {activeTab === 'produccion' && (
                    <>
                      <div className={ui.kpiCard}>
                        <p className={ui.kpiLabel}>Oro Recuperado</p>
                        <p className={ui.kpiValue}>{aggregated.kpis.oroTotalGrams.toLocaleString()} g</p>
                      </div>
                      <div className={ui.kpiCard}>
                        <p className={ui.kpiLabel}>Sacos Vaciados</p>
                        <p className={ui.kpiValueSmall}>{aggregated.kpis.sacosTotal.toLocaleString()}</p>
                      </div>
                      <div className={ui.kpiCard}>
                        <p className={ui.kpiLabel}>Toneladas</p>
                        <p className={ui.kpiValueSmall}>{aggregated.kpis.toneladasTotal.toLocaleString()} t</p>
                      </div>
                      <div className={ui.kpiCard}>
                        <p className={ui.kpiLabel}>Tenor Promedio</p>
                        <p className={ui.kpiValue}>{aggregated.kpis.tenorPromedioGpt.toFixed(2)} g/t</p>
                      </div>
                    </>
                  )}

                  {activeTab === 'nomina' && (
                    <>
                      <div className={ui.kpiCard}>
                        <p className={ui.kpiLabel}>Total Nómina</p>
                        <p className={ui.kpiValue}>${aggregated.kpis.totalPagado.toLocaleString()}</p>
                      </div>
                      <div className={ui.kpiCard}>
                        <p className={ui.kpiLabel}>Bono Transporte</p>
                        <p className={ui.kpiValueSmall}>${aggregated.kpis.bonoTransporteTotal.toLocaleString()}</p>
                      </div>
                      <div className={ui.kpiCard}>
                        <p className={ui.kpiLabel}>Trabajadores</p>
                        <p className={ui.kpiValueSmall}>{aggregated.kpis.trabajadoresUnicos}</p>
                      </div>
                      {showNominaSplit ? (
                        nominaSplitCols.map((div) => {
                          const kpiDiv = aggregated.kpis.divisiones?.find((d: NominaDivisionAmount) => d.id === div.id);
                          return (
                            <div
                              key={div.id}
                              className={ui.kpiCard}
                            >
                              <p className={cn(ui.kpiLabel, 'truncate')} title={div.nombre}>
                                {div.nombre}
                              </p>
                              <p className={ui.kpiValue}>
                                ${(kpiDiv?.montoUsd ?? 0).toLocaleString()}
                              </p>
                            </div>
                          );
                        })
                      ) : (
                        <div className={ui.kpiCard}>
                          <p className={ui.kpiLabel}>Reparto cierre</p>
                          <p className={cn(ui.kpiValueSmall, 'mt-1 font-bold')}>
                            ${aggregated.kpis.pedroTotal.toLocaleString()} / ${aggregated.kpis.darinelTotal.toLocaleString()} / ${aggregated.kpis.laFeTotal.toLocaleString()}
                          </p>
                        </div>
                      )}
                    </>
                  )}

                  {activeTab === 'voladuras' && (
                    <>
                      <div className={ui.kpiCard}>
                        <p className={ui.kpiLabel}>Nro. Disparos</p>
                        <p className={ui.kpiValue}>{aggregated.kpis.disparosCount}</p>
                      </div>
                      <div className={ui.kpiCard}>
                        <p className={ui.kpiLabel}>Huecos</p>
                        <p className={ui.kpiValueSmall}>{aggregated.kpis.huecosTotal.toLocaleString()}</p>
                      </div>
                      <div className={ui.kpiCard}>
                        <p className={ui.kpiLabel}>Chupis</p>
                        <p className={ui.kpiValueSmall}>{aggregated.kpis.chupisTotal.toLocaleString()}</p>
                      </div>
                      <div className={ui.kpiCard}>
                        <p className={ui.kpiLabel}>Consumo Arroz</p>
                        <p className={ui.kpiValue}>{aggregated.kpis.arrozKgTotal.toLocaleString()} kg</p>
                      </div>
                    </>
                  )}

                  {activeTab === 'quemado' && groupByQuem === 'plancha' && aggregated.kpis.totalPlanchas !== undefined && (
                    <>
                      <div className={ui.kpiCard}>
                        <p className={ui.kpiLabel}>Total Quemadas</p>
                        <p className={ui.kpiValueSmall}>{aggregated.kpis.totalQuemadas}</p>
                      </div>
                      <div className={ui.kpiCard}>
                        <p className={ui.kpiLabel}>Planchas con Datos</p>
                        <p className={ui.kpiValue}>{aggregated.kpis.totalPlanchas}</p>
                      </div>
                      <div className={ui.kpiCard}>
                        <p className={ui.kpiLabel}>Total Amalgama</p>
                        <p className={ui.kpiValueSmall}>{aggregated.kpis.amalgamaTotalG.toLocaleString()} g</p>
                      </div>
                      <div className={ui.kpiCard}>
                        <p className={ui.kpiLabel}>Total Oro (Planchas)</p>
                        <p className={ui.kpiValue}>{aggregated.kpis.oroTotalG.toLocaleString()} g</p>
                      </div>
                      <div className={ui.kpiCard}>
                        <p className={ui.kpiLabel}>Rendimiento Global</p>
                        <p className={ui.kpiValue}>{aggregated.kpis.rendimientoGlobalPct.toFixed(2)}%</p>
                      </div>
                      <div className={ui.kpiCard}>
                        <p className={ui.kpiLabel}>Manto / Retorta</p>
                        <p className={cn(ui.kpiValueSmall, 'mt-2 text-xs font-bold')}>
                          M:{aggregated.kpis.mantoAmalgamaTotalG.toFixed(0)}g | R:{aggregated.kpis.retortaOroTotalG.toFixed(0)}g
                        </p>
                      </div>
                    </>
                  )}
                  {activeTab === 'quemado' && groupByQuem !== 'plancha' && (
                    <>
                      <div className={ui.kpiCard}>
                        <p className={ui.kpiLabel}>Total Amalgama</p>
                        <p className={ui.kpiValueSmall}>{aggregated.kpis.amalgamaTotalG.toLocaleString()} g</p>
                      </div>
                      <div className={ui.kpiCard}>
                        <p className={ui.kpiLabel}>Oro Puro</p>
                        <p className={ui.kpiValue}>{aggregated.kpis.oroTotalG.toLocaleString()} g</p>
                      </div>
                      <div className={ui.kpiCard}>
                        <p className={ui.kpiLabel}>Rendimiento</p>
                        <p className={ui.kpiValue}>{aggregated.kpis.rendimientoOroPct.toFixed(2)}%</p>
                      </div>
                      <div className={ui.kpiCard}>
                        <p className={ui.kpiLabel}>Manto / Retorta</p>
                        <p className={cn(ui.kpiValueSmall, 'mt-2 text-xs font-bold')}>
                          M:{aggregated.kpis.mantoOroTotalG.toFixed(0)}g | R:{aggregated.kpis.retortaOroTotalG.toFixed(0)}g
                        </p>
                      </div>
                    </>
                  )}

                  {activeTab === 'extraccion' && (
                    <>
                      <div className={ui.kpiCard}>
                        <p className={ui.kpiLabel}>Reportes</p>
                        <p className={ui.kpiValueSmall}>{aggregated.kpis.reportesCount}</p>
                      </div>
                      <div className={ui.kpiCard}>
                        <p className={ui.kpiLabel}>Sacos Extraídos</p>
                        <p className={ui.kpiValue}>{aggregated.kpis.sacosTotal.toLocaleString()}</p>
                      </div>
                      <div className={ui.kpiCard}>
                        <p className={ui.kpiLabel}>Eventos / Novedades</p>
                        <p className={ui.kpiValueSmall}>{aggregated.kpis.eventosTotal}</p>
                      </div>
                      <div className={ui.kpiCard}>
                        <p className={ui.kpiLabel}>Promedio/Reporte</p>
                        <p className={ui.kpiValue}>
                          {aggregated.kpis.reportesCount > 0 ? (aggregated.kpis.sacosTotal / aggregated.kpis.reportesCount).toFixed(0) : '0'}
                        </p>
                      </div>
                    </>
                  )}

                  {activeTab === 'gastos' && (
                    <>
                      <div className={ui.kpiCard}>
                        <p className={ui.kpiLabel}>Total Gastado</p>
                        <p className={ui.kpiValueSmall}>${aggregated.kpis.totalGastado.toLocaleString()}</p>
                      </div>
                      <div className={ui.kpiCard}>
                        <p className={ui.kpiLabel}>Gasto Promedio</p>
                        <p className={ui.kpiValueSmall}>${aggregated.kpis.promedioGasto.toLocaleString()}</p>
                      </div>
                      <div className={ui.kpiCard}>
                        <p className={ui.kpiLabel}>Nro. Transacciones</p>
                        <p className={ui.kpiValueSmall}>{aggregated.kpis.registrosCount}</p>
                      </div>
                      <div className={ui.kpiCard}>
                        <p className={ui.kpiLabel}>Mayor Gasto Único</p>
                        <p className={cn(ui.kpiValueSmall, 'truncate')} title={aggregated.kpis.mayorGastoDesc}>
                          ${aggregated.kpis.mayorGastoMonto.toLocaleString()}
                        </p>
                      </div>
                    </>
                  )}

                </div>

                {/* 2. Table Preview */}
                <div className="reportes-ui__table-shell app-surface-card flex min-h-0 flex-1 flex-col overflow-hidden">
                  <div
                    ref={tableAreaRef}
                    className="reportes-ui__table-area flex min-h-0 flex-1 flex-col overflow-hidden"
                  >
                    <div className="reportes-ui__table-body gastos-page__table-body min-h-0 flex-1 overflow-hidden overflow-x-auto">
                  <table className="gastos-table w-full table-fixed border-collapse text-xs">
                    <thead className="gastos-thead">
                      <tr>
                        <th className="gastos-th px-2.5 py-1 text-left text-[10px] font-semibold uppercase tracking-wider">Grupo / Periodo</th>
                        {activeTab === 'produccion' && (
                          <>
                            <th className="gastos-th px-2.5 py-1 text-right text-[10px] font-semibold uppercase tracking-wider">Sacos</th>
                            <th className="gastos-th px-2.5 py-1 text-right text-[10px] font-semibold uppercase tracking-wider">Toneladas</th>
                            <th className="gastos-th px-2.5 py-1 text-right text-[10px] font-semibold uppercase tracking-wider">Oro (g)</th>
                            <th className="gastos-th px-2.5 py-1 text-right text-[10px] font-semibold uppercase tracking-wider">Tenor (g/t)</th>
                            <th className="gastos-th px-2.5 py-1 text-right text-[10px] font-semibold uppercase tracking-wider">Merma %</th>
                          </>
                        )}
                        {activeTab === 'nomina' && (
                          <>
                            <th className="gastos-th px-2.5 py-1 text-right text-[10px] font-semibold uppercase tracking-wider">Cant. Personal</th>
                            <th className="gastos-th px-2.5 py-1 text-right text-[10px] font-semibold uppercase tracking-wider">Pago Nómina</th>
                            <th className="gastos-th px-2.5 py-1 text-right text-[10px] font-semibold uppercase tracking-wider">Bono Transporte</th>
                            {showNominaSplit
                              ? nominaSplitCols.map((div) => (
                                  <th
                                    key={div.id}
                                    className="gastos-th px-2.5 py-1 text-right text-[10px] font-semibold uppercase tracking-wider truncate"
                                    title={div.nombre}
                                  >
                                    {div.nombre}
                                  </th>
                                ))
                              : null}
                          </>
                        )}
                        {activeTab === 'voladuras' && (
                          <>
                            <th className="gastos-th px-2.5 py-1 text-right text-[10px] font-semibold uppercase tracking-wider">Disparos</th>
                            <th className="gastos-th px-2.5 py-1 text-right text-[10px] font-semibold uppercase tracking-wider">Huecos</th>
                            <th className="gastos-th px-2.5 py-1 text-right text-[10px] font-semibold uppercase tracking-wider">Pies Huecos</th>
                            <th className="gastos-th px-2.5 py-1 text-right text-[10px] font-semibold uppercase tracking-wider">Chupis</th>
                            <th className="gastos-th px-2.5 py-1 text-right text-[10px] font-semibold uppercase tracking-wider">Arroz (kg)</th>
                            <th className="gastos-th px-2.5 py-1 text-right text-[10px] font-semibold uppercase tracking-wider">Ratio H/C</th>
                          </>
                        )}
                        {activeTab === 'quemado' && groupByQuem === 'plancha' && (
                          <>
                            <th className="gastos-th px-2.5 py-1 text-right text-[10px] font-semibold uppercase tracking-wider">Plancha</th>
                            <th className="gastos-th px-2.5 py-1 text-right text-[10px] font-semibold uppercase tracking-wider">Amalgama (g)</th>
                            <th className="gastos-th px-2.5 py-1 text-right text-[10px] font-semibold uppercase tracking-wider">Oro (g)</th>
                            <th className="gastos-th px-2.5 py-1 text-right text-[10px] font-semibold uppercase tracking-wider">Total (g)</th>
                            <th className="gastos-th px-2.5 py-1 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--mineos-general)]">% del Total</th>
                            <th className="gastos-th px-2.5 py-1 text-right text-[10px] font-semibold uppercase tracking-wider">Quemadas c/ Datos</th>
                            <th className="gastos-th px-2.5 py-1 text-left text-[10px] font-semibold uppercase tracking-wider">Fecha Inicio</th>
                            <th className="gastos-th px-2.5 py-1 text-left text-[10px] font-semibold uppercase tracking-wider">Fecha Fin</th>
                          </>
                        )}
                        {activeTab === 'quemado' && groupByQuem !== 'plancha' && (
                          <>
                            <th className="gastos-th px-2.5 py-1 text-right text-[10px] font-semibold uppercase tracking-wider">Procesos</th>
                            <th className="gastos-th px-2.5 py-1 text-right text-[10px] font-semibold uppercase tracking-wider">Amalgama (g)</th>
                            <th className="gastos-th px-2.5 py-1 text-right text-[10px] font-semibold uppercase tracking-wider">Oro Puro (g)</th>
                            <th className="gastos-th px-2.5 py-1 text-right text-[10px] font-semibold uppercase tracking-wider">Rendimiento %</th>
                            <th className="gastos-th px-2.5 py-1 text-right text-[10px] font-semibold uppercase tracking-wider">Nro Planchas</th>
                          </>
                        )}
                        {activeTab === 'extraccion' && (
                          <>
                            <th className="gastos-th px-2.5 py-1 text-right text-[10px] font-semibold uppercase tracking-wider">Reportes</th>
                            <th className="gastos-th px-2.5 py-1 text-right text-[10px] font-semibold uppercase tracking-wider">Sacos Extraídos</th>
                            <th className="gastos-th px-2.5 py-1 text-right text-[10px] font-semibold uppercase tracking-wider">Cant. Eventos</th>
                          </>
                        )}
                        {activeTab === 'gastos' && (
                          <>
                            <th className="gastos-th px-2.5 py-1 text-right text-[10px] font-semibold uppercase tracking-wider">Total Gastado</th>
                            <th className="gastos-th px-2.5 py-1 text-right text-[10px] font-semibold uppercase tracking-wider">Gasto Promedio</th>
                            <th className="gastos-th px-2.5 py-1 text-right text-[10px] font-semibold uppercase tracking-wider text-red-300">Gasto Mayor</th>
                            <th className="gastos-th px-2.5 py-1 text-right text-[10px] font-semibold uppercase tracking-wider">Transacciones</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.map((row: any, idx: number) => (
                        <tr key={`${row.grupo}-${idx}`} className="gastos-table__row gastos-tr">
                          <td className="gastos-table__cell gastos-td max-w-0 truncate px-2.5 text-[11px] font-medium">{row.grupo}</td>
                          
                          {activeTab === 'produccion' && (
                            <>
                              <td className="gastos-table__cell gastos-td max-w-0 truncate px-2.5 text-[11px] text-right">{row.sacos.toLocaleString()}</td>
                              <td className="gastos-table__cell gastos-td max-w-0 truncate px-2.5 text-[11px] text-right">{row.toneladas.toLocaleString()} t</td>
                              <td className="gastos-table__cell gastos-td max-w-0 truncate px-2.5 text-[11px] text-right font-semibold">{row.oroGramos.toLocaleString()} g</td>
                              <td className="gastos-table__cell gastos-td max-w-0 truncate px-2.5 text-[11px] text-right">{row.tenorGpt.toFixed(2)} g/t</td>
                              <td className="gastos-table__cell gastos-td max-w-0 truncate px-2.5 text-[11px] text-right text-zinc-400">{row.mermaPct.toFixed(2)}%</td>
                            </>
                          )}

                          {activeTab === 'nomina' && (
                            <>
                              <td className="gastos-table__cell gastos-td max-w-0 truncate px-2.5 text-[11px] text-right">{row.trabajadoresCount}</td>
                              <td className="gastos-table__cell gastos-td max-w-0 truncate px-2.5 text-[11px] text-right font-semibold">${row.montoPagado.toLocaleString()}</td>
                              <td className="gastos-table__cell gastos-td max-w-0 truncate px-2.5 text-[11px] text-right">${row.bonoTransporte.toLocaleString()}</td>
                              {showNominaSplit
                                ? nominaSplitCols.map((div) => {
                                    const amount =
                                      row.divisiones?.find((d: NominaDivisionAmount) => d.id === div.id)
                                        ?.montoUsd ?? 0;
                                    return (
                                      <td
                                        key={div.id}
                                        className="gastos-table__cell gastos-td max-w-0 truncate px-2.5 text-[11px] text-right"
                                      >
                                        ${amount.toLocaleString()}
                                      </td>
                                    );
                                  })
                                : null}
                            </>
                          )}

                          {activeTab === 'voladuras' && (
                            <>
                              <td className="gastos-table__cell gastos-td max-w-0 truncate px-2.5 text-[11px] text-right">{row.disparos}</td>
                              <td className="gastos-table__cell gastos-td max-w-0 truncate px-2.5 text-[11px] text-right">{row.huecos.toLocaleString()}</td>
                              <td className="gastos-table__cell gastos-td max-w-0 truncate px-2.5 text-[11px] text-right">{row.huecosPies.toLocaleString()} ft</td>
                              <td className="gastos-table__cell gastos-td max-w-0 truncate px-2.5 text-[11px] text-right">{row.chupis.toLocaleString()}</td>
                              <td className="gastos-table__cell gastos-td max-w-0 truncate px-2.5 text-[11px] text-right">{row.arrozKg.toLocaleString()} kg</td>
                              <td className="gastos-table__cell gastos-td max-w-0 truncate px-2.5 text-[11px] text-right font-semibold">{row.ratioHC.toFixed(2)}</td>
                            </>
                          )}

                          {activeTab === 'quemado' && groupByQuem === 'plancha' && (
                            <>
                              <td className="gastos-table__cell gastos-td max-w-0 truncate px-2.5 text-[11px] font-bold text-[var(--mineos-general)]">{row.label}</td>
                              <td className="gastos-table__cell gastos-td max-w-0 truncate px-2.5 text-[11px] text-right">{row.amalgamaG.toLocaleString()} g</td>
                              <td className="gastos-table__cell gastos-td max-w-0 truncate px-2.5 text-[11px] text-right font-semibold text-[var(--mineos-benefit)]">{row.oroG.toLocaleString()} g</td>
                              <td className="gastos-table__cell gastos-td max-w-0 truncate px-2.5 text-[11px] text-right font-bold">{row.totalG.toLocaleString()} g</td>
                              <td className="gastos-table__cell gastos-td max-w-0 truncate px-2.5 text-[11px] text-right font-bold text-[var(--mineos-general)]">{row.pctTotal.toFixed(2)}%</td>
                              <td className="gastos-table__cell gastos-td max-w-0 truncate px-2.5 text-[11px] text-right">{row.quemadasConDatos}</td>
                              <td className="gastos-table__cell gastos-td max-w-0 truncate px-2.5 text-[11px] font-medium text-[var(--text-secondary)]">{row.fechaInicio ? format(parseISO(row.fechaInicio), 'dd/MM/yyyy', { locale: es }) : '—'}</td>
                              <td className="gastos-table__cell gastos-td max-w-0 truncate px-2.5 text-[11px] font-medium text-[var(--text-secondary)]">{row.fechaFin ? format(parseISO(row.fechaFin), 'dd/MM/yyyy', { locale: es }) : '—'}</td>
                            </>
                          )}
                          {activeTab === 'quemado' && groupByQuem !== 'plancha' && (
                            <>
                              <td className="gastos-table__cell gastos-td max-w-0 truncate px-2.5 text-[11px] text-right">{row.quemadas}</td>
                              <td className="gastos-table__cell gastos-td max-w-0 truncate px-2.5 text-[11px] text-right">{row.amalgamaG.toLocaleString()} g</td>
                              <td className="gastos-table__cell gastos-td max-w-0 truncate px-2.5 text-[11px] text-right font-semibold">{row.oroG.toLocaleString()} g</td>
                              <td className="gastos-table__cell gastos-td max-w-0 truncate px-2.5 text-[11px] text-right">{row.rendimientoPct.toFixed(2)}%</td>
                              <td className="gastos-table__cell gastos-td max-w-0 truncate px-2.5 text-[11px] text-right">{row.planchasCount}</td>
                            </>
                          )}

                          {activeTab === 'extraccion' && (
                            <>
                              <td className="gastos-table__cell gastos-td max-w-0 truncate px-2.5 text-[11px] text-right">{row.reportes}</td>
                              <td className="gastos-table__cell gastos-td max-w-0 truncate px-2.5 text-[11px] text-right font-semibold">{row.sacos.toLocaleString()} sacos</td>
                              <td className="gastos-table__cell gastos-td max-w-0 truncate px-2.5 text-[11px] text-right">{row.eventos}</td>
                            </>
                          )}

                          {activeTab === 'gastos' && (
                            <>
                              <td className="gastos-table__cell gastos-td max-w-0 truncate px-2.5 text-[11px] text-right font-semibold">${row.monto.toLocaleString()}</td>
                              <td className="gastos-table__cell gastos-td max-w-0 truncate px-2.5 text-[11px] text-right">${row.gastoPromedio.toLocaleString()}</td>
                              <td className="gastos-table__cell gastos-td max-w-0 truncate px-2.5 text-[11px] text-right text-red-300">${row.gastoMayor.toLocaleString()}</td>
                              <td className="gastos-table__cell gastos-td max-w-0 truncate px-2.5 text-[11px] text-right">{row.registrosCount}</td>
                            </>
                          )}

                        </tr>
                      ))}
                      <ReportesTableRowPadding
                        colSpan={reportesTableColSpan(activeTab, showNominaSplit ? nominaSplitCols.length : 0)}
                        count={emptyRowSlots}
                      />
                    </tbody>
                  </table>
                    </div>
                  </div>
                  {tableFooterMeta ? (
                    <ReportesTableFooter
                      summaryLabel={tableFooterMeta.summaryLabel}
                      summaryValue={tableFooterMeta.summaryValue}
                      countLabel={tableFooterMeta.countLabel}
                      pageIndex={pageIndex}
                      pageCount={pageCount}
                      onPageChange={setPageIndex}
                    />
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <MobileFilterSheet
        open={filtersOpen}
        onClose={closeFilters}
        title="Filtros del reporte"
      >
        {reportesFiltersPanel}
      </MobileFilterSheet>
      </>
      )}
    </div>
  );
}
