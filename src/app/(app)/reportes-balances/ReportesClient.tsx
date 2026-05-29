'use client';

import { useState, useEffect, useMemo, useTransition } from 'react';
import type { FilterOptions, ReportModule, DateRange } from '@/lib/reports/report-types';
import {
  fetchProduccionReport,
  fetchNominaReport,
  fetchVoladurasReport,
  fetchQuemadoReport,
  fetchExtraccionReport,
  fetchGastosReport,
  fetchBalanceReport,
} from '@/lib/actions/report-actions';
import {
  aggregateProduccion,
  aggregateNomina,
  aggregateVoladuras,
  aggregateQuemado,
  aggregateExtraccion,
  aggregateGastos,
  aggregateBalance,
} from '@/lib/reports/report-engine';
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
import { format, subDays } from 'date-fns';
import { ReportesTabs } from '@/components/reportes/ReportesTabs';
import { ReconciliacionPanel } from '@/components/reportes/ReconciliacionPanel';
import { reportesUi as ui } from '@/components/reportes/reportes-ui';
import {
  fetchBalanceReportAggregated,
  type BalanceReportPayload,
} from '@/lib/actions/reconciliation-actions';
import { cn } from '@/lib/utils';

interface ReportesClientProps {
  initialOptions: FilterOptions;
}

