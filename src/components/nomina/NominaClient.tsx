'use client';

import { useState, useTransition, useMemo, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useCanEdit } from '@/lib/use-can-edit';
import { 
  Pickaxe, Upload, RefreshCw, Plus, Trash2, Loader2, Calendar, 
  Clock, ChevronDown, ChevronUp, CheckCircle2, AlertTriangle, 
  Search, Factory, Shield, Truck, Briefcase, Edit2, Receipt, 
  Printer, X, Users, Wallet, ChevronRight, FileText, Download,
  TrendingUp, TrendingDown, RotateCcw, Clipboard,
  Hammer, Umbrella, XCircle, Copy, Check, Lock, FileSpreadsheet, Archive
} from 'lucide-react';
import { toast } from 'sonner';
import { toastError } from '@/lib/app-toast';
import { useConfirm } from '@/components/ui/ConfirmDialogProvider';

import {
  ASIGNACION_NOMINA_OPCIONES,
  getGrupoNominaKey,
  isAsignacionNominaValid,
} from '@/lib/personal-master';
import { PersonalQuickAssignModal } from '@/components/nomina/PersonalQuickAssignModal';
import NominaNovedadTurnoCell from '@/components/nomina/NominaNovedadTurnoCell';
import NominaTrabajadorModal from '@/components/nomina/NominaTrabajadorModal';
import NominaCiclosTable from '@/components/nomina/NominaCiclosTable';
import { NominaVistaPreviaModal } from '@/components/nomina/NominaVistaPreviaModal';
import type { NominaPreviewRange } from '@/components/nomina/NominaVistaPreviaContent';
import type { NominaImportResult } from '@/components/nomina/NominaImportWizard';
import { NominaArchivoModal } from '@/components/nomina/NominaArchivoModal';
import { AppSelect } from '@/components/ui/AppSelect';
import {
  hasNovedadTurno,
  nominaNovedadDraftKey,
  NOVEDAD_TURNO_PREVIEW_LABEL,
  parseNovedadTurno,
  readNominaNovedadDraft,
  writeNominaNovedadDraft,
} from '@/lib/nomina-novedad-turno';
import { PageFormModal, PageFormModalFooter } from '@/components/ui/PageFormModal';
import { SheetIconBadge } from '@/components/mobile';
import NominaDistribucionPanel from '@/components/nomina/NominaDistribucionPanel';
import { useNominaDivisionesConfig } from '@/hooks/use-nomina-divisiones-config';
import { NominaImportModal } from '@/components/nomina/NominaImportModal';
import { resolveNominaTemporalContext, resolveWorkingWeek, formatTemporalContextHint } from '@/lib/nomina/temporal-context';
import { getWeekEnd, getWeekStart } from '@/lib/nomina/week-utils';
import { distribucionFromCierreLegacy } from '@/lib/nomina-distribucion';
import { calculateExpectedAttendance } from '@/lib/rotacion-personal';
import {
  calculateNominaRowPay,
  calculateWeeklyBaseRate,
  defaultDiasTrabajados,
  formatProportionalSalarioHint,
  NOMINA_DIAS_POR_SEMANA,
  resolveEstadoYDias,
  type EstadoAsistenciaNomina,
} from '@/lib/nomina-calculo';
import {
  diasTrabajadosPorDefectoCiclo,
  etiquetaEstadoRotacion,
  inputsDiasBloqueados,
  posicionEsquemaPersonal,
} from '@/lib/nomina/perfil-ciclo-reglas';
import { useBiblioteca } from '@/contexts/biblioteca-context';
import { buildPersonalSnapshot } from '@/lib/nomina/types';
import type { Personal, NominaSemana, NominaVale, HistorialPagoRow, TendenciaSemanalRow } from '@/lib/types';

import { 
  revertirSemanaAction,
  borrarTodoPersonalArea
} from '@/lib/actions/nomina';

import {
  updatePersonalEstatusAction,
  getSemanaRegistrosAction
} from '@/lib/actions/nomina-v2';

import {
  upsertPersonalV3Action,
  procesarCierreNominaV3Action,
  getValesPendientesBulkAction,
  crearValeAction,
  eliminarValeAction,
  getHistorialPagosAction,
  getTendenciaSemanalAction,
  getSemanaCierreAction,
  registrarAuditAction,
} from '@/lib/actions/nomina-v3';

import {
  NominaMobileDock,
  NominaMobileMoreSheet,
  NominaMobileSemanaSheet,
  NominaMobileStickyChrome,
  NominaMobileWorkerCard,
  type PreNominaRowState,
} from '@/components/nomina/nomina-mobile';

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, day] = iso.split('-');
  return `${day}/${m}/${y}`;
}

function fmtMoney(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

// ── Avatar Color Generator ─────────────────────────────────────────────────
const AVATAR_COLORS = [
  'bg-cyan-600', 'bg-amber-600', 'bg-emerald-600', 'bg-violet-600',
  'bg-pink-600', 'bg-blue-600', 'bg-yellow-600', 'bg-red-600',
  'bg-teal-600', 'bg-indigo-600', 'bg-orange-600', 'bg-lime-600',
];

function getAvatarColor(cargo: string): string {
  const c = (cargo || '').toUpperCase();
  if (c.includes('ADMIN')) return 'bg-rose-600 border border-rose-500/30';
  if (c.includes('MINA') || c.includes('MINER') || c.includes('PERFOR') || c.includes('PALA')) return 'bg-amber-600 border border-amber-500/30';
  if (c.includes('PLANT') || c.includes('MOLIN') || c.includes('OPERAD')) return 'bg-emerald-600 border border-emerald-500/30';
  if (c.includes('SEGURID') || c.includes('VIGILAN') || c.includes('SEREN')) return 'bg-blue-600 border border-blue-500/30';
  if (c.includes('MECANIC') || c.includes('ELECTRI') || c.includes('MANTEN')) return 'bg-violet-600 border border-violet-500/30';
  if (c.includes('CHOFER') || c.includes('TRANSPORT') || c.includes('VOLQUE')) return 'bg-pink-600 border border-pink-500/30';
  if (c.includes('COCIN') || c.includes('LIMPIEZ')) return 'bg-teal-600 border border-teal-500/30';
  
  let hash = 0;
  for (let i = 0; i < c.length; i++) {
    hash = c.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    'bg-cyan-600', 'bg-violet-600', 'bg-fuchsia-600', 'bg-indigo-600',
    'bg-rose-600', 'bg-sky-600', 'bg-purple-600', 'bg-slate-600'
  ];
  return colors[Math.abs(hash) % colors.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0]?.[0] || '?').toUpperCase();
}

function getMina3GState(rotacionInicio: string | undefined | null, weekStartStr: string): string | null {
  if (!rotacionInicio) return null;
  const startDate = new Date(rotacionInicio);
  const weekStart = new Date(weekStartStr);
  const diffMs = weekStart.getTime() - startDate.getTime();
  const diffWeeks = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));
  const position = ((diffWeeks % 3) + 3) % 3;
  if (position === 0) return 'Noche';
  if (position === 1) return 'Día';
  return 'Libre';
}

function getMolino15x15State(rotacionInicio: string | undefined | null, weekStartStr: string): string | null {
  if (!rotacionInicio) return null;
  const startDate = new Date(rotacionInicio);
  const weekStart = new Date(weekStartStr);
  const diffMs = weekStart.getTime() - startDate.getTime();
  const diffWeeks = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));
  const position = ((diffWeeks % 4) + 4) % 4;
  if (position === 0) return 'Labor (Vuelta)';
  if (position === 1) return 'Labor (Salida)';
  if (position === 2) return 'Libre Pagada';
  return 'Libre No Pagada';
}

// ── Types ────────────────────────────────────────────────────────────────────
interface NominaClientProps {
  data: Personal[];
  masterCatalog: Personal[];
  semanas: NominaSemana[];
  area: 'administracion' | 'mina' | 'planta' | 'seguridad' | 'transporte';
}

function recomputePreNominaRow(
  row: PreNominaRowState,
  weekStart: string,
  overrides?: Partial<PreNominaRowState>,
): PreNominaRowState {
  const merged = { ...row, ...overrides };
  const p = merged.personal;
  const cicloPosicion = posicionEsquemaPersonal(p, weekStart);
  const diasBloqueados = inputsDiasBloqueados(p.esquema_rotacion, cicloPosicion);

  let estadoAsistencia = merged.estadoAsistencia;
  let diasTrabajados = merged.diasTrabajados;

  if (overrides?.estadoAsistencia !== undefined) {
    diasTrabajados = diasTrabajadosPorDefectoCiclo(
      p.esquema_rotacion,
      cicloPosicion,
      overrides.estadoAsistencia,
    );
  }
  if (overrides?.diasTrabajados !== undefined && !diasBloqueados) {
    diasTrabajados = overrides.diasTrabajados;
  }
  if (diasBloqueados) {
    diasTrabajados = 0;
  }

  const resolved = resolveEstadoYDias(estadoAsistencia, diasTrabajados);
  const bonoManual = diasBloqueados ? 0 : merged.bonoTransporte;
  const bonificaciones = diasBloqueados ? 0 : merged.bonificaciones;
  const pay = calculateNominaRowPay({
    personal: p,
    estadoAsistencia: resolved.estadoAsistencia,
    diasTrabajados: resolved.diasTrabajados,
    weekStart,
    bonoTransporte: bonoManual,
    bonificaciones,
    totalVales: merged.totalVales,
  });

  return {
    ...merged,
    estadoAsistencia: resolved.estadoAsistencia,
    diasTrabajados: resolved.diasTrabajados,
    salarioBaseCalculado: pay.salarioBaseCalculado,
    bonoTransporte: pay.bonoTransporte,
    bonificaciones,
    esSemanaLibre: pay.esSemanaLibre,
    total: pay.total,
    deducciones: merged.totalVales,
    cicloPosicion,
    diasInputBloqueado: diasBloqueados,
  };
}

const ICONS = {
  administracion: Briefcase,
  mina: Pickaxe,
  planta: Factory,
  seguridad: Shield,
  transporte: Truck,
};

const TITLES = {
  administracion: 'Nómina Administrativa',
  mina: 'Nómina Mina Belén',
  planta: 'Nómina Molino La Fé',
  seguridad: 'Nómina Seguridad',
  transporte: 'Nómina Transporte',
};