export default function ReportesClient({ initialOptions }: ReportesClientProps) {
  const [activeTab, setActiveTab] = useState<ReportModule>('reconciliacion');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

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
  const [groupByQuem, setGroupByQuem] = useState<'dia' | 'semana' | 'mes'>('dia');

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

  // Balance General
  const [groupByBal, setGroupByBal] = useState<'semana' | 'mes'>('semana');
  const [balancePayload, setBalancePayload] = useState<BalanceReportPayload | null>(null);

  // ── 3. Data States ────────────────────────────────────────
  const [rawData, setRawData] = useState<any>(null);

  // Limpiar datos al cambiar de pestaña para evitar agregaciones incorrectas de datos obsoletos
  useEffect(() => {
    setRawData(null);
    setBalancePayload(null);
  }, [activeTab]);

  // ── 4. Trigger Data Fetching on filter changes ──────────
  useEffect(() => {
    if (activeTab === 'reconciliacion') return;
    setError(null);
    startTransition(async () => {
      try {
        let fetched: any = null;
        if (activeTab === 'produccion') {
          fetched = await fetchProduccionReport({
            dateRange,
            molinos: selectedMolinos,
            materiales: selectedMateriales,
            turnos: selectedTurnosProd as any,
          });
        } else if (activeTab === 'nomina') {
          fetched = await fetchNominaReport({
            dateRange,
            areas: selectedAreasNom as any,
            cargos: selectedCargosNom,
            personalId: selectedWorkerId,
          });
        } else if (activeTab === 'voladuras') {
          fetched = await fetchVoladurasReport({
            dateRange,
            minas: selectedMinasVol,
            verticales: selectedVerticalesVol,
            turnos: selectedTurnosVol as any,
          });
        } else if (activeTab === 'quemado') {
          fetched = await fetchQuemadoReport({
            dateRange,
            turnos: selectedTurnosQuem as any,
          });
        } else if (activeTab === 'extraccion') {
          fetched = await fetchExtraccionReport({
            dateRange,
            minas: selectedMinasExt,
            verticales: selectedVerticalesExt,
            turnos: selectedTurnosExt as any,
          });
        } else if (activeTab === 'gastos') {
          fetched = await fetchGastosReport({
            dateRange,
            categorias: selectedCategoriasGst,
            tipos: selectedTiposGst as any,
            proveedor: searchProveedor,
          });
        } else if (activeTab === 'balance') {
          const payload = await fetchBalanceReportAggregated(dateRange, groupByBal);
          setBalancePayload(payload);
          setRawData({ ok: true });
          return;
        }
        setRawData(fetched);
      } catch (err: any) {
        console.error('Error fetching report data:', err);
        setError('No se pudieron obtener los datos filtrados de la base de datos.');
      }
    });
  }, [
    activeTab,
    dateRange,
    // Producción dependency array
    selectedMolinos,
    selectedMateriales,
    selectedTurnosProd,
    // Nómina dependency array
    selectedAreasNom,
    selectedCargosNom,
    selectedWorkerId,
    // Voladuras dependency array
    selectedMinasVol,
    selectedVerticalesVol,
    selectedTurnosVol,
    // Quemado dependency array
    selectedTurnosQuem,
    // Extracción dependency array
    selectedMinasExt,
    selectedVerticalesExt,
    selectedTurnosExt,
    // Gastos dependency array
    selectedCategoriasGst,
    selectedTiposGst,
    searchProveedor,
    groupByBal,
  ]);

  // ── 5. Run Aggregation logic via Engine ──────────────────
  const aggregated = useMemo<any>(() => {
    if (!rawData || error) return null;

    if (activeTab === 'produccion' && Array.isArray(rawData)) {
      return aggregateProduccion(rawData, groupByProd);
    } else if (activeTab === 'nomina' && Array.isArray(rawData)) {
      return aggregateNomina(rawData, groupByNom);
    } else if (activeTab === 'voladuras' && Array.isArray(rawData)) {
      return aggregateVoladuras(rawData, groupByVol);
    } else if (activeTab === 'quemado' && Array.isArray(rawData)) {
      return aggregateQuemado(rawData, groupByQuem);
    } else if (activeTab === 'extraccion' && Array.isArray(rawData)) {
      return aggregateExtraccion(rawData, groupByExt);
    } else if (activeTab === 'gastos' && Array.isArray(rawData)) {
      return aggregateGastos(rawData, groupByGst);
    } else if (activeTab === 'balance' && !Array.isArray(rawData) && rawData.produccion) {
      return aggregateBalance(rawData, groupByBal, goldPriceInput);
    }
    return null;
  }, [rawData, activeTab, groupByProd, groupByNom, groupByVol, groupByQuem, groupByExt, groupByGst, groupByBal, goldPriceInput, error]);

  // ── 6. Download Handlers ──────────────────────────────────
  const handleDownloadPDF = () => {
    if (!aggregated) return;
    const groupOpt =
      activeTab === 'produccion' ? groupByProd :
      activeTab === 'nomina' ? groupByNom :
      activeTab === 'voladuras' ? groupByVol :
      activeTab === 'quemado' ? groupByQuem :
      activeTab === 'extraccion' ? groupByExt :
      activeTab === 'gastos' ? groupByGst : groupByBal;
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
      activeTab === 'gastos' ? groupByGst : groupByBal;
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

  return (
    <div className="space-y-6">
      <ReportesTabs
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          setError(null);
        }}
      />

      {activeTab === 'reconciliacion' ? (
        <ReconciliacionPanel />
      ) : (
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* LEFT COLUMN: FILTERS (Glassmorphic Card) */}
        <div className={ui.sidebar}>
          <h3 className={ui.sectionTitle}>Rango de fechas</h3>
          <div className="space-y-2">
            <div className="flex flex-col gap-1">
              <label className={ui.fieldLabel}>Desde</label>
              <input
                type="date"
                value={dateRange.from}
                onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
                className={ui.input}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className={ui.fieldLabel}>Hasta</label>
              <input
                type="date"
                value={dateRange.to}
                onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
                className={ui.input}
              />
            </div>
          </div>

          <div className="border-t border-white/5 pt-4 space-y-4">
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
                            ? 'bg-zinc-800/70 text-zinc-200 border-zinc-500/40'
                            : 'bg-transparent text-zinc-500 border-white/5 hover:border-white/10 hover:text-zinc-400'
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
                            ? 'bg-zinc-800/70 text-zinc-200 border-zinc-500/40'
                            : 'bg-transparent text-zinc-500 border-white/5 hover:border-white/10 hover:text-zinc-400'
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
                            ? 'bg-zinc-800/70 text-zinc-200 border-zinc-500/40'
                            : 'bg-transparent text-zinc-500 border-white/5 hover:border-white/10 hover:text-zinc-400'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Agrupar */}
                <div className="flex flex-col gap-1.5 pt-2 border-t border-white/5">
                  <label className={ui.fieldLabel}>Agrupar Datos por</label>
                  <select
                    value={groupByProd}
                    onChange={(e) => setGroupByProd(e.target.value as any)}
                    className="w-full rounded-lg border border-white/5 bg-zinc-900/40 px-2.5 py-1.5 text-sm text-white outline-none focus:border-zinc-500/40 focus:ring-1 focus:ring-zinc-500/15"
                  >
                    <option value="dia">Por Día</option>
                    <option value="semana">Por Semana</option>
                    <option value="mes">Por Mes</option>
                    <option value="molino">Por Molino</option>
                    <option value="material">Por Material</option>
                  </select>
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
                            ? 'bg-zinc-800/70 text-zinc-200 border-zinc-500/40'
                            : 'bg-transparent text-zinc-500 border-white/5 hover:border-white/10 hover:text-zinc-400'
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
                  <div className="flex flex-wrap gap-1 max-h-[120px] overflow-y-auto pr-1">
                    {initialOptions.nomina.cargos.map((cg) => (
                      <button
                        key={cg}
                        type="button"
                        onClick={() => toggleOption(selectedCargosNom, setSelectedCargosNom, cg)}
                        className={`px-2 py-0.5 text-[10px] rounded-md border transition-all duration-150 ${
                          selectedCargosNom.includes(cg)
                            ? 'bg-zinc-800/70 text-zinc-200 border-zinc-500/40'
                            : 'bg-transparent text-zinc-500 border-white/5 hover:border-white/10 hover:text-zinc-400'
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
                  <select
                    value={selectedWorkerId}
                    onChange={(e) => setSelectedWorkerId(e.target.value)}
                    className="w-full rounded-lg border border-white/5 bg-zinc-900/40 px-2.5 py-1.5 text-sm text-white outline-none focus:border-zinc-500/40 focus:ring-1 focus:ring-zinc-500/15"
                  >
                    <option value="">-- Todos los Trabajadores --</option>
                    {initialOptions.nomina.personal.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre_completo} ({p.cedula})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Agrupar */}
                <div className="flex flex-col gap-1.5 pt-2 border-t border-white/5">
                  <label className={ui.fieldLabel}>Agrupar Nómina por</label>
                  <select
                    value={groupByNom}
                    onChange={(e) => setGroupByNom(e.target.value as any)}
                    className="w-full rounded-lg border border-white/5 bg-zinc-900/40 px-2.5 py-1.5 text-sm text-white outline-none focus:border-zinc-500/40 focus:ring-1 focus:ring-zinc-500/15"
                  >
                    <option value="semana">Por Semana</option>
                    <option value="mes">Por Mes</option>
                    <option value="area">Por Área Operativa</option>
                    <option value="cargo">Por Cargo de Personal</option>
                    <option value="trabajador">Por Trabajador</option>
                  </select>
                </div>
              </div>
            )}

            {activeTab === 'voladuras' && (
              <div className="space-y-3">
                {/* Minas */}
                <div className="space-y-1.5">
                  <label className={ui.fieldLabel}>Zonas de Mina</label>
                  <div className="flex flex-wrap gap-1">
                    {initialOptions.voladuras.minas.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => toggleOption(selectedMinasVol, setSelectedMinasVol, m)}
                        className={`px-2.5 py-1 text-[11px] font-medium rounded-full border transition-all duration-150 ${
                          selectedMinasVol.includes(m)
                            ? 'bg-zinc-800/70 text-zinc-200 border-zinc-500/40'
                            : 'bg-transparent text-zinc-500 border-white/5 hover:border-white/10 hover:text-zinc-400'
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
                    {initialOptions.voladuras.verticales.map((vt) => (
                      <button
                        key={vt}
                        type="button"
                        onClick={() => toggleOption(selectedVerticalesVol, setSelectedVerticalesVol, vt)}
                        className={`px-2 py-0.5 text-[11px] rounded-md border transition-all duration-150 ${
                          selectedVerticalesVol.includes(vt)
                            ? 'bg-zinc-800/70 text-zinc-200 border-zinc-500/40'
                            : 'bg-transparent text-zinc-500 border-white/5 hover:border-white/10 hover:text-zinc-400'
                        }`}
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
                            ? 'bg-zinc-800/70 text-zinc-200 border-zinc-500/40'
                            : 'bg-transparent text-zinc-500 border-white/5 hover:border-white/10 hover:text-zinc-400'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Agrupar */}
                <div className="flex flex-col gap-1.5 pt-2 border-t border-white/5">
                  <label className={ui.fieldLabel}>Agrupar Voladuras por</label>
                  <select
                    value={groupByVol}
                    onChange={(e) => setGroupByVol(e.target.value as any)}
                    className="w-full rounded-lg border border-white/5 bg-zinc-900/40 px-2.5 py-1.5 text-sm text-white outline-none focus:border-zinc-500/40 focus:ring-1 focus:ring-zinc-500/15"
                  >
                    <option value="dia">Por Día</option>
                    <option value="semana">Por Semana</option>
                    <option value="mina">Por Mina</option>
                  </select>
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
                            ? 'bg-zinc-800/70 text-zinc-200 border-zinc-500/40'
                            : 'bg-transparent text-zinc-500 border-white/5 hover:border-white/10 hover:text-zinc-400'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Agrupar */}
                <div className="flex flex-col gap-1.5 pt-2 border-t border-white/5">
                  <label className={ui.fieldLabel}>Agrupar por</label>
                  <select
                    value={groupByQuem}
                    onChange={(e) => setGroupByQuem(e.target.value as any)}
                    className="w-full rounded-lg border border-white/5 bg-zinc-900/40 px-2.5 py-1.5 text-sm text-white outline-none focus:border-zinc-500/40 focus:ring-1 focus:ring-zinc-500/15"
                  >
                    <option value="dia">Por Día</option>
                    <option value="semana">Por Semana</option>
                    <option value="mes">Por Mes</option>
                  </select>
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
                            ? 'bg-zinc-800/70 text-zinc-200 border-zinc-500/40'
                            : 'bg-transparent text-zinc-500 border-white/5 hover:border-white/10 hover:text-zinc-400'
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
                            ? 'bg-zinc-800/70 text-zinc-200 border-zinc-500/40'
                            : 'bg-transparent text-zinc-500 border-white/5 hover:border-white/10 hover:text-zinc-400'
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
                            ? 'bg-zinc-800/70 text-zinc-200 border-zinc-500/40'
                            : 'bg-transparent text-zinc-500 border-white/5 hover:border-white/10 hover:text-zinc-400'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Agrupar */}
                <div className="flex flex-col gap-1.5 pt-2 border-t border-white/5">
                  <label className={ui.fieldLabel}>Agrupar por</label>
                  <select
                    value={groupByExt}
                    onChange={(e) => setGroupByExt(e.target.value as any)}
                    className="w-full rounded-lg border border-white/5 bg-zinc-900/40 px-2.5 py-1.5 text-sm text-white outline-none focus:border-zinc-500/40 focus:ring-1 focus:ring-zinc-500/15"
                  >
                    <option value="dia">Por Día</option>
                    <option value="semana">Por Semana</option>
                    <option value="mina">Por Mina</option>
                  </select>
                </div>
              </div>
            )}

            {activeTab === 'gastos' && (
              <div className="space-y-3">
                {/* Categorías */}
                <div className="space-y-1.5">
                  <label className={ui.fieldLabel}>Categorías de Gastos</label>
                  <div className="flex flex-wrap gap-1 max-h-[140px] overflow-y-auto pr-1">
                    {initialOptions.gastos.categorias.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleOption(selectedCategoriasGst, setSelectedCategoriasGst, c.id)}
                        className={`px-2 py-0.5 text-[10px] rounded-md border transition-all duration-150 ${
                          selectedCategoriasGst.includes(c.id)
                            ? 'bg-zinc-800/70 text-zinc-200 border-zinc-500/40'
                            : 'bg-transparent text-zinc-500 border-white/5 hover:border-white/10 hover:text-zinc-400'
                        }`}
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
                            ? 'bg-zinc-800/70 text-zinc-200 border-zinc-500/40'
                            : 'bg-transparent text-zinc-500 border-white/5 hover:border-white/10 hover:text-zinc-400'
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
                <div className="flex flex-col gap-1.5 pt-2 border-t border-white/5">
                  <label className={ui.fieldLabel}>Agrupar por</label>
                  <select
                    value={groupByGst}
                    onChange={(e) => setGroupByGst(e.target.value as any)}
                    className="w-full rounded-lg border border-white/5 bg-zinc-900/40 px-2.5 py-1.5 text-sm text-white outline-none focus:border-zinc-500/40 focus:ring-1 focus:ring-zinc-500/15"
                  >
                    <option value="dia">Por Día</option>
                    <option value="semana">Por Semana</option>
                    <option value="mes">Por Mes</option>
                    <option value="categoria">Por Categoría</option>
                  </select>
                </div>
              </div>
            )}

            {activeTab === 'balance' && (
              <div className="space-y-3">
                {/* Gold Price parameter */}
                <div className="flex flex-col gap-1.5">
                  <label className={cn(ui.fieldLabel, 'flex items-center gap-1')}>
                    Precio oro (USD/g)
                    <span title="Se usa para estimar ingresos brutos basados en gramos de oro puro recuperado.">
                      <HelpCircle className="w-3 h-3 text-zinc-500 hover:text-zinc-300 cursor-pointer" />
                    </span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-sm text-zinc-500">$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={goldPriceInput}
                      onChange={(e) => setGoldPriceInput(parseFloat(e.target.value) || 0)}
                      className="w-full rounded-lg border border-white/5 bg-zinc-900/40 pl-7 pr-2.5 py-1.5 text-sm text-white outline-none focus:border-zinc-500/40 focus:ring-1 focus:ring-zinc-500/15"
                    />
                  </div>
                </div>

                {/* Agrupar */}
                <div className="flex flex-col gap-1.5 pt-2 border-t border-white/5">
                  <label className={ui.fieldLabel}>Agrupar Balance por</label>
                  <select
                    value={groupByBal}
                    onChange={(e) => setGroupByBal(e.target.value as any)}
                    className="w-full rounded-lg border border-white/5 bg-zinc-900/40 px-2.5 py-1.5 text-sm text-white outline-none focus:border-zinc-500/40 focus:ring-1 focus:ring-zinc-500/15"
                  >
                    <option value="semana">Por Semana</option>
                    <option value="mes">Por Mes</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: PREVIEW & DOWNLOADS */}
        <div className="lg:col-span-3 space-y-6">
          {/* PREVIEW CONTAINER */}
          <div className={ui.previewPanel}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className={cn(ui.previewTitle, 'flex items-center gap-2')}>
                Vista previa
                {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400" />}
              </h2>
              {aggregated && aggregated.rows.length > 0 && (
                <div className="flex gap-2">
                  <button type="button" onClick={handleDownloadPDF} className={ui.btnExport}>
                    <FileText className="w-3.5 h-3.5" />
                    PDF
                  </button>
                  <button type="button" onClick={handleDownloadCSV} className={ui.btnExport}>
                    <FileSpreadsheet className="w-3.5 h-3.5" />
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
                <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
                <p className="text-sm text-zinc-500">Cargando datos…</p>
              </div>
            )}

            {/* NO DATA STATE */}
            {!isPending && (!aggregated || aggregated.rows.length === 0) && !error && (
              <div className={ui.emptyState}>
                <HelpCircle className="h-8 w-8 text-zinc-600" />
                <p className="text-sm font-medium text-zinc-400">No se encontraron registros</p>
                <p className="text-xs text-zinc-600 text-center max-w-[280px]">
                  Prueba ampliando el rango de fechas o seleccionando menos filtros dinámicos.
                </p>
              </div>
            )}

            {/* DATA RENDER: KPIs + TABLE */}
            {aggregated && aggregated.rows.length > 0 && !error && (
              <div className="space-y-6">
                {/* 1. KPIs Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {activeTab === 'produccion' && (
                    <>
                      <div className="rounded-lg border border-white/5 bg-zinc-900/30 px-3 py-2.5">
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">Oro Recuperado</p>
                        <p className="mt-0.5 text-base font-semibold tabular-nums text-zinc-100">{aggregated.kpis.oroTotalGrams.toLocaleString()} g</p>
                      </div>
                      <div className="rounded-lg border border-white/5 bg-zinc-900/30 px-3 py-2.5">
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">Sacos Vaciados</p>
                        <p className="mt-0.5 text-base font-semibold tabular-nums text-zinc-300">{aggregated.kpis.sacosTotal.toLocaleString()}</p>
                      </div>
                      <div className="rounded-lg border border-white/5 bg-zinc-900/30 px-3 py-2.5">
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">Toneladas</p>
                        <p className="mt-0.5 text-base font-semibold tabular-nums text-zinc-300">{aggregated.kpis.toneladasTotal.toLocaleString()} t</p>
                      </div>
                      <div className="rounded-lg border border-white/5 bg-zinc-900/30 px-3 py-2.5">
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">Tenor Promedio</p>
                        <p className="mt-0.5 text-base font-semibold tabular-nums text-zinc-100">{aggregated.kpis.tenorPromedioGpt.toFixed(2)} g/t</p>
                      </div>
                    </>
                  )}

                  {activeTab === 'nomina' && (
                    <>
                      <div className="rounded-lg border border-white/5 bg-zinc-900/30 px-3 py-2.5">
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">Total Nómina</p>
                        <p className="mt-0.5 text-base font-semibold tabular-nums text-zinc-100">${aggregated.kpis.totalPagado.toLocaleString()}</p>
                      </div>
                      <div className="rounded-lg border border-white/5 bg-zinc-900/30 px-3 py-2.5">
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">Bono Transporte</p>
                        <p className="mt-0.5 text-base font-semibold tabular-nums text-zinc-300">${aggregated.kpis.bonoTransporteTotal.toLocaleString()}</p>
                      </div>
                      <div className="rounded-lg border border-white/5 bg-zinc-900/30 px-3 py-2.5">
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">Trabajadores</p>
                        <p className="mt-0.5 text-base font-semibold tabular-nums text-zinc-300">{aggregated.kpis.trabajadoresUnicos}</p>
                      </div>
                      <div className="rounded-lg border border-white/5 bg-zinc-900/30 px-3 py-2.5">
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">Split Pedro/Dar/LaFe</p>
                        <p className="text-[11px] font-bold mt-1">
                          ${aggregated.kpis.pedroTotal.toLocaleString()} / ${aggregated.kpis.darinelTotal.toLocaleString()} / ${aggregated.kpis.laFeTotal.toLocaleString()}
                        </p>
                      </div>
                    </>
                  )}

                  {activeTab === 'voladuras' && (
                    <>
                      <div className="rounded-lg border border-white/5 bg-zinc-900/30 px-3 py-2.5">
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">Nro. Disparos</p>
                        <p className="mt-0.5 text-base font-semibold tabular-nums text-zinc-100">{aggregated.kpis.disparosCount}</p>
                      </div>
                      <div className="rounded-lg border border-white/5 bg-zinc-900/30 px-3 py-2.5">
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">Huecos</p>
                        <p className="mt-0.5 text-base font-semibold tabular-nums text-zinc-300">{aggregated.kpis.huecosTotal.toLocaleString()}</p>
                      </div>
                      <div className="rounded-lg border border-white/5 bg-zinc-900/30 px-3 py-2.5">
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">Chupis</p>
                        <p className="mt-0.5 text-base font-semibold tabular-nums text-zinc-300">{aggregated.kpis.chupisTotal.toLocaleString()}</p>
                      </div>
                      <div className="rounded-lg border border-white/5 bg-zinc-900/30 px-3 py-2.5">
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">Consumo Arroz</p>
                        <p className="mt-0.5 text-base font-semibold tabular-nums text-zinc-100">{aggregated.kpis.arrozKgTotal.toLocaleString()} kg</p>
                      </div>
                    </>
                  )}

                  {activeTab === 'quemado' && (
                    <>
                      <div className="rounded-lg border border-white/5 bg-zinc-900/30 px-3 py-2.5">
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">Total Amalgama</p>
                        <p className="mt-0.5 text-base font-semibold tabular-nums text-zinc-300">{aggregated.kpis.amalgamaTotalG.toLocaleString()} g</p>
                      </div>
                      <div className="rounded-lg border border-white/5 bg-zinc-900/30 px-3 py-2.5">
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">Oro Puro</p>
                        <p className="mt-0.5 text-base font-semibold tabular-nums text-zinc-100">{aggregated.kpis.oroTotalG.toLocaleString()} g</p>
                      </div>
                      <div className="rounded-lg border border-white/5 bg-zinc-900/30 px-3 py-2.5">
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">Rendimiento</p>
                        <p className="mt-0.5 text-base font-semibold tabular-nums text-zinc-100">{aggregated.kpis.rendimientoOroPct.toFixed(2)}%</p>
                      </div>
                      <div className="rounded-lg border border-white/5 bg-zinc-900/30 px-3 py-2.5">
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">Manto / Retorta</p>
                        <p className="text-xs font-bold text-zinc-300 mt-2">
                          M:{aggregated.kpis.mantoOroTotalG.toFixed(0)}g | R:{aggregated.kpis.retortaOroTotalG.toFixed(0)}g
                        </p>
                      </div>
                    </>
                  )}

                  {activeTab === 'extraccion' && (
                    <>
                      <div className="rounded-lg border border-white/5 bg-zinc-900/30 px-3 py-2.5">
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">Reportes</p>
                        <p className="mt-0.5 text-base font-semibold tabular-nums text-zinc-300">{aggregated.kpis.reportesCount}</p>
                      </div>
                      <div className="rounded-lg border border-white/5 bg-zinc-900/30 px-3 py-2.5">
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">Sacos Extraídos</p>
                        <p className="mt-0.5 text-base font-semibold tabular-nums text-zinc-100">{aggregated.kpis.sacosTotal.toLocaleString()}</p>
                      </div>
                      <div className="rounded-lg border border-white/5 bg-zinc-900/30 px-3 py-2.5">
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">Eventos / Novedades</p>
                        <p className="mt-0.5 text-base font-semibold tabular-nums text-zinc-300">{aggregated.kpis.eventosTotal}</p>
                      </div>
                      <div className="rounded-lg border border-white/5 bg-zinc-900/30 px-3 py-2.5">
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">Promedio/Reporte</p>
                        <p className="mt-0.5 text-base font-semibold tabular-nums text-zinc-100">
                          {aggregated.kpis.reportesCount > 0 ? (aggregated.kpis.sacosTotal / aggregated.kpis.reportesCount).toFixed(0) : '0'}
                        </p>
                      </div>
                    </>
                  )}

                  {activeTab === 'gastos' && (
                    <>
                      <div className="rounded-lg border border-white/5 bg-zinc-900/30 px-3 py-2.5">
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">Total Gastado</p>
                        <p className="mt-0.5 text-base font-semibold tabular-nums text-zinc-300">${aggregated.kpis.totalGastado.toLocaleString()}</p>
                      </div>
                      <div className="rounded-lg border border-white/5 bg-zinc-900/30 px-3 py-2.5">
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">Gasto Promedio</p>
                        <p className="mt-0.5 text-base font-semibold tabular-nums text-zinc-300">${aggregated.kpis.promedioGasto.toLocaleString()}</p>
                      </div>
                      <div className="rounded-lg border border-white/5 bg-zinc-900/30 px-3 py-2.5">
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">Nro. Transacciones</p>
                        <p className="mt-0.5 text-base font-semibold tabular-nums text-zinc-300">{aggregated.kpis.registrosCount}</p>
                      </div>
                      <div className="rounded-lg border border-white/5 bg-zinc-900/30 px-3 py-2.5">
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">Mayor Gasto Único</p>
                        <p className={cn(ui.kpiValueSmall, 'truncate')} title={aggregated.kpis.mayorGastoDesc}>
                          ${aggregated.kpis.mayorGastoMonto.toLocaleString()}
                        </p>
                      </div>
                    </>
                  )}

                  {activeTab === 'balance' && (
                    <>
                      <div className="rounded-lg border border-white/5 bg-zinc-900/30 px-3 py-2.5">
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">Ingreso Total</p>
                        <p className={ui.kpiValueAccent}>${aggregated.kpis.ingresoTotalUsd.toLocaleString()}</p>
                      </div>
                      <div className="rounded-lg border border-white/5 bg-zinc-900/30 px-3 py-2.5">
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">Gasto Total</p>
                        <p className="mt-0.5 text-base font-semibold tabular-nums text-zinc-300">${aggregated.kpis.gastoTotalUsd.toLocaleString()}</p>
                      </div>
                      <div className="rounded-lg border border-white/5 bg-zinc-900/30 px-3 py-2.5">
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">Utilidad Neta</p>
                        <p className="mt-0.5 text-base font-semibold tabular-nums text-zinc-100">${aggregated.kpis.rentabilidadUsd.toLocaleString()}</p>
                      </div>
                      <div className="rounded-lg border border-white/5 bg-zinc-900/30 px-3 py-2.5">
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">Margen % / Costo g</p>
                        <p className={ui.kpiValueSmall}>
                          {aggregated.kpis.margenRentabilidadPct.toFixed(1)}% · ${aggregated.kpis.costoPorGramoOro.toFixed(0)}/g
                        </p>
                      </div>
                    </>
                  )}
                </div>

                {/* 2. Table Preview */}
                <div className={ui.tableWrap}>
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className={ui.tableHead}>
                        <th className="p-2.5">Grupo / Periodo</th>
                        {activeTab === 'produccion' && (
                          <>
                            <th className="p-2.5 text-right">Sacos</th>
                            <th className="p-2.5 text-right">Toneladas</th>
                            <th className="p-2.5 text-right">Oro (g)</th>
                            <th className="p-2.5 text-right">Tenor (g/t)</th>
                            <th className="p-2.5 text-right">Merma %</th>
                          </>
                        )}
                        {activeTab === 'nomina' && (
                          <>
                            <th className="p-2.5 text-right">Cant. Personal</th>
                            <th className="p-2.5 text-right">Pago Nómina</th>
                            <th className="p-2.5 text-right">Bono Transporte</th>
                            <th className="p-2.5 text-right">Pedro</th>
                            <th className="p-2.5 text-right">Darinel</th>
                            <th className="p-2.5 text-right">La Fe</th>
                          </>
                        )}
                        {activeTab === 'voladuras' && (
                          <>
                            <th className="p-2.5 text-right">Disparos</th>
                            <th className="p-2.5 text-right">Huecos</th>
                            <th className="p-2.5 text-right">Pies Huecos</th>
                            <th className="p-2.5 text-right">Chupis</th>
                            <th className="p-2.5 text-right">Arroz (kg)</th>
                            <th className="p-2.5 text-right">Ratio H/C</th>
                          </>
                        )}
                        {activeTab === 'quemado' && (
                          <>
                            <th className="p-2.5 text-right">Procesos</th>
                            <th className="p-2.5 text-right">Amalgama (g)</th>
                            <th className="p-2.5 text-right">Oro Puro (g)</th>
                            <th className="p-2.5 text-right">Rendimiento %</th>
                            <th className="p-2.5 text-right">Nro Planchas</th>
                          </>
                        )}
                        {activeTab === 'extraccion' && (
                          <>
                            <th className="p-2.5 text-right">Reportes</th>
                            <th className="p-2.5 text-right">Sacos Extraídos</th>
                            <th className="p-2.5 text-right">Cant. Eventos</th>
                          </>
                        )}
                        {activeTab === 'gastos' && (
                          <>
                            <th className="p-2.5 text-right">Total Gastado</th>
                            <th className="p-2.5 text-right">Gasto Promedio</th>
                            <th className="p-2.5 text-right text-red-300">Gasto Mayor</th>
                            <th className="p-2.5 text-right">Transacciones</th>
                          </>
                        )}
                        {activeTab === 'balance' && (
                          <>
                            <th className="p-2.5 text-right">Ingresos Oro</th>
                            <th className="p-2.5 text-right">Ingresos Arenas</th>
                            <th className="p-2.5 text-right">Ingresos Total</th>
                            <th className="p-2.5 text-right">Gasto Nómina</th>
                            <th className="p-2.5 text-right">Gastos Ops</th>
                            <th className="p-2.5 text-right">Utilidad Neta</th>
                            <th className="p-2.5 text-right">Margen %</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className={ui.tableBody}>
                      {aggregated.rows.slice(0, 15).map((row: any, idx: number) => (
                        <tr key={idx} className={ui.tableRow}>
                          <td className="p-2.5 font-medium text-zinc-200">{row.grupo}</td>
                          
                          {activeTab === 'produccion' && (
                            <>
                              <td className="p-2.5 text-right">{row.sacos.toLocaleString()}</td>
                              <td className="p-2.5 text-right">{row.toneladas.toLocaleString()} t</td>
                              <td className="p-2.5 text-right font-semibold">{row.oroGramos.toLocaleString()} g</td>
                              <td className="p-2.5 text-right">{row.tenorGpt.toFixed(2)} g/t</td>
                              <td className="p-2.5 text-right text-zinc-400">{row.mermaPct.toFixed(2)}%</td>
                            </>
                          )}

                          {activeTab === 'nomina' && (
                            <>
                              <td className="p-2.5 text-right">{row.trabajadoresCount}</td>
                              <td className="p-2.5 text-right font-semibold">${row.montoPagado.toLocaleString()}</td>
                              <td className="p-2.5 text-right">${row.bonoTransporte.toLocaleString()}</td>
                              <td className="p-2.5 text-right">${row.montoPedro.toLocaleString()}</td>
                              <td className="p-2.5 text-right">${row.montoDarinel.toLocaleString()}</td>
                              <td className="p-2.5 text-right">${row.montoLaFe.toLocaleString()}</td>
                            </>
                          )}

                          {activeTab === 'voladuras' && (
                            <>
                              <td className="p-2.5 text-right">{row.disparos}</td>
                              <td className="p-2.5 text-right">{row.huecos.toLocaleString()}</td>
                              <td className="p-2.5 text-right">{row.huecosPies.toLocaleString()} ft</td>
                              <td className="p-2.5 text-right">{row.chupis.toLocaleString()}</td>
                              <td className="p-2.5 text-right">{row.arrozKg.toLocaleString()} kg</td>
                              <td className="p-2.5 text-right font-semibold">{row.ratioHC.toFixed(2)}</td>
                            </>
                          )}

                          {activeTab === 'quemado' && (
                            <>
                              <td className="p-2.5 text-right">{row.quemadas}</td>
                              <td className="p-2.5 text-right">{row.amalgamaG.toLocaleString()} g</td>
                              <td className="p-2.5 text-right font-semibold">{row.oroG.toLocaleString()} g</td>
                              <td className="p-2.5 text-right">{row.rendimientoPct.toFixed(2)}%</td>
                              <td className="p-2.5 text-right">{row.planchasCount}</td>
                            </>
                          )}

                          {activeTab === 'extraccion' && (
                            <>
                              <td className="p-2.5 text-right">{row.reportes}</td>
                              <td className="p-2.5 text-right font-semibold">{row.sacos.toLocaleString()} sacos</td>
                              <td className="p-2.5 text-right">{row.eventos}</td>
                            </>
                          )}

                          {activeTab === 'gastos' && (
                            <>
                              <td className="p-2.5 text-right font-semibold">${row.monto.toLocaleString()}</td>
                              <td className="p-2.5 text-right">${row.gastoPromedio.toLocaleString()}</td>
                              <td className="p-2.5 text-right text-red-300">${row.gastoMayor.toLocaleString()}</td>
                              <td className="p-2.5 text-right">{row.registrosCount}</td>
                            </>
                          )}

                          {activeTab === 'balance' && (
                            <>
                              <td className="p-2.5 text-right">${row.ingresosOro.toLocaleString()}</td>
                              <td className="p-2.5 text-right">${row.ingresosArenas.toLocaleString()}</td>
                              <td className="p-2.5 text-right font-semibold">${row.ingresosTotal.toLocaleString()}</td>
                              <td className="p-2.5 text-right">${row.gastosNomina.toLocaleString()}</td>
                              <td className="p-2.5 text-right">${row.gastosOperativos.toLocaleString()}</td>
                              <td className="p-2.5 text-right font-semibold">${row.rentabilidad.toLocaleString()}</td>
                              <td className="p-2.5 text-right font-medium">{row.margenPct.toFixed(1)}%</td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination indicator / preview notice */}
                {aggregated.rows.length > 15 && (
                  <p className="text-[11px] text-zinc-500 text-center italic">
                    Mostrando las primeras 15 agrupaciones. Descarga el reporte completo en PDF o CSV para ver las {aggregated.rows.length} filas totales.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