function getCargoTheme(cargo: string): { bg: string; text: string; border: string } {
  const l = cargo.toLowerCase();
  if (l.includes('administrativo')) return { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20' };
  if (l.includes('vertical 1') || l.includes('1pd')) return { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/20' };
  if (l.includes('vertical 2')) return { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' };
  if (l.includes('cocinera') || l.includes('nurbelis')) return { bg: 'bg-pink-500/10', text: 'text-pink-400', border: 'border-pink-500/20' };
  if (l.includes('compresor') || l.includes('tecnico')) return { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/20' };
  if (l.includes('grupo') || l.includes('mixto') || l.includes('molino')) return { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' };
  if (l.includes('transporte') || l.includes('fecha')) return { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/20' };
  return { bg: 'bg-zinc-800/10', text: 'text-zinc-400', border: 'border-zinc-700/20' };
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function NominaClient({
  data,
  masterCatalog,
  semanas,
  area,
}: NominaClientProps) {
  const router = useRouter();
  const confirmDialog = useConfirm();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const canEdit = useCanEdit();
  const biblioteca = useBiblioteca();
  const esquemaOpciones = biblioteca.esquemasPorArea[area] || ['FIJO_SEMANAL'];
  const [isPending, startTransition] = useTransition();

  // State
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'primario' | 'esquema'>('primario');
  const [showModal, setShowModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showExcelPreview, setShowExcelPreview] = useState(false);
  // Import modal (roster / planilla semana)
  const [showImport, setShowImport] = useState(false);
  const [showArchivo, setShowArchivo] = useState(false);
  const [previewInitialRange, setPreviewInitialRange] = useState<NominaPreviewRange | null>(null);
  const [previewRefreshKey, setPreviewRefreshKey] = useState(0);
  const [archivoRefreshKey, setArchivoRefreshKey] = useState(0);
  const [showProcesarModal, setShowProcesarModal] = useState(false);
  const [showBorrarModal, setShowBorrarModal] = useState(false);
  const [showHistorial, setShowHistorial] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<PreNominaRowState | null>(null);
  const [copiedReceipt, setCopiedReceipt] = useState(false);

  // Slide-over Drawer
  const [drawerPersonalId, setDrawerPersonalId] = useState<string | null>(null);
  const [drawerVales, setDrawerVales] = useState<NominaVale[]>([]);
  const [drawerHistorial, setDrawerHistorial] = useState<HistorialPagoRow[]>([]);
  const [loadingDrawer, setLoadingDrawer] = useState(false);
  const [isHistoricalLoading, setIsHistoricalLoading] = useState(false);
  const [newValeMonto, setNewValeMonto] = useState('');
  const [newValeMotivo, setNewValeMotivo] = useState('');
  // Paso activo del flujo guiado (Nómina 2.0)
  const [activeStep, setActiveStep] = useState<1 | 2>(1);

  // Vista activa: Semanal (tradicional) o Ciclos (21 días)
  const [viewMode, setViewMode] = useState<'semanal' | 'ciclos'>('semanal');

  // Pre-Nómina
  const [preNominaRows, setPreNominaRows] = useState<PreNominaRowState[]>([]);

  // Sparkline trend data
  const [trendData, setTrendData] = useState<TendenciaSemanalRow[]>([]);

  // Forms
  const [editItem, setEditItem] = useState<Personal | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({
    cedula: '', nombre_completo: '', cargo: '', area, area_detalle: '',
    salario_base: '', salario_libre: '', bono_transporte: '', telefono: '', notas: '',
    fecha_ingreso: new Date().toISOString().split('T')[0],
    esquema_rotacion: 'FIJO_SEMANAL', rotacion_inicio_fecha: '',
  });

  const temporalCtx = useMemo(() => resolveNominaTemporalContext(semanas), [semanas]);

  const [weekRange, setWeekRange] = useState(() => {
    const w = resolveWorkingWeek(semanas);
    return { inicio: w.inicio, fin: w.fin };
  });
  const [procesadoOk, setProcesadoOk] = useState<string | null>(null);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [semanaSheetOpen, setSemanaSheetOpen] = useState(false);

  function handleNominaImported(result?: NominaImportResult) {
    router.refresh();
    setPreviewRefreshKey((k) => k + 1);
    setArchivoRefreshKey((k) => k + 1);
    
    // Para cargas históricas o cualquier importación, ya no alteramos la semana de trabajo
    // del workspace de fondo ni forzamos a que la Vista Previa se inicialice en el rango histórico.
    // La Vista Previa siempre se abrirá mostrando la semana de trabajo actual por defecto,
    // y el usuario podrá buscar periodos anteriores por su respectivo intervalo.
    setPreviewInitialRange(null);
    setShowExcelPreview(true);
  }

  useEffect(() => {
    const tool = searchParams.get('tool');
    if (!tool) return;
    if (tool === 'historico' || tool === 'import') setShowImport(true);
    else if (tool === 'archivo') setShowArchivo(true);
    else if (tool === 'vista') setShowExcelPreview(true);
    router.replace(pathname, { scroll: false });
  }, [searchParams, pathname, router]);

  // ── Load trend data for sparklines ──────────────────────────────────────
  useEffect(() => {
    getTendenciaSemanalAction(area, 8).then(res => {
      if (res.ok && res.data) setTrendData(res.data.reverse());
    });
  }, [area]);

  // ── Initialize rows with rotation predictions and vales ─────────────────
  useEffect(() => {
    if (!data) return;
    const initRows = async () => {
      const currentWeekStart = weekRange.inicio;
      const currentWeekEnd = weekRange.fin;

      // 1. Check if this is a closed week
      const closedWeek = semanas.find(s => s.semana_inicio === currentWeekStart);
      if (closedWeek) {
        setIsHistoricalLoading(true);
        try {
          const res = await getSemanaRegistrosAction(closedWeek.id);
          if (res.ok && res.data) {
            const rows = res.data.map((reg: any) => {
              const p = reg.personal || {
                id: reg.personal_id,
                nombre_completo: 'Trabajador no encontrado',
                cedula: 'SC-N/A',
                cargo: 'General',
                area,
                salario_base: reg.monto_pagado - (reg.bono_transporte_pagado || 0),
                esquema_rotacion: 'FIJO_SEMANAL',
                activo: false,
              };
              const estadoAsistencia = (reg.estado_asistencia ||
                (reg.es_semana_libre ? 'libre' : 'trabajada')) as EstadoAsistenciaNomina;
              const diasTrabajados =
                reg.dias_trabajados ??
                (estadoAsistencia === 'no_laborado' ? 0 : NOMINA_DIAS_POR_SEMANA);
              return {
                personal: p,
                esSemanaLibre: reg.es_semana_libre,
                bonoTransporte: Number(reg.bono_transporte_pagado || 0),
                bonificaciones: 0,
                deducciones: 0,
                total: Number(reg.monto_pagado),
                estadoAsistencia,
                diasTrabajados,
                salarioBaseCalculado: Number(reg.salario_base_calculado || 0),
                valesPendientes: [],
                totalVales: 0,
                novedadTurno: parseNovedadTurno(reg.novedad_turno),
                novedadTurnoObs: String(reg.novedad_turno_obs || ''),
              };
            });
            setPreNominaRows(rows);
            setIsHistoricalLoading(false);
            return;
          }
        } catch (err) {
          console.error('[initRows] Error loading historical:', err);
        }
        setIsHistoricalLoading(false);
      }

      // 2. Active week (not closed) -> load roster and filter
      const activeWorkers = data.filter(p => {
        // Filter out future hires
        if (p.fecha_ingreso && currentWeekEnd && p.fecha_ingreso > currentWeekEnd) return false;
        // Filter out inactive/liquidated
        if (p.estatus && p.estatus !== 'ACTIVO') return false;
        return true;
      });

      if (activeWorkers.length === 0) {
        setPreNominaRows([]);
        return;
      }

      const personalIds = activeWorkers.map(p => p.id);
      let valesMap: Record<string, NominaVale[]> = {};
      try {
        const res = await getValesPendientesBulkAction(personalIds);
        if (res.ok && res.data) {
          res.data.forEach(v => {
            if (!valesMap[v.personal_id]) valesMap[v.personal_id] = [];
            valesMap[v.personal_id].push(v);
          });
        }
      } catch { /* silent */ }

      const novedadDraft = readNominaNovedadDraft(
        nominaNovedadDraftKey(area, currentWeekStart),
      );

      const rows = activeWorkers.map((p) => {
        const predicted = calculateExpectedAttendance(p.esquema_rotacion, p.rotacion_inicio_fecha, currentWeekStart);
        const workerVales = valesMap[p.id] || [];
        const totalVales = workerVales.reduce((s, v) => s + Number(v.monto), 0);
        
        const cicloPosicion = posicionEsquemaPersonal(p, currentWeekStart);
        const diasBloqueados = inputsDiasBloqueados(p.esquema_rotacion, cicloPosicion);
        const diasTrabajados = diasTrabajadosPorDefectoCiclo(
          p.esquema_rotacion,
          cicloPosicion,
          predicted,
        );
        const pay = calculateNominaRowPay({
          personal: p,
          estadoAsistencia: predicted,
          diasTrabajados,
          weekStart: currentWeekStart,
          bonificaciones: 0,
          totalVales,
          bonoTransporte: diasBloqueados ? 0 : undefined,
        });

        const draft = novedadDraft[p.id];
        return {
          personal: p,
          esSemanaLibre: pay.esSemanaLibre,
          bonoTransporte: pay.bonoTransporte,
          bonificaciones: 0,
          deducciones: totalVales,
          total: pay.total,
          estadoAsistencia: predicted,
          diasTrabajados,
          salarioBaseCalculado: pay.salarioBaseCalculado,
          valesPendientes: workerVales,
          totalVales,
          novedadTurno: parseNovedadTurno(draft?.novedadTurno),
          novedadTurnoObs: draft?.novedadTurnoObs ?? '',
          cicloPosicion,
          diasInputBloqueado: diasBloqueados,
        };
      });
      setPreNominaRows(rows);
    };
    initRows();
  }, [data, weekRange.inicio, weekRange.fin, semanas, area]);

  const semanaActual = semanas.find((r) => r.semana_inicio === weekRange.inicio);
  const semanaActualProcesada = !!semanaActual;

  // ── Live Calculation Engine ──────────────────────────────────────────────
  const handleUpdateRow = (personalId: string, fields: Partial<PreNominaRowState>) => {
    setPreNominaRows((prev) => {
      const next = prev.map((row) =>
        row.personal.id !== personalId ? row : recomputePreNominaRow(row, weekRange.inicio, fields),
      );
      if (!semanaActualProcesada) {
        writeNominaNovedadDraft(
          nominaNovedadDraftKey(area, weekRange.inicio),
          Object.fromEntries(
            next.map((r) => [
              r.personal.id,
              { novedadTurno: r.novedadTurno, novedadTurnoObs: r.novedadTurnoObs },
            ]),
          ),
        );
      }
      return next;
    });
  };

  const totalSemana = useMemo(() => preNominaRows.reduce((s, r) => s + r.total, 0), [preNominaRows]);
  const distribucion = useNominaDivisionesConfig(totalSemana);

  const novedadesTurnoSemana = useMemo(
    () =>
      preNominaRows.filter((r) => hasNovedadTurno(r.novedadTurno, r.novedadTurnoObs)),
    [preNominaRows],
  );

  useEffect(() => {
    if (!semanaActual?.id || !semanaActualProcesada) return;
    getSemanaCierreAction(semanaActual.id).then((res) => {
      if (res.ok && res.data) {
        distribucion.applyPlantilla(distribucionFromCierreLegacy(res.data));
      }
    });
  }, [semanaActual?.id, semanaActualProcesada, distribucion.applyPlantilla]);

  // Week-over-week comparison
  const prevSemana = semanas.length >= 2 ? semanas.find(s => s.semana_inicio < weekRange.inicio) : null;
  const weekDelta = prevSemana ? totalSemana - Number(prevSemana.total_pagado) : 0;
  const weekDeltaPct = prevSemana && Number(prevSemana.total_pagado) > 0
    ? ((weekDelta / Number(prevSemana.total_pagado)) * 100)
    : 0;

  const IconComponent = ICONS[area];
  const pageTitle = TITLES[area];
  const assignedIds = useMemo(() => new Set(data.map((p) => p.id)), [data]);

  // Filter & Group
  const filteredRows = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return preNominaRows;
    return preNominaRows.filter(r => r.personal.nombre_completo.toLowerCase().includes(q) || (r.personal.cedula && r.personal.cedula.includes(q)));
  }, [preNominaRows, search]);

  const groupedRows = useMemo(() => {
    const groups: Record<string, PreNominaRowState[]> = {};
    filteredRows.forEach(row => {
      const grupo = getGrupoNominaKey(row.personal);
      if (!groups[grupo]) groups[grupo] = [];
      groups[grupo].push(row);
    });
    return groups;
  }, [filteredRows]);

  // ── CSV Export ──────────────────────────────────────────────────────────
  const handleExportCSV = useCallback(() => {
    const headers = ['Nombre','Cédula','Cargo','Estado','Días','Sueldo Base','Bono Trans.','Bonos','Vales','Total Neto'];
    const csvRows = [headers.join(',')];
    preNominaRows.forEach(row => {
      const p = row.personal;
      csvRows.push([
        `"${p.nombre_completo}"`,
        p.cedula,
        `"${p.cargo}"`,
        row.estadoAsistencia,
        String(row.diasTrabajados),
        row.salarioBaseCalculado.toFixed(2),
        row.bonoTransporte.toFixed(2),
        row.bonificaciones.toFixed(2),
        row.totalVales.toFixed(2),
        row.total.toFixed(2),
      ].join(','));
    });
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `nomina_${area}_${weekRange.inicio}.csv`; a.click();
    URL.revokeObjectURL(url);
  }, [preNominaRows, area, weekRange.inicio]);

  // ── WhatsApp receipt copy ──────────────────────────────────────────────
  const copyReceiptToClipboard = useCallback((row: PreNominaRowState) => {
      const p = row.personal;
      const baseSal = row.salarioBaseCalculado;
      const diasHint =
        row.diasTrabajados < NOMINA_DIAS_POR_SEMANA
          ? ` (${row.diasTrabajados}/${NOMINA_DIAS_POR_SEMANA} días)`
          : '';
    const text = [
      `📋 *COMPROBANTE DE PAGO*`,
      `━━━━━━━━━━━━━━━━━━`,
      `👷 *${p.nombre_completo}*`,
      `📄 C.I. ${p.cedula}`,
      `🏗 Cargo: ${p.cargo}`,
      `📅 Periodo: ${fmtDate(weekRange.inicio)} al ${fmtDate(weekRange.fin)}`,
      ``,
      `💰 Sueldo ${row.estadoAsistencia === 'libre' ? 'Libre' : row.estadoAsistencia === 'no_laborado' ? 'Sin labor' : 'Labor'}${diasHint}: ${fmtMoney(baseSal)}`,
      row.bonoTransporte > 0 ? `🚌 Bono Transporte: +${fmtMoney(row.bonoTransporte)}` : null,
      row.bonificaciones > 0 ? `⭐ Bonificaciones: +${fmtMoney(row.bonificaciones)}` : null,
      row.totalVales > 0 ? `📝 Vales/Adelantos: -${fmtMoney(row.totalVales)}` : null,
      ``,
      `━━━━━━━━━━━━━━━━━━`,
      `✅ *TOTAL NETO: ${fmtMoney(row.total)}*`,
      ``,
      `_Molinos La Fé - Mina Belén_`,
      `_Complejo Operativo El Callao_`,
    ].filter(Boolean).join('\n');
    navigator.clipboard.writeText(text);
    setCopiedReceipt(true);
    setTimeout(() => setCopiedReceipt(false), 2000);
  }, [weekRange]);

  // ── Drawer ─────────────────────────────────────────────────────────────
  const openDrawer = useCallback(async (personalId: string) => {
    setDrawerPersonalId(personalId);
    setLoadingDrawer(true);
    setNewValeMonto(''); setNewValeMotivo('');
    try {
      const [valesRes, historialRes] = await Promise.all([
        getValesPendientesBulkAction([personalId]),
        getHistorialPagosAction(personalId, 10),
      ]);
      setDrawerVales(valesRes.ok && valesRes.data ? valesRes.data : []);
      setDrawerHistorial(historialRes.ok && historialRes.data ? historialRes.data : []);
    } catch { setDrawerVales([]); setDrawerHistorial([]); }
    setLoadingDrawer(false);
  }, []);

  const handleAddVale = useCallback(async () => {
    if (!drawerPersonalId || !newValeMonto) return;
    startTransition(async () => {
      await crearValeAction(drawerPersonalId, Number(newValeMonto), newValeMotivo || 'Adelanto');
      await registrarAuditAction('CREAR_VALE', 'nomina_vales', drawerPersonalId, `Monto: $${newValeMonto} - ${newValeMotivo || 'Adelanto'}`, user?.id, user?.email);
      const vRes = await getValesPendientesBulkAction([drawerPersonalId]);
      const newVales = vRes.ok && vRes.data ? vRes.data : [];
      setDrawerVales(newVales); setNewValeMonto(''); setNewValeMotivo('');
      const totalVales = newVales.reduce((s, v) => s + Number(v.monto), 0);
      setPreNominaRows((prev) =>
        prev.map((row) =>
          row.personal.id !== drawerPersonalId
            ? row
            : recomputePreNominaRow(row, weekRange.inicio, {
                valesPendientes: newVales,
                totalVales,
              }),
        ),
      );
    });
  }, [drawerPersonalId, newValeMonto, newValeMotivo, startTransition, user, weekRange.inicio]);

  const handleDeleteVale = useCallback(async (valeId: string) => {
    if (!drawerPersonalId) return;
    startTransition(async () => {
      await eliminarValeAction(valeId);
      await registrarAuditAction('ELIMINAR_VALE', 'nomina_vales', valeId, `Eliminado por ${user?.email}`, user?.id, user?.email);
      const vRes = await getValesPendientesBulkAction([drawerPersonalId]);
      const newVales = vRes.ok && vRes.data ? vRes.data : [];
      setDrawerVales(newVales);
      const totalVales = newVales.reduce((s, v) => s + Number(v.monto), 0);
      setPreNominaRows((prev) =>
        prev.map((row) =>
          row.personal.id !== drawerPersonalId
            ? row
            : recomputePreNominaRow(row, weekRange.inicio, {
                valesPendientes: newVales,
                totalVales,
              }),
        ),
      );
    });
  }, [drawerPersonalId, startTransition, user, weekRange.inicio]);

  const drawerRow = useMemo(() => {
    if (!drawerPersonalId) return null;
    return preNominaRows.find(r => r.personal.id === drawerPersonalId) || null;
  }, [drawerPersonalId, preNominaRows]);

  // ── Actions ────────────────────────────────────────────────────────────
  function openEdit(item: Personal) {
    setEditItem(item);
    const asignacion = item.area_detalle || '';
    setForm({
      cedula: item.cedula, nombre_completo: item.nombre_completo, cargo: item.cargo,
      area: item.area as typeof area,
      area_detalle: isAsignacionNominaValid(asignacion) ? asignacion : '',
      salario_base: String(item.salario_base), salario_libre: String(item.salario_libre || ''),
      bono_transporte: String(item.bono_transporte || ''), telefono: item.telefono || '',
      notas: item.notas || '', fecha_ingreso: item.fecha_ingreso || new Date().toISOString().split('T')[0],
      esquema_rotacion: item.esquema_rotacion || 'FIJO_SEMANAL',
      rotacion_inicio_fecha: item.rotacion_inicio_fecha || '',
    });
    setActiveTab('primario'); setShowModal(true);
  }

  function resetForm() {
    setEditItem(null);
    setForm({ cedula: '', nombre_completo: '', cargo: '', area, area_detalle: '', salario_base: '', salario_libre: '', bono_transporte: '', telefono: '', notas: '', fecha_ingreso: new Date().toISOString().split('T')[0], esquema_rotacion: 'FIJO_SEMANAL', rotacion_inicio_fecha: '' });
    setActiveTab('primario'); setFormError(null);
  }

  function handleSave() {
    setFormError(null);
    startTransition(async () => {
      const res = await upsertPersonalV3Action({
        id: editItem?.id, cedula: form.cedula, nombre_completo: form.nombre_completo,
        cargo: form.cargo, area, area_detalle: form.area_detalle,
        perfil_compensacion_id: editItem?.perfil_compensacion_id || '',
        salario_base: Number(form.salario_base) || 0,
        bono_transporte: Number(form.bono_transporte) || 0, telefono: form.telefono, notas: form.notas,
        fecha_ingreso: form.fecha_ingreso,
        rotacion_inicio_fecha: form.rotacion_inicio_fecha || null,
      });
      if (res.ok) {
        await registrarAuditAction(editItem ? 'EDITAR_PERSONAL' : 'CREAR_PERSONAL', 'personal', editItem?.id || form.cedula, `${form.nombre_completo} - ${form.cargo}`, user?.id, user?.email);
        setShowModal(false); resetForm();
      } else setFormError(res.message);
    });
  }

  async function handleDelete(id: string) {
    if (!(await confirmDialog({
      title: 'Desactivar trabajador',
      message: '¿Desactivar este trabajador del sistema?',
      variant: 'danger'
    }))) return;
    
    // Optimistic update: remover fila inmediatamente del estado local
    setPreNominaRows(prev => prev.filter(row => row.personal.id !== id));
    
    startTransition(async () => {
      await updatePersonalEstatusAction(id, 'INACTIVO');
      await registrarAuditAction('DESACTIVAR_PERSONAL', 'personal', id, `Desactivado por ${user?.email}`, user?.id, user?.email);
    });
  }

  async function handleProcesarNomina() {
    if (preNominaRows.length === 0) {
      toastError('No hay trabajadores activos.');
      return;
    }
    if (!distribucion.validation.ok) {
      toastError(distribucion.validation.message ?? 'Revisa la distribución de pagos.');
      return;
    }
    if (semanaActual && !(await confirmDialog({
      title: 'Sobreescribir nómina',
      message: 'La semana ya fue procesada. ¿Deseas sobreescribirla?',
      variant: 'warning'
    }))) return;
    setProcesadoOk(null);
    startTransition(async () => {
      const formattedRows = preNominaRows.map((r) => ({
        personal: r.personal,
        esSemanaLibre: r.esSemanaLibre,
        bonoTransporte: r.bonoTransporte,
        total: r.total,
        bonificaciones: r.bonificaciones,
        totalVales: r.totalVales,
        estadoAsistencia: r.estadoAsistencia,
        diasTrabajados: r.diasTrabajados,
        salarioBaseCalculado: r.salarioBaseCalculado,
        novedadTurno: r.novedadTurno,
        novedadTurnoObs: r.novedadTurnoObs,
      }));
      const res = await procesarCierreNominaV3Action({
        userId: user?.id || '', area, inicio: weekRange.inicio, fin: weekRange.fin, rows: formattedRows,
        distribucion: distribucion.partes,
      });
      if (res.ok) {
        try {
          localStorage.removeItem(nominaNovedadDraftKey(area, weekRange.inicio));
        } catch {
          /* ignore */
        }
        distribucion.saveAsDefault();
        await registrarAuditAction('CERRAR_NOMINA', 'nomina_semanas', area, `${weekRange.inicio} a ${weekRange.fin} - ${preNominaRows.length} trabajadores - Total: $${totalSemana.toFixed(2)}`, user?.id, user?.email);
        setProcesadoOk(`✓ ${res.message}`); setShowProcesarModal(false);
      } else toastError(res.message);
    });
  }

  async function handleRevertirSemana(sem: NominaSemana) {
    if (!(await confirmDialog({
      title: 'Revertir nómina',
      message: `¿Revertir la nómina del ${fmtDate(sem.semana_inicio)} al ${fmtDate(sem.semana_fin)}?`,
      variant: 'danger'
    }))) return;
    startTransition(async () => {
      const res = await revertirSemanaAction(sem);
      if (res.ok) {
        await registrarAuditAction('REVERTIR_NOMINA', 'nomina_semanas', sem.id, `Revertida: ${fmtDate(sem.semana_inicio)} a ${fmtDate(sem.semana_fin)}`, user?.id, user?.email);
      } else toastError(sem.notas || 'Error al revertir');
    });
  }

  function handleBorrarTodo() {
    startTransition(async () => {
      const res = await borrarTodoPersonalArea(area);
      if (res.ok) {
        await registrarAuditAction('BORRAR_TODO_PERSONAL', 'personal', area, `Todos los trabajadores de ${area} desactivados`, user?.id, user?.email);
        setShowBorrarModal(false);
        toast.success('Todos los trabajadores desactivados.');
      } else toastError(res.message);
    });
  }

  // ── PDF Consolidated Report ─────────────────────────────────────────────
  const handlePrintReport = useCallback(() => {
    const rows = preNominaRows;
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Reporte Nómina ${area.toUpperCase()}</title>
<style>
  body{font-family:system-ui,sans-serif;padding:40px;color:#111;font-size:12px}
  h1{font-size:18px;margin-bottom:4px}
  h2{font-size:14px;color:#666;margin-top:0}
  table{width:100%;border-collapse:collapse;margin-top:16px}
  th{background:#f5f5f5;border:1px solid #ddd;padding:6px 8px;text-align:left;font-size:10px;text-transform:uppercase}
  td{border:1px solid #eee;padding:5px 8px}
  .total-row{font-weight:bold;background:#fffde7}
  .text-right{text-align:right}
  .signatures{display:flex;justify-content:space-between;margin-top:60px;padding-top:40px}
  .sig-box{text-align:center;width:200px;border-top:1px solid #333;padding-top:8px;font-size:10px}
  .footer{margin-top:30px;font-size:9px;color:#999;text-align:center}
</style></head><body>
<h1>MOLINOS LA FÉ - MINA BELÉN</h1>
<h2>Reporte Consolidado de Nómina Semanal — ${area.toUpperCase()}</h2>
<p>Periodo: ${fmtDate(weekRange.inicio)} al ${fmtDate(weekRange.fin)} · ${rows.length} trabajadores · Generado: ${new Date().toLocaleString('es-VE')}</p>
<table>
<thead><tr><th>#</th><th>Nombre</th><th>C.I.</th><th>Cargo</th><th>Estado</th><th>Días</th><th class="text-right">Sueldo</th><th class="text-right">Bono Trans.</th><th class="text-right">Bonos</th><th class="text-right">Vales</th><th class="text-right">TOTAL</th></tr></thead>
<tbody>
${rows.map((r, i) => {
  const baseSal = r.salarioBaseCalculado;
  return `<tr><td>${i+1}</td><td><strong>${r.personal.nombre_completo}</strong></td><td>${r.personal.cedula}</td><td>${r.personal.cargo}</td><td>${r.estadoAsistencia}</td><td class="text-center">${r.diasTrabajados}</td><td class="text-right">$${baseSal.toFixed(2)}</td><td class="text-right">$${r.bonoTransporte.toFixed(2)}</td><td class="text-right">$${r.bonificaciones.toFixed(2)}</td><td class="text-right">$${r.totalVales.toFixed(2)}</td><td class="text-right"><strong>$${r.total.toFixed(2)}</strong></td></tr>`;
}).join('')}
<tr class="total-row"><td colspan="9">TOTAL GENERAL</td><td class="text-right"><strong>$${totalSemana.toFixed(2)}</strong></td></tr>
</tbody></table>
<h2 style="margin-top:24px">Distribución de pagos</h2>
<table style="width:auto"><thead><tr><th>Beneficiario</th><th>%</th><th class="text-right">Bruto</th><th class="text-right">Pagos Directos</th><th class="text-right">Neto</th></tr></thead>
<tbody>
${distribucion.lineas.map((l) => `<tr><td>${l.nombre}</td><td>${l.porcentaje}%</td><td class="text-right">$${l.bruto.toFixed(2)}</td><td class="text-right">$${l.pagoDirecto.toFixed(2)}</td><td class="text-right"><strong>$${l.neto.toFixed(2)}</strong></td></tr>`).join('')}
</tbody></table>
<div class="signatures">${distribucion.lineas.map((l) => `<div class="sig-box">${l.nombre.toUpperCase()}<br>Beneficiario</div>`).join('')}</div>
<p class="footer">Generado automáticamente por MineOS — Sistema de Gestión Minera · ${new Date().toISOString()}</p>
</body></html>`;
    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); win.print(); }
  }, [preNominaRows, totalSemana, area, weekRange, distribucion.lineas]);

  const toolbarActions = (
    <>
      {!semanaActualProcesada ? (
        <button onClick={() => setShowProcesarModal(true)} disabled={!canEdit || preNominaRows.length === 0} title="Cerrar y Distribuir" className="nomina-page__toolbar-btn bg-amber-600 hover:bg-amber-500 text-black font-bold h-9 px-3 rounded-lg flex items-center justify-center gap-1.5 disabled:opacity-40 text-xs">
          <Wallet className="w-3.5 h-3.5 shrink-0" /> Cerrar
        </button>
      ) : (
        <button onClick={() => semanaActual && handleRevertirSemana(semanaActual)} disabled={!canEdit || isPending} title="Revertir cierre" className="nomina-page__toolbar-btn h-9 px-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-40">
          {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Revertir
        </button>
      )}
      <button onClick={() => setShowAssignModal(true)} disabled={!canEdit} title="Buscar en base o registrar nuevo" className="nomina-page__toolbar-btn bg-amber-600 hover:bg-amber-500 text-black font-bold h-9 px-3 rounded-lg flex items-center justify-center gap-1.5 disabled:opacity-40 text-xs">
        <Plus className="w-3.5 h-3.5 shrink-0" /> Trabajador
      </button>
      <button onClick={() => setShowImport(true)} disabled={!canEdit} title="Importar planilla o roster (detecta histórico / semana actual)" className="nomina-page__toolbar-btn btn-secondary h-9 px-3 text-xs flex items-center justify-center gap-1.5 border border-emerald-500/25 text-emerald-200/90 hover:bg-emerald-500/10">
        <Upload className="w-3.5 h-3.5 shrink-0" /> Importar
      </button>
      <button
        type="button"
        onClick={() => setShowArchivo(true)}
        title="Periodos archivados y consolidación"
        className="nomina-page__toolbar-btn btn-secondary h-9 px-3 text-xs flex items-center justify-center gap-1.5"
      >
        <Archive className="w-3.5 h-3.5 shrink-0 text-zinc-400" /> Archivo
      </button>
      <button
        type="button"
        onClick={() => setShowExcelPreview(true)}
        title="Vista previa consolidada estilo Excel"
        className="nomina-page__toolbar-btn btn-secondary h-9 px-3 text-xs flex items-center justify-center gap-1.5 border border-amber-500/40 text-amber-200/95 hover:bg-amber-500/10"
      >
        <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" /> Vista Excel
      </button>
      <button onClick={handlePrintReport} title="PDF" className="nomina-page__toolbar-btn btn-secondary h-9 px-3 text-xs flex items-center justify-center gap-1.5">
        <Printer className="w-3.5 h-3.5 shrink-0 text-zinc-400" /> PDF
      </button>
      <button onClick={handleExportCSV} title="CSV" className="nomina-page__toolbar-btn btn-secondary h-9 px-3 text-xs flex items-center justify-center gap-1.5">
        <Download className="w-3.5 h-3.5 shrink-0 text-zinc-400" /> CSV
      </button>
      {canEdit && data.length > 0 && (
        <button onClick={() => setShowBorrarModal(true)} title="Baja todo" className="nomina-page__toolbar-btn bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-red-400/90 font-bold h-9 px-3 rounded-lg flex items-center justify-center gap-1.5 text-xs">
          <Trash2 className="w-3.5 h-3.5 shrink-0" />
        </button>
      )}
    </>
  );

  // ── RENDER ─────────────────────────────────────────────────────────────
  return (
    <div className="nomina-page flex min-h-0 w-full flex-1 flex-col overflow-hidden">
      <div className="nomina-page__body nomina-page__grid min-h-0 flex-1 grid grid-cols-1 gap-3 lg:grid-cols-12 lg:gap-4">

        <aside className="nomina-page__aside scroll-y-fade hidden lg:col-span-3 lg:flex flex-col gap-3 min-h-0 lg:overflow-y-auto">
          <header className="nomina-page__aside-head shrink-0">
            <h1 className="nomina-page__title">
              <IconComponent className="nomina-page__title-icon" aria-hidden />
              <span className="nomina-page__title-text">{pageTitle}</span>
            </h1>
          </header>

          <div className="nomina-page__kpis grid grid-cols-2 gap-2.5 shrink-0">
            <div className="nomina-page__kpi-card bg-zinc-900 border border-zinc-800 rounded-lg">
              <p className="nomina-page__kpi-label">Total Semanal</p>
              <p className="nomina-page__kpi-value text-amber-400">{fmtMoney(totalSemana)}</p>
            </div>
            <div className="nomina-page__kpi-card bg-zinc-900 border border-zinc-800 rounded-lg">
              <p className="nomina-page__kpi-label">Personal Activo</p>
              <p className="nomina-page__kpi-value text-white/90">{data.length}</p>
            </div>
            <div className="nomina-page__kpi-card bg-zinc-900 border border-zinc-800 rounded-lg">
              <p className="nomina-page__kpi-label">Promedio</p>
              <p className="nomina-page__kpi-value text-white/90">{data.length > 0 ? fmtMoney(totalSemana / data.length) : '$0.00'}</p>
            </div>
            <div className="nomina-page__kpi-card bg-zinc-900 border border-zinc-800 rounded-lg">
              <p className="nomina-page__kpi-label">Vales Pend.</p>
              <p className="nomina-page__kpi-value text-red-400">{fmtMoney(preNominaRows.reduce((s, r) => s + r.totalVales, 0))}</p>
            </div>
          </div>

          {(activeStep >= 2 || semanaActualProcesada) && (
            <div className="nomina-page__distribucion-aside shrink-0 max-h-[min(22rem,40vh)] overflow-y-auto">
              <NominaDistribucionPanel
                totalNomina={totalSemana}
                partes={distribucion.partes}
                lineas={distribucion.lineas}
                sumPct={distribucion.sumPct}
                validationOk={distribucion.validation.ok}
                validationMessage={distribucion.validation.message}
                onUpdateParte={distribucion.updateParte}
                onAddParte={distribucion.addParte}
                onRemoveParte={distribucion.removeParte}
                onRebalance={distribucion.rebalanceIgual}
                onSaveDefault={distribucion.saveAsDefault}
                variant="dark"
                compact
                readOnly={semanaActualProcesada}
              />
            </div>
          )}

          <div className="nomina-page__console shrink-0 flex flex-col gap-3">
            <div className="flex flex-col text-left">
              <span className="text-[9px] font-bold text-amber-500 uppercase tracking-widest">Consola de Control</span>
              <h2 className="text-sm font-black text-white/90 uppercase tracking-wide mt-0.5">Nómina Guiada 2.0</h2>
            </div>
            <div className="flex flex-col gap-2">
              {[
                { step: 1, title: 'Asistencia', desc: 'Turno y días trabajados' },
                { step: 2, title: 'Vales & Ajustes', desc: 'Bono Trans./Adelantos' },
              ].map((s) => {
                const isActive = activeStep === s.step;
                return (
                  <button
                    key={s.step}
                    type="button"
                    onClick={() => setActiveStep(s.step as 1 | 2)}
                    className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-1.5 text-left transition-all group ${
                      isActive
                        ? 'border-amber-500/40 bg-amber-600/10 text-amber-400 shadow-md shadow-amber-500/5'
                        : 'border-zinc-800/80 bg-zinc-950/30 text-white/40 hover:border-zinc-700 hover:text-white/60'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold leading-tight">{s.title}</p>
                      <p className="mt-0.5 text-[8px] leading-none text-white/30 group-hover:text-white/40">{s.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="nomina-page__status shrink-0 flex flex-col gap-2">
            {semanaActualProcesada ? (
              <div className="rounded-xl border border-emerald-500/10 bg-emerald-500/5 px-4 py-3.5 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-500/10">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-emerald-400">Nómina Cerrada</p>
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[8px] font-black text-emerald-400 uppercase tracking-widest mt-1">
                      <Lock className="w-2.5 h-2.5" /> Frozen
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950/60 px-2.5 py-1">
                    <Calendar className="h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden />
                    <span className="text-[9px] font-bold uppercase text-white/40">Desde:</span>
                    <input type="date" value={weekRange.inicio} onChange={e => { const newInicio = e.target.value; const d = new Date(newInicio); d.setDate(d.getDate() + 6); setWeekRange({ inicio: newInicio, fin: d.toISOString().split('T')[0] }); }} className="nomina-page__date-input min-w-0 flex-1 cursor-pointer border-0 bg-transparent p-0 text-xs text-white/90 outline-none focus:ring-0" />
                  </label>
                  <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950/60 px-2.5 py-1">
                    <Calendar className="h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden />
                    <span className="text-[9px] font-bold uppercase text-white/40">Hasta:</span>
                    <input type="date" value={weekRange.fin} onChange={e => setWeekRange(prev => ({ ...prev, fin: e.target.value }))} className="nomina-page__date-input min-w-0 flex-1 cursor-pointer border-0 bg-transparent p-0 text-xs text-white/90 outline-none focus:ring-0" />
                  </label>
                  <p className="text-[11px] text-white/50">{semanaActual.total_trabajadores} trabajadores · <span className="font-bold text-emerald-400">{fmtMoney(Number(semanaActual.total_pagado))}</span></p>
                </div>
                <button onClick={() => handleRevertirSemana(semanaActual)} disabled={!canEdit || isPending} className="h-8 px-3 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-xs font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-40">
                  {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Revertir
                </button>
              </div>
            ) : (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3.5 flex flex-col gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-amber-500/10">
                    <AlertTriangle className="h-3.5 w-3.5 animate-pulse text-amber-500" />
                  </div>
                  <p className="text-xs font-semibold text-amber-500">Nómina Pendiente</p>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/60 px-2.5 py-1.5">
                    <Calendar className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-hidden />
                    <span className="text-[9px] font-bold uppercase text-white/40">Desde:</span>
                    <input type="date" value={weekRange.inicio} onChange={e => { const newInicio = e.target.value; const d = new Date(newInicio); d.setDate(d.getDate() + 6); setWeekRange({ inicio: newInicio, fin: d.toISOString().split('T')[0] }); }} className="nomina-page__date-input min-w-0 flex-1 cursor-pointer border-0 bg-transparent p-0 text-xs text-white/90 outline-none focus:ring-0" />
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/60 px-2.5 py-1.5">
                    <Calendar className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-hidden />
                    <span className="text-[9px] font-bold uppercase text-white/40">Hasta:</span>
                    <input type="date" value={weekRange.fin} onChange={e => setWeekRange(prev => ({ ...prev, fin: e.target.value }))} className="nomina-page__date-input min-w-0 flex-1 cursor-pointer border-0 bg-transparent p-0 text-xs text-white/90 outline-none focus:ring-0" />
                  </label>
                  <p className="text-[11px] text-white/50">{preNominaRows.length} activos · <span className="font-bold text-amber-400">{fmtMoney(totalSemana)}</span></p>
                </div>
                {procesadoOk && <div className="mt-2.5 flex items-center gap-2 text-xs text-emerald-400 font-bold"><CheckCircle2 className="w-3.5 h-3.5" />{procesadoOk}</div>}
              </div>
            )}
            {weekRange.inicio !== temporalCtx.workingWeekStart && (
              <div className="rounded-xl border border-sky-500/25 bg-sky-500/5 px-3 py-2.5">
                <p className="text-[10px] leading-snug text-sky-200/90">{formatTemporalContextHint(temporalCtx)}</p>
                <button
                  type="button"
                  onClick={() =>
                    setWeekRange({
                      inicio: temporalCtx.workingWeekStart,
                      fin: temporalCtx.workingWeekEnd,
                    })
                  }
                  className="mt-2 text-[10px] font-bold uppercase tracking-wide text-sky-400 hover:text-sky-300"
                >
                  Ir a semana de curso
                </button>
              </div>
            )}
            {prevSemana && Math.abs(weekDeltaPct) > 15 && (
              <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-3 py-2.5 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
                <p className="text-[10px] text-yellow-300 leading-snug">
                  <strong>Anomalía:</strong> {Math.abs(weekDeltaPct).toFixed(1)}% vs semana anterior.
                </p>
              </div>
            )}
          </div>

          {semanas.length > 0 && (
            <div className="nomina-page__historial hidden lg:flex flex-col flex-1 min-h-0 bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <button onClick={() => setShowHistorial(!showHistorial)} className="w-full flex justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors border-b border-zinc-850 flex-shrink-0">
                <div className="flex items-center gap-2 text-xs font-bold text-white/50 uppercase tracking-widest"><Clock className="w-4 h-4 text-amber-500" /> Historial</div>
                {showHistorial ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />}
              </button>
              {showHistorial && (
                <div className="p-2.5 overflow-y-auto flex-1 flex flex-col gap-2 scroll-y-fade">
                  {semanas.map(sem => (
                    <div key={sem.id} className="bg-zinc-950/40 border border-zinc-850 rounded-lg p-3 hover:border-zinc-800 transition-colors">
                      <div className="flex justify-between items-start gap-2">
                        <p className="text-[11px] font-bold text-white/90 leading-snug">{fmtDate(sem.semana_inicio)} – {fmtDate(sem.semana_fin)}</p>
                        <span className="text-[8px] uppercase font-bold px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded shrink-0">OK</span>
                      </div>
                      <div className="flex justify-between items-center pt-2 mt-2 border-t border-zinc-800/40">
                        <p className="text-xs font-bold text-amber-500">{fmtMoney(Number(sem.total_pagado))}</p>
                        {canEdit && <button onClick={() => handleRevertirSemana(sem)} disabled={isPending} className="text-[9px] font-bold text-red-400 hover:text-red-300 uppercase">Revertir</button>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </aside>

        <div className="nomina-page__content lg:col-span-9 flex min-h-0 flex-col gap-3 overflow-hidden">
          <NominaMobileStickyChrome
            pageTitle={pageTitle}
            cerrada={semanaActualProcesada}
            weekLabel={`${fmtDate(weekRange.inicio)} – ${fmtDate(weekRange.fin)}`}
            totalSemana={totalSemana}
            preNominaCount={preNominaRows.length}
            activeStep={activeStep}
            onStep={setActiveStep}
            onOpenSemana={() => setSemanaSheetOpen(true)}
            search={search}
            onSearchChange={setSearch}
            fmtMoney={fmtMoney}
          />

          <div className="nomina-page__main nomina-page__table-stack flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/30 lg:border lg:bg-zinc-900/30">
            {/* Tabs de Vista */}
            <div className="shrink-0 border-b border-zinc-800/80 bg-zinc-950/40 px-3 py-2">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setViewMode('semanal')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                    viewMode === 'semanal'
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                      : 'text-white/50 hover:text-white/70 border border-transparent'
                  }`}
                >
                  Vista Semanal
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('ciclos')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                    viewMode === 'ciclos'
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                      : 'text-white/50 hover:text-white/70 border border-transparent'
                  }`}
                >
                  Vista por Ciclo 21 Días
                </button>
              </div>
            </div>

            {viewMode === 'ciclos' ? (
              <div className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto p-2.5 pb-[calc(4.25rem+env(safe-area-inset-bottom))] lg:p-3 lg:pb-3">
                <NominaCiclosTable area={area} canEdit={canEdit} />
              </div>
            ) : (
            <>
            <div className="nomina-page__toolbar hidden shrink-0 flex-col gap-2 border-b border-zinc-800/80 px-3 py-2.5 lg:flex">
              <div className="nomina-page__toolbar-search flex w-full min-w-0 items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2">
                <Search className="h-4 w-4 shrink-0 text-white/40" aria-hidden />
                <input
                  type="text"
                  placeholder="Buscar por nombre o cédula..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full min-w-0 border-0 bg-transparent text-sm text-white/90 outline-none placeholder:text-white/30"
                />
              </div>
              <div className="nomina-page__toolbar-actions w-full min-w-0">{toolbarActions}</div>
            </div>

            <div className="nomina-page__table-scroll scroll-y-fade flex min-h-0 flex-1 flex-col gap-3 overflow-x-hidden overflow-y-auto p-2.5 pb-[calc(4.25rem+env(safe-area-inset-bottom))] lg:gap-6 lg:p-3 lg:pb-3">
            {isHistoricalLoading ? (
              <div className="bg-zinc-900/40 backdrop-blur-md border border-zinc-800 rounded-xl p-20 text-center flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
                <p className="text-sm text-white/50 font-medium">Cargando registros históricos de nómina...</p>
              </div>
            ) : Object.keys(groupedRows).length === 0 ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
                <Users className="w-12 h-12 text-white/20 mx-auto mb-3" />
                <p className="text-sm text-white/40">No hay trabajadores en esta nómina.</p>
                {canEdit && !search.trim() && (
                  <button
                    type="button"
                    onClick={() => setShowAssignModal(true)}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-xs font-bold text-black"
                  >
                    <Plus className="h-3.5 w-3.5" /> Asignar desde la base
                  </button>
                )}
              </div>
            ) : (
              Object.entries(groupedRows).map(([cargoName, rows]) => {
                const theme = getCargoTheme(cargoName);
                const groupTotal = rows.reduce((s, r) => s + r.total, 0);
                const groupSueldo = rows.reduce((s, r) => {
                  return s + r.salarioBaseCalculado;
                }, 0);
                const groupBono = rows.reduce((s, r) => s + r.bonoTransporte, 0);
                const groupBonif = rows.reduce((s, r) => s + r.bonificaciones, 0);
                const groupVales = rows.reduce((s, r) => s + r.totalVales, 0);
                return (
                  <div key={cargoName} className="nomina-cargo-group shrink-0 overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-900/40 shadow-sm">
                    {/* Group Header */}
                    <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-zinc-800 bg-zinc-900/80 px-3 py-2 lg:gap-2 lg:px-5 lg:py-3.5">
                      <div className="flex min-w-0 items-center gap-2 lg:gap-3">
                        <div className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider lg:px-3 lg:py-1 lg:text-[10px] ${theme.bg} ${theme.text} ${theme.border}`}>{cargoName}</div>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-white/40 lg:text-[10px]">{rows.length} trab.</span>
                        {semanaActualProcesada && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/25 text-[8px] font-bold uppercase tracking-wider">
                            <Lock className="w-2.5 h-2.5" /> Bloqueado (Historial)
                          </span>
                        )}
                      </div>
                      <span className="shrink-0 text-xs font-semibold tabular-nums text-amber-500 lg:text-sm">Subtotal {fmtMoney(groupTotal)}</span>
                    </div>

                    <div className="space-y-1.5 p-2 lg:hidden">
                      {rows.map((row) => {
                        const p = row.personal;
                        return (
                          <NominaMobileWorkerCard
                            key={p.id}
                            row={row}
                            activeStep={activeStep}
                            locked={semanaActualProcesada}
                            canEdit={canEdit}
                            theme={theme}
                            initials={getInitials(p.nombre_completo)}
                            avatarColor={getAvatarColor(p.cargo)}
                            onOpenDrawer={() => openDrawer(p.id)}
                            onOpenReceipt={() => setSelectedReceipt(row)}
                            onEdit={() => openEdit(p)}
                            onDelete={() => handleDelete(p.id)}
                            onUpdateRow={(fields) => handleUpdateRow(p.id, fields)}
                            onNovedadTurnoChange={(fields) => handleUpdateRow(p.id, fields)}
                            fmtMoney={fmtMoney}
                          />
                        );
                      })}
                      <div className="flex items-center justify-between rounded-xl border border-zinc-700/50 bg-zinc-950/60 px-3 py-2.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-white/45">Subtotal {cargoName}</span>
                        <span className="text-sm font-black tabular-nums text-amber-500">{fmtMoney(groupTotal)}</span>
                      </div>
                    </div>

                    <div className="hidden overflow-x-auto lg:block">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-zinc-950/40 border-b border-zinc-800 text-[10px] font-bold text-white/50 uppercase tracking-wider">
                            <th className="px-5 py-3">Trabajador</th>
                            <th className="px-2 py-3 text-center text-[10px]">Novedad turno</th>
                            <th className={`px-5 py-3 text-center transition-all duration-300 ${activeStep === 1 ? 'bg-amber-500/10 text-amber-400 font-black border-x border-amber-500/20 shadow-sm' : ''}`}>Asistencia</th>
                            <th className={`px-3 py-3 text-center transition-all duration-300 ${activeStep === 1 ? 'bg-amber-500/10 text-amber-400 font-black shadow-sm' : ''}`}>Días</th>
                            <th className="px-5 py-3 text-right">Sueldo</th>
                            <th className={`px-5 py-3 text-right transition-all duration-300 ${activeStep === 2 ? 'bg-amber-500/10 text-amber-400 font-black border-l border-amber-500/20 shadow-sm' : ''}`}>Bono T.</th>
                            <th className={`px-5 py-3 text-right transition-all duration-300 ${activeStep === 2 ? 'bg-amber-500/10 text-amber-400 font-black shadow-sm' : ''}`}>Bonos</th>
                            <th className={`px-5 py-3 text-right transition-all duration-300 ${activeStep === 2 ? 'bg-amber-500/10 text-amber-400 font-black border-r border-amber-500/20 shadow-sm' : ''}`}>Vales</th>
                            <th className="px-5 py-3 text-right text-amber-500">Total</th>
                            <th className="px-5 py-3 text-center">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-850/40">
                          {rows.map(row => {
                            const p = row.personal;
                            const avatarColor = getAvatarColor(p.cargo);
                            const initials = getInitials(p.nombre_completo);
                            const isPredicted = p.esquema_rotacion !== 'FIJO_SEMANAL' && p.esquema_rotacion !== 'MOLINO_FIJO';
                            return (
                              <tr key={p.id} className="border-b border-zinc-850/20 hover:bg-zinc-800/20 transition-colors">
                                {/* Avatar + Name */}
                                <td className="px-5 py-3">
                                  <button onClick={() => openDrawer(p.id)} className="text-left group flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-lg ${avatarColor} flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm`}>{initials}</div>
                                    <div>
                                      <div className="font-semibold text-white/90 text-sm leading-snug group-hover:text-amber-400 transition-colors flex items-center gap-1.5">
                                        {p.nombre_completo}
                                        <ChevronRight className="w-3 h-3 text-white/20 group-hover:text-amber-400 transition-colors" />
                                      </div>
                                      <div className="text-[10px] text-white/40 mt-0.5 flex items-center gap-1.5 flex-wrap">
                                        <span>{p.cedula}</span>
                                        {isPredicted && (
                                          (() => {
                                            if (p.esquema_rotacion === 'MINA_ROTATIVA_3G') {
                                              const state = getMina3GState(p.rotacion_inicio_fecha, weekRange.inicio);
                                              if (state === 'Noche') return <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[8px] font-bold uppercase">🔄 Noche (pred.)</span>;
                                              if (state === 'Día') return <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[8px] font-bold uppercase">🔄 Día (pred.)</span>;
                                              return <span className="px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[8px] font-bold uppercase">🔄 Libre (pred.)</span>;
                                            }
                                            if (p.esquema_rotacion === 'MOLINO_14X14' && row.cicloPosicion !== null && row.cicloPosicion !== undefined) {
                                              const state = etiquetaEstadoRotacion(p.esquema_rotacion, row.cicloPosicion);
                                              if (state === 'Libre Pagada') return <span className="px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[8px] font-bold uppercase">🔄 Libre Pagada</span>;
                                              if (state === 'Libre No Pagada') return <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 text-[8px] font-bold uppercase">🔄 Libre $0</span>;
                                              return <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[8px] font-bold uppercase">🔄 {state}</span>;
                                            }
                                            if (p.esquema_rotacion === 'MOLINO_15X15') {
                                              const state = getMolino15x15State(p.rotacion_inicio_fecha, weekRange.inicio);
                                              if (state === 'Labor (Vuelta - Paga Doble)') return <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[8px] font-bold uppercase">🔄 Vuelta (Paga Doble)</span>;
                                              if (state === 'Labor (Salida + Bono)') return <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[8px] font-bold uppercase">🔄 Salida + Bono</span>;
                                              if (state === 'Libre Pagada (Diferida)') return <span className="px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[8px] font-bold uppercase">🔄 Libre Pág. (Diferida)</span>;
                                              return <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 text-[8px] font-bold uppercase">🔄 Libre No-Pág.</span>;
                                            }
                                            // Fallback for MINA_2X1 or MOLINO_ROTATIVO
                                            if (row.estadoAsistencia === 'libre') return <span className="px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[8px] font-bold uppercase">🔄 Libre (pred.)</span>;
                                            return <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[8px] font-bold uppercase">🔄 Labor (pred.)</span>;
                                          })()
                                        )}
                                      </div>
                                    </div>
                                  </button>
                                </td>
                                <td className="px-2 py-3 align-middle text-center">
                                  <NominaNovedadTurnoCell
                                    value={row.novedadTurno}
                                    observacion={row.novedadTurnoObs}
                                    disabled={!canEdit || semanaActualProcesada}
                                    workerName={p.nombre_completo}
                                    onChange={(novedadTurno) =>
                                      handleUpdateRow(p.id, {
                                        novedadTurno,
                                        novedadTurnoObs:
                                          novedadTurno === 'ACTIVO' ? '' : row.novedadTurnoObs,
                                      })
                                    }
                                    onObservacionChange={(novedadTurnoObs) =>
                                      handleUpdateRow(p.id, { novedadTurnoObs })
                                    }
                                  />
                                </td>
                                {/* Attendance Toggles - Turno/Libre/Falta */}
                                <td className={`px-3 py-3 text-center transition-all duration-300 ${activeStep === 1 ? 'bg-amber-500/5 border-x border-amber-500/10' : ''}`}>
                                  <div className="inline-flex p-1 rounded-xl bg-zinc-950/60 border border-zinc-800/50">
                                    <button onClick={() => handleUpdateRow(p.id, { estadoAsistencia: 'trabajada' })} title="Semana Turno Laboral" disabled={semanaActualProcesada}
                                      className={`px-2.5 py-1.5 text-[10px] font-bold uppercase rounded-lg border transition-all flex items-center gap-1 disabled:opacity-45 disabled:cursor-not-allowed ${row.estadoAsistencia === 'trabajada' ? 'bg-amber-500/15 text-amber-400 border-amber-500/30 shadow-md shadow-amber-500/5' : 'border-transparent text-white/40 hover:text-white/70'}`}>
                                      <Hammer className="w-3.5 h-3.5" /> Turno
                                    </button>
                                    <button onClick={() => handleUpdateRow(p.id, { estadoAsistencia: 'libre' })} title="Semana Libre" disabled={semanaActualProcesada}
                                      className={`px-2.5 py-1.5 text-[10px] font-bold uppercase rounded-lg border transition-all flex items-center gap-1 disabled:opacity-45 disabled:cursor-not-allowed ${row.estadoAsistencia === 'libre' ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30 shadow-md shadow-cyan-500/5' : 'border-transparent text-white/40 hover:text-white/70'}`}>
                                      <Umbrella className="w-3.5 h-3.5" /> Libre
                                    </button>
                                    <button onClick={() => handleUpdateRow(p.id, { estadoAsistencia: 'no_laborado' })} title="No laboró" disabled={semanaActualProcesada}
                                      className={`px-2.5 py-1.5 text-[10px] font-bold uppercase rounded-lg border transition-all flex items-center gap-1 disabled:opacity-45 disabled:cursor-not-allowed ${row.estadoAsistencia === 'no_laborado' ? 'bg-red-500/15 text-red-400 border-red-500/30 shadow-md shadow-red-500/5' : 'border-transparent text-white/40 hover:text-white/70'}`}>
                                      <XCircle className="w-3.5 h-3.5" /> Falta
                                    </button>
                                  </div>
                                </td>
                                <td className={`px-3 py-3 text-center transition-all duration-300 ${activeStep === 1 ? 'bg-amber-500/5' : ''}`}>
                                  {!row.diasInputBloqueado && row.estadoAsistencia === 'trabajada' ? (
                                    <div className="inline-flex flex-col items-center gap-1">
                                      <input
                                        type="number"
                                        min={0}
                                        max={NOMINA_DIAS_POR_SEMANA}
                                        step={1}
                                        value={row.diasTrabajados}
                                        disabled={semanaActualProcesada}
                                        onChange={(e) =>
                                          handleUpdateRow(p.id, {
                                            diasTrabajados: Number(e.target.value),
                                          })
                                        }
                                        title={`Días trabajados (0–${NOMINA_DIAS_POR_SEMANA}). El sueldo base se prorratea: (salario semanal ÷ 7) × días.`}
                                        className="w-12 rounded-lg border border-zinc-800 bg-zinc-950/50 px-2 py-1 text-center text-xs font-bold tabular-nums text-white outline-none focus:border-amber-500/50 disabled:opacity-40"
                                      />
                                      <span className="text-[8px] font-medium text-white/35">de {NOMINA_DIAS_POR_SEMANA}</span>
                                    </div>
                                  ) : (
                                    <div className="inline-flex flex-col items-center gap-1 opacity-40">
                                      <span className="text-xs font-bold tabular-nums text-white/60">
                                        {row.estadoAsistencia === 'libre' || row.diasInputBloqueado ? '—' : '0'}
                                      </span>
                                      <span className="text-[8px] font-medium text-white/35">
                                        {row.diasInputBloqueado
                                          ? 'ciclo'
                                          : row.estadoAsistencia === 'libre'
                                            ? 'libre'
                                            : 'falta'}
                                      </span>
                                    </div>
                                  )}
                                </td>
                                {/* Sueldo */}
                                <td className="px-5 py-3 text-right font-sans tabular-nums text-xs text-white/80">
                                  <div className="flex flex-col items-end gap-0.5">
                                    <span>{fmtMoney(row.salarioBaseCalculado)}</span>
                                    {(() => {
                                      const hint = formatProportionalSalarioHint(
                                        calculateWeeklyBaseRate(p, row.estadoAsistencia, weekRange.inicio),
                                        row.diasTrabajados,
                                      );
                                      return hint ? (
                                        <span className="text-[9px] font-medium text-white/35">{hint}</span>
                                      ) : null;
                                    })()}
                                  </div>
                                </td>
                                {/* Bono */}
                                <td className={`px-5 py-3 text-right transition-all duration-300 ${activeStep === 2 ? 'bg-amber-500/5 border-l border-amber-500/10' : ''}`}>
                                  <input type="number" value={row.bonoTransporte || ''} onChange={e => handleUpdateRow(p.id, { bonoTransporte: Number(e.target.value) || 0 })} placeholder="0.00" disabled={semanaActualProcesada || row.diasInputBloqueado} className="w-20 bg-zinc-950/40 border border-zinc-800 hover:border-zinc-700 focus:border-amber-500 text-white rounded-lg px-2.5 py-1 text-right text-xs transition-colors outline-none focus:ring-1 focus:ring-amber-500/50 disabled:opacity-40 disabled:cursor-not-allowed" />
                                </td>
                                {/* Bonificaciones */}
                                <td className={`px-5 py-3 text-right transition-all duration-300 ${activeStep === 2 ? 'bg-amber-500/5' : ''}`}>
                                  <input type="number" value={row.bonificaciones || ''} onChange={e => handleUpdateRow(p.id, { bonificaciones: Number(e.target.value) || 0 })} placeholder="0.00" disabled={semanaActualProcesada || row.diasInputBloqueado} className="w-20 bg-zinc-950/40 border border-zinc-800 hover:border-zinc-700 focus:border-amber-500 text-white rounded-lg px-2.5 py-1 text-right text-xs transition-colors outline-none focus:ring-1 focus:ring-amber-500/50 disabled:opacity-40 disabled:cursor-not-allowed" />
                                </td>
                                {/* Vales Badge */}
                                <td className={`px-5 py-3 text-right transition-all duration-300 ${activeStep === 2 ? 'bg-amber-500/5 border-r border-amber-500/10' : ''}`}>
                                  <button onClick={() => openDrawer(p.id)} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${row.totalVales > 0 ? 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20' : 'bg-zinc-950/40 border-zinc-800 text-white/50 hover:border-zinc-700 hover:text-white/70'}`}>
                                    <FileText className="w-3.5 h-3.5" />
                                    {row.totalVales > 0 ? (
                                      <><span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-500/30 text-[8px] font-black text-red-300">{row.valesPendientes.length}</span> {fmtMoney(row.totalVales)}</>
                                    ) : '0.00'}
                                  </button>
                                </td>
                                {/* Total */}
                                <td className="px-5 py-3 text-right text-xs font-black tabular-nums text-amber-500">{fmtMoney(row.total)}</td>
                                {/* Actions */}
                                <td className="px-5 py-3 text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    <button onClick={() => setSelectedReceipt(row)} title="Ficha" className="p-1.5 rounded-lg hover:bg-white/[0.04] text-white/40 hover:text-white transition-colors"><Receipt className="w-4 h-4" /></button>
                                    {canEdit && !semanaActualProcesada && (
                                      <>
                                        <button onClick={() => openEdit(p)} title="Editar" className="p-1.5 rounded-lg hover:bg-white/[0.04] text-white/40 hover:text-amber-500 transition-colors"><Edit2 className="w-4 h-4" /></button>
                                        <button onClick={() => handleDelete(p.id)} title="Baja" className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/40 hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                          {/* SUBTOTAL FOOTER ROW */}
                          <tr className="bg-zinc-950/60 border-t border-zinc-700/50">
                            <td className="px-5 py-2.5 text-[10px] font-bold text-white/50 uppercase tracking-wider" colSpan={3}>Subtotal {cargoName}</td>
                            <td className="px-5 py-2.5 text-right text-xs font-bold text-white/60 tabular-nums">{fmtMoney(groupSueldo)}</td>
                            <td className="px-5 py-2.5 text-right text-xs font-bold text-white/60 tabular-nums transition-all duration-300 border-l border-amber-500/10">{fmtMoney(groupBono)}</td>
                            <td className="px-5 py-2.5 text-right text-xs font-bold text-white/60 tabular-nums transition-all duration-300">{fmtMoney(groupBonif)}</td>
                            <td className="px-5 py-2.5 text-right text-xs font-bold text-red-400/70 tabular-nums transition-all duration-300 border-r border-amber-500/10">{groupVales > 0 ? `-${fmtMoney(groupVales)}` : '$0.00'}</td>
                            <td className="px-5 py-2.5 text-right text-sm font-black tabular-nums text-amber-500">{fmtMoney(groupTotal)}</td>
                            <td></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })
            )}

            {novedadesTurnoSemana.length > 0 ? (
              <div className="rounded-xl border border-amber-500/15 bg-amber-500/[0.04] px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400/90">
                  Novedades del turno · semana actual
                </p>
                <ul className="mt-2 space-y-1.5">
                  {novedadesTurnoSemana.map((r) => (
                    <li
                      key={r.personal.id}
                      className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-xs text-white/75"
                    >
                      <span className="font-semibold text-white/90">{r.personal.nombre_completo}</span>
                      <span className="text-white/55">
                        {NOVEDAD_TURNO_PREVIEW_LABEL[r.novedadTurno]}
                        {r.novedadTurnoObs.trim() ? ` · ${r.novedadTurnoObs.trim()}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
          </>
            )}
        </div>
        </div>
      </div>

      <NominaMobileDock
        cerrada={semanaActualProcesada}
        canEdit={canEdit}
        hasRows={preNominaRows.length > 0}
        isPending={isPending}
        onCerrar={() => setShowProcesarModal(true)}
        onRevertir={() => semanaActual && handleRevertirSemana(semanaActual)}
        onRegistrar={() => setShowAssignModal(true)}
        onMore={() => setMobileMoreOpen(true)}
      />
      <NominaMobileSemanaSheet
        open={semanaSheetOpen}
        onClose={() => setSemanaSheetOpen(false)}
        cerrada={semanaActualProcesada}
        semanaActual={semanaActual}
        weekRange={weekRange}
        setWeekRange={setWeekRange}
        preNominaCount={preNominaRows.length}
        totalSemana={totalSemana}
        activos={data.length}
        promedio={data.length > 0 ? totalSemana / data.length : 0}
        valesPend={preNominaRows.reduce((s, r) => s + r.totalVales, 0)}
        procesadoOk={procesadoOk}
        semanas={semanas}
        showHistorial={showHistorial}
        setShowHistorial={setShowHistorial}
        canEdit={canEdit}
        isPending={isPending}
        onRevertir={handleRevertirSemana}
        anomalyPct={prevSemana ? weekDeltaPct : null}
        temporalHint={
          weekRange.inicio !== temporalCtx.workingWeekStart
            ? formatTemporalContextHint(temporalCtx)
            : null
        }
        onGoWorkingWeek={() =>
          setWeekRange({
            inicio: temporalCtx.workingWeekStart,
            fin: temporalCtx.workingWeekEnd,
          })
        }
        distribucionPanel={
          activeStep >= 2 || semanaActualProcesada ? (
            <NominaDistribucionPanel
              totalNomina={totalSemana}
              partes={distribucion.partes}
              lineas={distribucion.lineas}
              sumPct={distribucion.sumPct}
              validationOk={distribucion.validation.ok}
              validationMessage={distribucion.validation.message}
              onUpdateParte={distribucion.updateParte}
              onAddParte={distribucion.addParte}
              onRemoveParte={distribucion.removeParte}
              onRebalance={distribucion.rebalanceIgual}
              onSaveDefault={distribucion.saveAsDefault}
              variant="dark"
              compact
              readOnly={semanaActualProcesada}
            />
          ) : undefined
        }
        fmtMoney={fmtMoney}
        fmtDate={fmtDate}
      />
      <NominaMobileMoreSheet
        open={mobileMoreOpen}
        onClose={() => setMobileMoreOpen(false)}
        canEdit={canEdit}
        hasData={data.length > 0}
        onImport={() => setShowImport(true)}
        onArchivo={() => setShowArchivo(true)}
        onPdf={handlePrintReport}
        onCsv={handleExportCSV}
        onExcel={() => {
          setMobileMoreOpen(false);
          setShowExcelPreview(true);
        }}
        onBorrar={() => setShowBorrarModal(true)}
        onInicio={() => router.push('/dashboard')}
      />

      {drawerRow ? (
        <NominaTrabajadorModal
          open={!!drawerPersonalId}
          onClose={() => setDrawerPersonalId(null)}
          row={drawerRow}
          vales={drawerVales}
          historial={drawerHistorial}
          loading={loadingDrawer}
          canEdit={canEdit}
          locked={semanaActualProcesada}
          isPending={isPending}
          newValeMonto={newValeMonto}
          newValeMotivo={newValeMotivo}
          onNewValeMontoChange={setNewValeMonto}
          onNewValeMotivoChange={setNewValeMotivo}
          onAddVale={handleAddVale}
          onDeleteVale={handleDeleteVale}
          onEditPerfil={() => {
            openEdit(drawerRow.personal);
            setDrawerPersonalId(null);
          }}
          onFichaPago={() => {
            setSelectedReceipt(drawerRow);
            setDrawerPersonalId(null);
          }}
          fmtMoney={fmtMoney}
          fmtDate={fmtDate}
          initials={getInitials(drawerRow.personal.nombre_completo)}
          avatarColor={getAvatarColor(drawerRow.personal.cargo)}
        />
      ) : null}

      <PersonalQuickAssignModal
        open={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        area={area}
        masterCatalog={masterCatalog}
        assignedIds={assignedIds}
        onAssigned={() => router.refresh()}
      />

      <NominaVistaPreviaModal
        open={showExcelPreview}
        onClose={() => {
          setShowExcelPreview(false);
          setPreviewInitialRange(null);
        }}
        initialRange={previewInitialRange}
        refreshKey={previewRefreshKey}
        activeWeek={
          weekRange.inicio
            ? { semana_inicio: weekRange.inicio, semana_fin: weekRange.fin }
            : undefined
        }
        activeRegistros={preNominaRows.map((row) => ({
          personal_id: row.personal.id,
          semana_inicio: weekRange.inicio,
          area: area,
          monto_pagado: row.total,
          es_semana_libre: row.esSemanaLibre,
          estado_asistencia: row.estadoAsistencia,
          dias_trabajados: row.diasTrabajados,
          salario_base_calculado: row.salarioBaseCalculado,
          novedad_turno: row.novedadTurno ? JSON.stringify(row.novedadTurno) : null,
          novedad_turno_obs: row.novedadTurnoObs,
          personal_snapshot: buildPersonalSnapshot(row.personal),
          periodo_id: null,
        }))}
      />

      <NominaArchivoModal
        open={showArchivo}
        onClose={() => setShowArchivo(false)}
        userId={user?.id}
        refreshKey={archivoRefreshKey}
        onImport={() => {
          setShowArchivo(false);
          setShowImport(true);
        }}
        onPeriodDeleted={() => {
          setArchivoRefreshKey((k) => k + 1);
          setPreviewRefreshKey((k) => k + 1);
        }}
      />

      <PageFormModal
        open={showModal}
        onClose={() => setShowModal(false)}
        sheetTitle={editItem ? 'Editar Trabajador' : 'Registrar Nuevo Trabajador'}
        sheetIcon={<SheetIconBadge icon={Users} tone="success" />}
        panelClassName="sm:max-w-xl"
      >
            <button type="button" onClick={() => setShowModal(false)} className="absolute right-5 top-5 hidden rounded-lg p-1.5 text-white/40 transition-colors hover:bg-white/[0.06] hover:text-white lg:flex sm:right-6 sm:top-6" aria-label="Cerrar"><X className="w-5 h-5" /></button>
            <h3 className="page-form-modal-title hidden pr-10 text-xl font-bold tracking-wide text-white/90 lg:block">{editItem ? 'Editar Trabajador' : 'Registrar Nuevo Trabajador'}</h3>
            {formError && <p className="text-red-400 text-xs mb-4 bg-red-500/10 p-2.5 rounded-xl border border-red-500/20">{formError}</p>}
            <div className="flex border-b border-zinc-800 mb-5">
              <button onClick={() => setActiveTab('primario')} className={`pb-2.5 px-4 text-xs font-bold tracking-wider uppercase border-b-2 transition-all ${activeTab === 'primario' ? 'border-amber-500 text-amber-500' : 'border-transparent text-white/45'}`}>Datos</button>
              <button onClick={() => setActiveTab('esquema')} className={`pb-2.5 px-4 text-xs font-bold tracking-wider uppercase border-b-2 transition-all ${activeTab === 'esquema' ? 'border-amber-500 text-amber-500' : 'border-transparent text-white/45'}`}>Esquema & Rotación</button>
            </div>
            <div className="space-y-4">
              {activeTab === 'primario' ? (
                <>
                  <div className="space-y-1"><label className="input-label">Nombre Completo</label><input type="text" placeholder="Ej: Márquez Pedro" value={form.nombre_completo} onChange={e => setForm({...form, nombre_completo: e.target.value})} className="input-field" /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1"><label className="input-label">Cédula</label><input type="text" placeholder="9933498" value={form.cedula} onChange={e => setForm({...form, cedula: e.target.value})} className="input-field" /></div>
                    <div className="space-y-1"><label className="input-label">Cargo</label><input type="text" placeholder="Vertical 1PD" value={form.cargo} onChange={e => setForm({...form, cargo: e.target.value})} className="input-field" /></div>
                  </div>
                  <div className="space-y-1">
                    <label className="input-label">Asignación (Vertical / Sector)</label>
                    <AppSelect
                      value={form.area_detalle}
                      onChange={(val) => setForm({ ...form, area_detalle: val })}
                      options={ASIGNACION_NOMINA_OPCIONES.map((value) => ({ value, label: value }))}
                      placeholder="Seleccionar vertical/sector"
                    />
                  </div>
                  <div className="space-y-1"><label className="input-label">Salario Labor Semanal ($)</label><input type="number" placeholder="150.00" value={form.salario_base} onChange={e => setForm({...form, salario_base: e.target.value})} className="input-field" /></div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1"><label className="input-label">Sueldo Libre ($)</label><input type="number" placeholder="100" value={form.salario_libre} onChange={e => setForm({...form, salario_libre: e.target.value})} className="input-field" /></div>
                    <div className="space-y-1"><label className="input-label">Bono Transporte ($)</label><input type="number" placeholder="30" value={form.bono_transporte} onChange={e => setForm({...form, bono_transporte: e.target.value})} className="input-field" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1"><label className="input-label">Teléfono</label><input type="text" placeholder="0414-1234567" value={form.telefono} onChange={e => setForm({...form, telefono: e.target.value})} className="input-field" /></div>
                    <div className="space-y-1"><label className="input-label">Fecha Ingreso</label><input type="date" value={form.fecha_ingreso} onChange={e => setForm({...form, fecha_ingreso: e.target.value})} className="input-field" /></div>
                  </div>
                  <div className="pt-3 border-t border-zinc-800 space-y-3">
                    <div className="flex items-center gap-2"><RotateCcw className="w-3.5 h-3.5 text-cyan-400" /><label className="input-label !mb-0">Esquema de Rotación</label></div>
                    <AppSelect
                      value={form.esquema_rotacion}
                      onChange={(val) => setForm({ ...form, esquema_rotacion: val as Personal['esquema_rotacion'] })}
                      options={esquemaOpciones.map((code) => ({
                        value: code,
                        label: biblioteca.esquemaLabels[code] || code,
                      }))}
                    />
                    {(form.esquema_rotacion === 'MINA_2X1' || form.esquema_rotacion === 'MOLINO_ROTATIVO' || form.esquema_rotacion === 'MINA_ROTATIVA_3G' || form.esquema_rotacion === 'MOLINO_15X15') && (
                      <div className="space-y-1"><label className="input-label">Fecha Inicio Ciclo</label><input type="date" value={form.rotacion_inicio_fecha} onChange={e => setForm({...form, rotacion_inicio_fecha: e.target.value})} className="input-field" /><p className="text-[10px] text-white/30">Primera semana laboral del trabajador.</p></div>
                    )}
                  </div>
                  <div className="space-y-1"><label className="input-label">Notas</label><textarea placeholder="Observaciones..." value={form.notas} onChange={e => setForm({...form, notas: e.target.value})} className="input-field h-20 resize-none text-xs" /></div>
                </>
              )}
            </div>
            <PageFormModalFooter className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
              <button type="button" onClick={handleSave} disabled={isPending} className="btn-primary min-w-[110px] justify-center">{isPending ? 'Guardando...' : 'Guardar'}</button>
            </PageFormModalFooter>
      </PageFormModal>

      <PageFormModal
        open={showProcesarModal}
        onClose={() => setShowProcesarModal(false)}
        sheetTitle="Consola de Cierre"
        sheetIcon={<SheetIconBadge icon={Wallet} tone="warn" />}
        panelClassName="sm:max-w-lg"
      >
            <button type="button" onClick={() => setShowProcesarModal(false)} className="absolute right-5 top-5 hidden rounded-lg p-1.5 text-white/40 hover:text-white lg:flex sm:right-6 sm:top-6" aria-label="Cerrar"><X className="w-5 h-5" /></button>
            <h3 className="page-form-modal-title mb-2 hidden items-center gap-2 pr-10 text-lg font-semibold text-white/90 lg:flex"><Wallet className="w-5 h-5 text-amber-500" /> Consola de Cierre</h3>
            <p className="text-xs text-white/40 mb-6 uppercase tracking-wider">Rango de nómina semanal</p>
            <div className="flex items-center gap-3 mb-6">
              <div className="flex-1"><label className="input-label">Inicio</label><input type="date" value={weekRange.inicio} onChange={e => setWeekRange({...weekRange, inicio: e.target.value})} className="input-field" /></div>
              <span className="text-white/40 self-end mb-3">a</span>
              <div className="flex-1"><label className="input-label">Fin</label><input type="date" value={weekRange.fin} onChange={e => setWeekRange({...weekRange, fin: e.target.value})} className="input-field" /></div>
            </div>
            <p className="mb-4 text-[10px] text-white/40 uppercase tracking-wider">
              {preNominaRows.length} trabajadores · {preNominaRows.filter((r) => r.totalVales > 0).length} con vales
            </p>
            <NominaDistribucionPanel
              totalNomina={totalSemana}
              partes={distribucion.partes}
              lineas={distribucion.lineas}
              sumPct={distribucion.sumPct}
              validationOk={distribucion.validation.ok}
              validationMessage={distribucion.validation.message}
              onUpdateParte={distribucion.updateParte}
              onAddParte={distribucion.addParte}
              onRemoveParte={distribucion.removeParte}
              onRebalance={distribucion.rebalanceIgual}
              onSaveDefault={distribucion.saveAsDefault}
              variant="dark"
            />
            <PageFormModalFooter className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setShowProcesarModal(false)} className="btn-secondary">Cancelar</button>
              <button type="button" onClick={handleProcesarNomina} disabled={isPending} className="btn-primary min-w-[110px] justify-center">{isPending ? 'Procesando...' : 'Confirmar Cierre'}</button>
            </PageFormModalFooter>
      </PageFormModal>

      <NominaImportModal
        open={showImport}
        onClose={() => setShowImport(false)}
        area={area}
        data={data}
        weekStart={weekRange.inicio}
        canEdit={canEdit}
        onWeekDetected={(inicio, fin) => setWeekRange({ inicio, fin })}
        onImported={handleNominaImported}
      />

      <PageFormModal
        open={showBorrarModal}
        onClose={() => setShowBorrarModal(false)}
        sheetTitle="¿Dar de baja todo?"
        sheetIcon={<SheetIconBadge icon={AlertTriangle} tone="danger" />}
        panelClassName="max-w-sm text-center"
      >
            <AlertTriangle className="mx-auto mb-4 h-12 w-12 animate-bounce text-red-500" />
            <h3 className="page-form-modal-title mb-2 hidden text-lg font-bold lg:block">¿Dar de baja todo?</h3>
            <p className="mb-6 text-xs text-white/50">{data.length} trabajadores de {area.toUpperCase()} serán desactivados.</p>
            <PageFormModalFooter className="flex gap-3">
              <button type="button" onClick={() => setShowBorrarModal(false)} className="btn-secondary flex-1 py-2.5 text-xs font-bold">Cancelar</button>
              <button type="button" onClick={handleBorrarTodo} disabled={isPending} className="flex h-10 flex-1 items-center justify-center rounded-lg bg-red-600 px-4 text-xs font-bold text-white transition-colors hover:bg-red-500 disabled:opacity-40">{isPending ? 'Procesando...' : 'Dar de baja'}</button>
            </PageFormModalFooter>
      </PageFormModal>

      {selectedReceipt ? (
      <PageFormModal open onClose={() => setSelectedReceipt(null)} panelClassName="max-w-md">
          <style>{`@media print{body *{visibility:hidden}#printable-receipt-card,#printable-receipt-card *{visibility:visible}#printable-receipt-card{position:absolute;left:0;top:0;width:100%;color:black!important;background:white!important;border:0!important;box-shadow:none!important}#receipt-buttons-bar{display:none!important}#printable-receipt-card button{display:none!important}#printable-receipt-card *{color:black!important}}`}</style>
          <div id="printable-receipt-card" className="text-white">
            <div className="text-center pb-4 border-b border-dashed border-white/10">
              <h2 className="text-sm font-bold tracking-wider uppercase">MOLINOS LA FÉ - MINA BELÉN</h2>
              <p className="text-[9px] text-white/35 tracking-widest uppercase mt-0.5">COMPLEJO OPERATIVO EL CALLAO, BOLÍVAR</p>
              <p className="text-[10px] text-amber-500 font-bold tracking-wider mt-2 uppercase">VOUCHER DE NÓMINA SEMANAL</p>
            </div>
            <div className="py-4 space-y-2 border-b border-dashed border-white/10 text-xs">
              <div className="flex justify-between"><span className="text-white/40">Trabajador:</span><span className="font-bold text-white/95">{selectedReceipt.personal.nombre_completo}</span></div>
              <div className="flex justify-between"><span className="text-white/40">C.I.:</span><span className="text-white/95">{selectedReceipt.personal.cedula}</span></div>
              <div className="flex justify-between"><span className="text-white/40">Cargo:</span><span className="text-white/95">{selectedReceipt.personal.cargo}</span></div>
              <div className="flex justify-between"><span className="text-white/40">Periodo:</span><span className="text-white/95">{fmtDate(weekRange.inicio)} al {fmtDate(weekRange.fin)}</span></div>
              <div className="flex justify-between"><span className="text-white/40">Asistencia:</span><span className="font-bold text-amber-500 uppercase">{selectedReceipt.estadoAsistencia}</span></div>
            </div>
            <div className="py-4 space-y-2 border-b border-dashed border-white/10 text-xs">
              <div className="flex justify-between"><span className="text-white/40">Días trabajados:</span><span className="font-bold text-amber-500">{selectedReceipt.diasTrabajados} / {NOMINA_DIAS_POR_SEMANA}</span></div>
              <div className="flex justify-between"><span className="text-white/40">Sueldo:</span><span className="text-white/95 font-semibold tabular-nums">{fmtMoney(selectedReceipt.salarioBaseCalculado)}</span></div>
              <div className="flex justify-between"><span className="text-white/40">Bono Transporte:</span><span className="text-emerald-400 font-semibold tabular-nums">+{fmtMoney(selectedReceipt.bonoTransporte)}</span></div>
              <div className="flex justify-between"><span className="text-white/40">Bonificaciones:</span><span className="text-emerald-400 font-semibold tabular-nums">+{fmtMoney(selectedReceipt.bonificaciones)}</span></div>
              <div className="flex justify-between"><span className="text-white/40">Vales/Adelantos:</span><span className="text-red-400 font-semibold tabular-nums">-{fmtMoney(selectedReceipt.totalVales)}</span></div>
              {selectedReceipt.valesPendientes.length > 0 && (<div className="pl-4 space-y-1 pt-1">{selectedReceipt.valesPendientes.map(v => (<div key={v.id} className="flex justify-between text-[10px] text-white/30"><span>→ {v.motivo || 'Adelanto'} ({fmtDate(v.fecha)})</span><span className="tabular-nums">-{fmtMoney(Number(v.monto))}</span></div>))}</div>)}
            </div>
            <div className="py-4 flex justify-between items-center border-b border-dashed border-white/10">
              <span className="font-bold text-white/50 tracking-wider text-sm">TOTAL NETO:</span>
              <span className="text-xl font-black text-amber-500 tabular-nums">{fmtMoney(selectedReceipt.total)}</span>
            </div>
            <div className="grid grid-cols-2 gap-6 pt-6 pb-2 text-[8px] uppercase tracking-widest text-center text-white/35">
              <div className="border-t border-white/10 pt-4 flex flex-col gap-1"><span>Pedro G. / Darinel R.</span><span>ADMINISTRACIÓN</span></div>
              <div className="border-t border-white/10 pt-4 flex flex-col gap-1"><span>{selectedReceipt.personal.nombre_completo.split(' ')[1] || 'Trabajador'}</span><span>FIRMA CONFORME</span></div>
            </div>
            <div id="receipt-buttons-bar">
            <PageFormModalFooter className="mt-6 flex gap-2">
              <button type="button" onClick={() => setSelectedReceipt(null)} className="btn-secondary flex h-10 flex-1 items-center justify-center gap-1.5 text-xs font-bold"><X className="w-3.5 h-3.5" /> Cerrar</button>
              <button type="button" onClick={() => copyReceiptToClipboard(selectedReceipt)} className="btn-secondary flex h-10 flex-1 items-center justify-center gap-1.5 text-xs font-bold">
                {copiedReceipt ? <><Check className="w-3.5 h-3.5 text-emerald-400" /> ¡Copiado!</> : <><Copy className="w-3.5 h-3.5" /> WhatsApp</>}
              </button>
              <button type="button" onClick={() => window.print()} className="btn-primary flex h-10 flex-1 items-center justify-center gap-1.5 text-xs font-bold"><Printer className="w-3.5 h-3.5" /> Imprimir</button>
            </PageFormModalFooter>
            </div>
          </div>
      </PageFormModal>
      ) : null}
    </div>
  );
}
