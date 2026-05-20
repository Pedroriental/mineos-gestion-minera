'use client';

import { useState, useTransition, useMemo, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useCanEdit } from '@/lib/use-can-edit';
import { 
  Pickaxe, Upload, RefreshCw, Plus, Trash2, Loader2, Calendar, 
  Clock, ChevronDown, ChevronUp, CheckCircle2, AlertTriangle, 
  Search, Factory, Shield, Truck, Briefcase, Edit2, Receipt, 
  Printer, X, Users, Wallet, ChevronRight, FileText, Download,
  DollarSign, TrendingUp, TrendingDown, RotateCcw, Clipboard,
  Hammer, Umbrella, XCircle, History, Copy, Check
} from 'lucide-react';

import type { Personal, NominaSemana, NominaVale, HistorialPagoRow, TendenciaSemanalRow } from '@/lib/types';
import type { EmpleadoParseado } from '@/lib/parse-nomina-file';

import { 
  revertirSemanaAction,
  borrarTodoPersonalArea
} from '@/lib/actions/nomina';

import {
  updatePersonalEstatusAction
} from '@/lib/actions/nomina-v2';

import {
  upsertPersonalV3Action,
  procesarCierreNominaV3Action,
  getValesPendientesBulkAction,
  crearValeAction,
  eliminarValeAction,
  getHistorialPagosAction,
  getTendenciaSemanalAction,
  registrarAuditAction,
} from '@/lib/actions/nomina-v3';

// ── Helpers ────────────────────────────────────────────────────────────────────
function getWeekStart(d = new Date()): string {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  return date.toISOString().split('T')[0];
}

function getWeekEnd(d = new Date()): string {
  const start = new Date(getWeekStart(d));
  start.setDate(start.getDate() + 6);
  return start.toISOString().split('T')[0];
}

function fmtDate(iso: string): string {
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

// ── Sparkline SVG Component ────────────────────────────────────────────────
function Sparkline({ data, width = 120, height = 32, color = '#f59e0b' }: { 
  data: number[]; width?: number; height?: number; color?: string 
}) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padding = 2;
  const usableW = width - padding * 2;
  const usableH = height - padding * 2;

  const points = data.map((val, i) => {
    const x = padding + (i / (data.length - 1)) * usableW;
    const y = padding + usableH - ((val - min) / range) * usableH;
    return `${x},${y}`;
  });

  const trend = data[data.length - 1] >= data[0];

  return (
    <svg width={width} height={height} className="inline-block">
      <defs>
        <linearGradient id={`sparkGrad-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Area fill */}
      <polygon
        points={`${padding},${padding + usableH} ${points.join(' ')} ${padding + usableW},${padding + usableH}`}
        fill={`url(#sparkGrad-${color.replace('#','')})`}
      />
      {/* Line */}
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* End dot */}
      {data.length > 0 && (
        <circle
          cx={padding + usableW}
          cy={padding + usableH - ((data[data.length - 1] - min) / range) * usableH}
          r="2.5"
          fill={color}
        />
      )}
    </svg>
  );
}

// ── Rotation Prediction Engine ─────────────────────────────────────────────
function calculateExpectedAttendance(
  esquema: string,
  rotacionInicio: string | undefined | null,
  weekStartStr: string
): 'trabajada' | 'libre' | 'no_laborado' {
  if (!rotacionInicio || esquema === 'FIJO_SEMANAL' || esquema === 'MOLINO_FIJO') {
    return 'trabajada';
  }
  const startDate = new Date(rotacionInicio);
  const weekStart = new Date(weekStartStr);
  const diffMs = weekStart.getTime() - startDate.getTime();
  const diffWeeks = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));

  if (esquema === 'MINA_2X1') {
    const position = ((diffWeeks % 3) + 3) % 3;
    return position === 2 ? 'libre' : 'trabajada';
  }
  if (esquema === 'MOLINO_ROTATIVO') {
    const position = ((diffWeeks % 2) + 2) % 2;
    return position === 1 ? 'libre' : 'trabajada';
  }
  if (esquema === 'MINA_ROTATIVA_3G') {
    const position = ((diffWeeks % 3) + 3) % 3;
    return position === 2 ? 'libre' : 'trabajada';
  }
  if (esquema === 'MOLINO_15X15') {
    const position = ((diffWeeks % 4) + 4) % 4;
    if (position === 2) return 'libre';
    if (position === 3) return 'no_laborado';
    return 'trabajada';
  }
  return 'trabajada';
}

// Predict next N weeks of rotation for calendar
function predictRotationCalendar(
  esquema: string,
  rotacionInicio: string | undefined | null,
  weekStartStr: string,
  numWeeks = 4
): Array<{ weekStart: string; status: 'trabajada' | 'libre' | 'no_laborado' }> {
  const results: Array<{ weekStart: string; status: 'trabajada' | 'libre' | 'no_laborado' }> = [];
  const base = new Date(weekStartStr);
  for (let i = 0; i < numWeeks; i++) {
    const ws = new Date(base);
    ws.setDate(ws.getDate() + i * 7);
    const wsStr = ws.toISOString().split('T')[0];
    results.push({
      weekStart: wsStr,
      status: calculateExpectedAttendance(esquema, rotacionInicio, wsStr),
    });
  }
  return results;
}

const ESQUEMA_LABELS: Record<string, string> = {
  'FIJO_SEMANAL': 'Fijo Semanal',
  'MINA_2X1': 'Mina 2×1 (2 labor, 1 libre)',
  'MOLINO_FIJO': 'Molino Fijo (trabaja siempre)',
  'MOLINO_ROTATIVO': 'Molino Rotativo (1×1)',
  'MINA_ROTATIVA_3G': 'Mina Rotativa 3G (1 Noche, 1 Día, 1 Libre)',
  'MOLINO_15X15': 'Molino 15x15 (2 labor, 1 libre pagada, 1 libre no pagada)',
};

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
  if (position === 0) return 'Labor (Vuelta - Paga Doble)';
  if (position === 1) return 'Labor (Salida + Bono)';
  if (position === 2) return 'Libre Pagada (Diferida)';
  return 'Libre No Pagada';
}

function calculateDefaultBaseSal(
  p: Personal,
  estadoAsistencia: string,
  weekStartStr: string
): number {
  if (p.esquema_rotacion === 'MOLINO_15X15') {
    if (!p.rotacion_inicio_fecha) {
      return estadoAsistencia === 'no_laborado' ? 0 : Number(p.salario_base);
    }
    const startDate = new Date(p.rotacion_inicio_fecha);
    const weekStart = new Date(weekStartStr);
    const diffMs = weekStart.getTime() - startDate.getTime();
    const diffWeeks = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));
    const position = ((diffWeeks % 4) + 4) % 4;

    if (estadoAsistencia === 'trabajada') {
      return position === 0 ? Number(p.salario_base) * 2 : Number(p.salario_base);
    }
    return 0;
  }
  if (estadoAsistencia === 'no_laborado') return 0;
  return Number(p.salario_base);
}

// ── Types ────────────────────────────────────────────────────────────────────
interface NominaClientProps {
  data: Personal[];
  semanas: NominaSemana[];
  area: 'administracion' | 'mina' | 'planta' | 'seguridad' | 'transporte';
}

interface PreNominaRowState {
  personal: Personal;
  esSemanaLibre: boolean;
  bonoTransporte: number;
  bonificaciones: number;
  deducciones: number;
  total: number;
  estadoAsistencia: 'trabajada' | 'libre' | 'no_laborado';
  valesPendientes: NominaVale[];
  totalVales: number;
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
export default function NominaClient({ data, semanas, area }: NominaClientProps) {
  const { user } = useAuth();
  const canEdit = useCanEdit();
  const [isPending, startTransition] = useTransition();

  // State
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'primario' | 'esquema'>('primario');
  const [showModal, setShowModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
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
  const [newValeMonto, setNewValeMonto] = useState('');
  const [newValeMotivo, setNewValeMotivo] = useState('');
  const [drawerTab, setDrawerTab] = useState<'vales' | 'historial' | 'rotacion'>('vales');

  // Paso activo del flujo guiado (Nómina 2.0)
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);

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

  const [weekRange, setWeekRange] = useState({ inicio: getWeekStart(), fin: getWeekEnd() });
  const [procesadoOk, setProcesadoOk] = useState<string | null>(null);
  const [partnerSplits] = useState({ pctPedro: 33.33, pctDarinel: 33.33, pctLaFe: 33.34 });
  const [partnerGastos, setPartnerGastos] = useState({ gastoPedro: 0, gastoDarinel: 0, gastoLaFe: 0 });

  // Import
  const [importTab, setImportTab] = useState<'excel' | 'pdf'>('excel');
  const [parsedEmps, setParsedEmps] = useState<EmpleadoParseado[]>([]);
  const [importingState, setImportingState] = useState(false);
  const [importResult, setImportResult] = useState<{ nuevos: number; actualizados: number } | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

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
      const personalIds = data.map(p => p.id);
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

      const currentWeekStart = weekRange.inicio;
      const rows = data.map((p) => {
        const predicted = calculateExpectedAttendance(p.esquema_rotacion, p.rotacion_inicio_fecha, currentWeekStart);
        const workerVales = valesMap[p.id] || [];
        const totalVales = workerVales.reduce((s, v) => s + Number(v.monto), 0);
        
        const baseSal = calculateDefaultBaseSal(p, predicted, currentWeekStart);

        // Bono de transporte:
        // Si es Molino 15x15 y está en la semana de salida a libre (posición 1):
        // Se le asigna el bonoTransporte configurado de forma automática.
        // En cualquier otro caso, se asigna 0 por defecto.
        let transport = 0;
        if (p.esquema_rotacion === 'MOLINO_15X15' && p.rotacion_inicio_fecha) {
          const startDate = new Date(p.rotacion_inicio_fecha);
          const weekStart = new Date(currentWeekStart);
          const diffMs = weekStart.getTime() - startDate.getTime();
          const diffWeeks = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));
          const position = ((diffWeeks % 4) + 4) % 4;
          if (position === 1 && predicted === 'trabajada') {
            transport = Number(p.bono_transporte) || 0;
          }
        }

        return {
          personal: p,
          esSemanaLibre: predicted === 'libre',
          bonoTransporte: transport,
          bonificaciones: 0,
          deducciones: totalVales,
          total: baseSal + transport - totalVales,
          estadoAsistencia: predicted,
          valesPendientes: workerVales,
          totalVales,
        };
      });
      setPreNominaRows(rows);
    };
    initRows();
  }, [data, weekRange.inicio]);

  // ── Live Calculation Engine ──────────────────────────────────────────────
  const handleUpdateRow = (personalId: string, fields: Partial<PreNominaRowState>) => {
    setPreNominaRows((prev) =>
      prev.map((row) => {
        if (row.personal.id !== personalId) return row;
        const nextRow = { ...row, ...fields };
        
        const baseSal = calculateDefaultBaseSal(nextRow.personal, nextRow.estadoAsistencia, weekRange.inicio);

        const transport = nextRow.bonoTransporte;

        const total = baseSal + transport + nextRow.bonificaciones - nextRow.totalVales;
        return {
          ...nextRow,
          bonoTransporte: transport,
          esSemanaLibre: nextRow.estadoAsistencia === 'libre',
          deducciones: nextRow.totalVales,
          total,
        };
      })
    );
  };

  const totalSemana = useMemo(() => preNominaRows.reduce((s, r) => s + r.total, 0), [preNominaRows]);
  const semanaActual = semanas.find((r) => r.semana_inicio === getWeekStart());
  const semanaActualProcesada = !!semanaActual;

  // Week-over-week comparison
  const prevSemana = semanas.length >= 2 ? semanas.find(s => s.semana_inicio !== getWeekStart()) : null;
  const weekDelta = prevSemana ? totalSemana - Number(prevSemana.total_pagado) : 0;
  const weekDeltaPct = prevSemana && Number(prevSemana.total_pagado) > 0
    ? ((weekDelta / Number(prevSemana.total_pagado)) * 100)
    : 0;

  const IconComponent = ICONS[area];
  const pageTitle = TITLES[area];

  // Filter & Group
  const filteredRows = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return preNominaRows;
    return preNominaRows.filter(r => r.personal.nombre_completo.toLowerCase().includes(q) || (r.personal.cedula && r.personal.cedula.includes(q)));
  }, [preNominaRows, search]);

  const groupedRows = useMemo(() => {
    const groups: Record<string, PreNominaRowState[]> = {};
    filteredRows.forEach(row => {
      const cargo = row.personal.cargo || 'General';
      if (!groups[cargo]) groups[cargo] = [];
      groups[cargo].push(row);
    });
    return groups;
  }, [filteredRows]);

  // ── CSV Export ──────────────────────────────────────────────────────────
  const handleExportCSV = useCallback(() => {
    const headers = ['Nombre','Cédula','Cargo','Estado','Sueldo Base','Bono Trans.','Bonos','Vales','Total Neto'];
    const csvRows = [headers.join(',')];
    preNominaRows.forEach(row => {
      const p = row.personal;
      const baseSal = calculateDefaultBaseSal(p, row.estadoAsistencia, weekRange.inicio);
      csvRows.push([`"${p.nombre_completo}"`, p.cedula, `"${p.cargo}"`, row.estadoAsistencia, baseSal.toFixed(2), row.bonoTransporte.toFixed(2), row.bonificaciones.toFixed(2), row.totalVales.toFixed(2), row.total.toFixed(2)].join(','));
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
      const baseSal = calculateDefaultBaseSal(p, row.estadoAsistencia, weekRange.inicio);
    const text = [
      `📋 *COMPROBANTE DE PAGO*`,
      `━━━━━━━━━━━━━━━━━━`,
      `👷 *${p.nombre_completo}*`,
      `📄 C.I. ${p.cedula}`,
      `🏗 Cargo: ${p.cargo}`,
      `📅 Periodo: ${fmtDate(weekRange.inicio)} al ${fmtDate(weekRange.fin)}`,
      ``,
      `💰 Sueldo ${row.estadoAsistencia === 'libre' ? 'Libre' : 'Labor'}: ${fmtMoney(baseSal)}`,
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
    setDrawerTab('vales');
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
      setPreNominaRows(prev => prev.map(row => {
        if (row.personal.id !== drawerPersonalId) return row;
        const baseSal = calculateDefaultBaseSal(row.personal, row.estadoAsistencia, weekRange.inicio);
        return { ...row, valesPendientes: newVales, totalVales, deducciones: totalVales, total: baseSal + row.bonoTransporte + row.bonificaciones - totalVales };
      }));
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
      setPreNominaRows(prev => prev.map(row => {
        if (row.personal.id !== drawerPersonalId) return row;
        const baseSal = calculateDefaultBaseSal(row.personal, row.estadoAsistencia, weekRange.inicio);
        return { ...row, valesPendientes: newVales, totalVales, deducciones: totalVales, total: baseSal + row.bonoTransporte + row.bonificaciones - totalVales };
      }));
    });
  }, [drawerPersonalId, startTransition, user, weekRange.inicio]);

  const drawerRow = useMemo(() => {
    if (!drawerPersonalId) return null;
    return preNominaRows.find(r => r.personal.id === drawerPersonalId) || null;
  }, [drawerPersonalId, preNominaRows]);

  // ── Actions ────────────────────────────────────────────────────────────
  function openEdit(item: Personal) {
    setEditItem(item);
    setForm({
      cedula: item.cedula, nombre_completo: item.nombre_completo, cargo: item.cargo,
      area: item.area as typeof area, area_detalle: item.area_detalle || '',
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
        cargo: form.cargo, area, area_detalle: form.area_detalle || form.cargo,
        salario_base: Number(form.salario_base) || 0, salario_libre: Number(form.salario_libre) || 0,
        bono_transporte: Number(form.bono_transporte) || 0, telefono: form.telefono, notas: form.notas,
        fecha_ingreso: form.fecha_ingreso, esquema_rotacion: form.esquema_rotacion,
        rotacion_inicio_fecha: form.rotacion_inicio_fecha,
      });
      if (res.ok) {
        await registrarAuditAction(editItem ? 'EDITAR_PERSONAL' : 'CREAR_PERSONAL', 'personal', editItem?.id || form.cedula, `${form.nombre_completo} - ${form.cargo}`, user?.id, user?.email);
        setShowModal(false); resetForm();
      } else setFormError(res.message);
    });
  }

  function handleDelete(id: string) {
    if (!confirm('¿Desactivar este trabajador del sistema?')) return;
    startTransition(async () => {
      await updatePersonalEstatusAction(id, 'INACTIVO');
      await registrarAuditAction('DESACTIVAR_PERSONAL', 'personal', id, `Desactivado por ${user?.email}`, user?.id, user?.email);
    });
  }

  function handleProcesarNomina() {
    if (preNominaRows.length === 0) return alert('No hay trabajadores activos.');
    if (semanaActual && !confirm('La semana ya fue procesada. ¿Deseas sobreescribirla?')) return;
    setProcesadoOk(null);
    startTransition(async () => {
      const formattedRows = preNominaRows.map(r => ({ personal: r.personal, esSemanaLibre: r.esSemanaLibre, bonoTransporte: r.bonoTransporte, total: r.total }));
      const res = await procesarCierreNominaV3Action({
        userId: user?.id || '', area, inicio: weekRange.inicio, fin: weekRange.fin, rows: formattedRows,
        pctPedro: partnerSplits.pctPedro, pctDarinel: partnerSplits.pctDarinel, pctLaFe: partnerSplits.pctLaFe,
        gastoPedro: partnerGastos.gastoPedro, gastoDarinel: partnerGastos.gastoDarinel, gastoLaFe: partnerGastos.gastoLaFe,
      });
      if (res.ok) {
        await registrarAuditAction('CERRAR_NOMINA', 'nomina_semanas', area, `${weekRange.inicio} a ${weekRange.fin} - ${preNominaRows.length} trabajadores - Total: $${totalSemana.toFixed(2)}`, user?.id, user?.email);
        setProcesadoOk(`✓ ${res.message}`); setShowProcesarModal(false);
      } else alert(res.message);
    });
  }

  function handleRevertirSemana(sem: NominaSemana) {
    if (!confirm(`⚠ ¿Revertir la nómina del ${fmtDate(sem.semana_inicio)} al ${fmtDate(sem.semana_fin)}?`)) return;
    startTransition(async () => {
      const res = await revertirSemanaAction(sem);
      if (res.ok) {
        await registrarAuditAction('REVERTIR_NOMINA', 'nomina_semanas', sem.id, `Revertida: ${fmtDate(sem.semana_inicio)} a ${fmtDate(sem.semana_fin)}`, user?.id, user?.email);
      } else alert(sem.notas || 'Error al revertir');
    });
  }

  function handleBorrarTodo() {
    startTransition(async () => {
      const res = await borrarTodoPersonalArea(area);
      if (res.ok) {
        await registrarAuditAction('BORRAR_TODO_PERSONAL', 'personal', area, `Todos los trabajadores de ${area} desactivados`, user?.id, user?.email);
        setShowBorrarModal(false);
      } else alert(res.message);
    });
  }

  // ── Import ──────────────────────────────────────────────────────────────
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(null); setParsedEmps([]); setImportingState(true);
    try {
      if (importTab === 'excel') {
        const { parseExcelNomina, detectWeekRangeFromExcel } = await import('@/lib/parse-nomina-file');
        const XLSX = await import('xlsx');
        const arrayBuffer = await file.arrayBuffer();
        const wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: false });
        const detected = detectWeekRangeFromExcel(wb);
        if (detected.inicio && detected.fin) setWeekRange({ inicio: detected.inicio, fin: detected.fin });
        const all = await parseExcelNomina(file, weekRange.inicio || undefined);
        const emps = all.filter(e => e.area === area);
        if (emps.length === 0) setParseError(`No se detectaron empleados de ${area}.`);
        else setParsedEmps(emps);
      } else {
        const { parsePdfNomina, detectWeekRange } = await import('@/lib/parse-nomina-file');
        const pdfjsLib = await import('pdfjs-dist');
        (pdfjsLib as any).GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
        const ab = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
        let textForDetection = '';
        for (let pg = 1; pg <= Math.min(2, pdf.numPages); pg++) {
          const page = await pdf.getPage(pg);
          const content = await page.getTextContent();
          textForDetection += content.items.map((it) => ('str' in it ? it.str : '')).join(' ') + '\n';
        }
        const detected = detectWeekRange(textForDetection);
        if (detected.inicio && detected.fin) setWeekRange({ inicio: detected.inicio, fin: detected.fin });
        const all = await parsePdfNomina(file, weekRange.inicio || undefined);
        const emps = all.filter(e => e.area === area);
        if (emps.length === 0) setParseError(`No se detectaron empleados de ${area}.`);
        else setParsedEmps(emps);
      }
    } catch (err) { setParseError(err instanceof Error ? err.message : 'Error procesando archivo.'); }
    finally { setImportingState(false); e.target.value = ''; }
  }

  const importDiffs = useMemo(() => {
    return parsedEmps.map(parsed => {
      const match = data.find(p => p.cedula === parsed.cedula);
      let status: 'nuevo' | 'cambio' | 'identico' = 'nuevo';
      let delta = 0;
      if (match) { status = Number(match.salario_base) === Number(parsed.salario_semanal) ? 'identico' : 'cambio'; delta = Number(parsed.salario_semanal) - Number(match.salario_base); }
      return { parsed, status, oldSal: match?.salario_base, delta };
    });
  }, [parsedEmps, data]);

  function handleImportConfirm() {
    const valid = parsedEmps.filter(e => e._valid);
    if (valid.length === 0) return alert('No hay empleados válidos.');
    startTransition(async () => {
      const { importarPersonalAction } = await import('@/lib/actions/nomina');
      const res = await importarPersonalAction(valid, area);
      if (res.ok) setImportResult(res.data); else alert(res.message);
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
<thead><tr><th>#</th><th>Nombre</th><th>C.I.</th><th>Cargo</th><th>Estado</th><th class="text-right">Sueldo</th><th class="text-right">Bono Trans.</th><th class="text-right">Bonos</th><th class="text-right">Vales</th><th class="text-right">TOTAL</th></tr></thead>
<tbody>
${rows.map((r, i) => {
  const baseSal = calculateDefaultBaseSal(r.personal, r.estadoAsistencia, weekRange.inicio);
  return `<tr><td>${i+1}</td><td><strong>${r.personal.nombre_completo}</strong></td><td>${r.personal.cedula}</td><td>${r.personal.cargo}</td><td>${r.estadoAsistencia}</td><td class="text-right">$${baseSal.toFixed(2)}</td><td class="text-right">$${r.bonoTransporte.toFixed(2)}</td><td class="text-right">$${r.bonificaciones.toFixed(2)}</td><td class="text-right">$${r.totalVales.toFixed(2)}</td><td class="text-right"><strong>$${r.total.toFixed(2)}</strong></td></tr>`;
}).join('')}
<tr class="total-row"><td colspan="9">TOTAL GENERAL</td><td class="text-right"><strong>$${totalSemana.toFixed(2)}</strong></td></tr>
</tbody></table>
<h2 style="margin-top:24px">Distribución de Socios</h2>
<table style="width:auto"><thead><tr><th>Socio</th><th>%</th><th class="text-right">Bruto</th><th class="text-right">Pagos Directos</th><th class="text-right">Neto</th></tr></thead>
<tbody>
<tr><td>Pedro Guajiro</td><td>${partnerSplits.pctPedro}%</td><td class="text-right">$${((partnerSplits.pctPedro/100)*totalSemana).toFixed(2)}</td><td class="text-right">$${partnerGastos.gastoPedro.toFixed(2)}</td><td class="text-right"><strong>$${((partnerSplits.pctPedro/100)*totalSemana - partnerGastos.gastoPedro).toFixed(2)}</strong></td></tr>
<tr><td>Darinel Riasco</td><td>${partnerSplits.pctDarinel}%</td><td class="text-right">$${((partnerSplits.pctDarinel/100)*totalSemana).toFixed(2)}</td><td class="text-right">$${partnerGastos.gastoDarinel.toFixed(2)}</td><td class="text-right"><strong>$${((partnerSplits.pctDarinel/100)*totalSemana - partnerGastos.gastoDarinel).toFixed(2)}</strong></td></tr>
<tr><td>Molinos La Fé</td><td>${partnerSplits.pctLaFe}%</td><td class="text-right">$${((partnerSplits.pctLaFe/100)*totalSemana).toFixed(2)}</td><td class="text-right">$${partnerGastos.gastoLaFe.toFixed(2)}</td><td class="text-right"><strong>$${((partnerSplits.pctLaFe/100)*totalSemana - partnerGastos.gastoLaFe).toFixed(2)}</strong></td></tr>
</tbody></table>
<div class="signatures"><div class="sig-box">PEDRO GUAJIRO<br>Socio</div><div class="sig-box">DARINEL RIASCO<br>Socio</div><div class="sig-box">ADMINISTRACIÓN<br>La Fé</div></div>
<p class="footer">Generado automáticamente por MineOS — Sistema de Gestión Minera · ${new Date().toISOString()}</p>
</body></html>`;
    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); win.print(); }
  }, [preNominaRows, totalSemana, area, weekRange, partnerSplits, partnerGastos]);

  // ── RENDER ─────────────────────────────────────────────────────────────
  return (
    <div className="w-full max-w-[1750px] mx-auto h-[calc(100vh-80px)] p-4 md:p-6 flex flex-col overflow-hidden">
      
      {/* Header */}
      <div className="flex-shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
        <div>
          <h1 className="text-white/90 font-bold tracking-tight text-2xl flex items-center gap-3">
            <IconComponent className="w-6 h-6 text-amber-500" /> {pageTitle}
          </h1>
          <p className="text-white/40 text-sm mt-1">Complejo Operativo · {data.length} Trabajadores Registrados</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={handlePrintReport} className="btn-secondary h-10 px-4 text-xs flex items-center gap-2"><Printer className="w-3.5 h-3.5 text-zinc-400" /><span>Reporte PDF</span></button>
          <button onClick={handleExportCSV} className="btn-secondary h-10 px-4 text-xs flex items-center gap-2"><Download className="w-3.5 h-3.5 text-zinc-400" /><span>CSV</span></button>
          <button onClick={() => setShowImport(true)} disabled={!canEdit} className="btn-secondary h-10 px-4 text-xs flex items-center gap-2"><Upload className="w-3.5 h-3.5 text-zinc-400" /><span>Importar</span></button>
          {canEdit && data.length > 0 && (
            <button onClick={() => setShowBorrarModal(true)} className="bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-red-400 font-bold h-10 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors text-xs"><Trash2 className="w-3.5 h-3.5" /><span>Baja Todo</span></button>
          )}
          <button onClick={() => { resetForm(); setShowModal(true); }} disabled={!canEdit} className="bg-amber-600 hover:bg-amber-500 text-black font-bold h-10 px-5 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-lg shadow-amber-900/20 disabled:opacity-40 text-xs"><Plus className="w-4 h-4" /> Registrar</button>
        </div>
      </div>

      {/* Grid Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">
        
        {/* LEFT PANEL */}
        <div className="lg:col-span-3 flex flex-col gap-4 overflow-y-auto lg:overflow-hidden pr-1 custom-scrollbar">
          
          {/* KPI: Total Semanal + Sparkline */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 relative overflow-hidden">
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1">Total Semanal Estimado</p>
            <div className="flex items-end justify-between">
              <p className="text-3xl font-black text-amber-400 leading-none">{fmtMoney(totalSemana)}</p>
              {trendData.length >= 2 && <Sparkline data={trendData.map(t => Number(t.total_pagado))} width={100} height={28} color="#f59e0b" />}
            </div>
            {/* Week-over-week comparison */}
            {prevSemana && (
              <div className={`flex items-center gap-1.5 mt-2 text-[10px] font-bold ${weekDelta >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                {weekDelta >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                <span>{weekDelta >= 0 ? '+' : ''}{fmtMoney(weekDelta)} ({weekDeltaPct >= 0 ? '+' : ''}{weekDeltaPct.toFixed(1)}%) vs semana anterior</span>
              </div>
            )}
            {!prevSemana && <p className="text-xs text-white/30 mt-2">Semana en curso</p>}
          </div>

          {/* KPI: Personal Activo */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1">Personal Activo</p>
            <p className="text-3xl font-black text-white/80 leading-none">{data.length}</p>
            <p className="text-xs text-white/30 mt-2">Trabajadores registrados</p>
          </div>

          {/* KPI: Promedio */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1">Promedio por Trabajador</p>
            <p className="text-3xl font-black text-white/80 leading-none">{data.length > 0 ? fmtMoney(totalSemana / data.length) : '$0.00'}</p>
          </div>

          {/* KPI: Vales */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1">Vales Pendientes</p>
            <p className="text-3xl font-black text-red-400 leading-none">{fmtMoney(preNominaRows.reduce((s, r) => s + r.totalVales, 0))}</p>
            <p className="text-xs text-white/30 mt-2">{preNominaRows.filter(r => r.totalVales > 0).length} trabajadores con adelantos</p>
          </div>

          {/* Historial de Cierres */}
          {semanas.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden flex-1 min-h-0 flex flex-col">
              <button onClick={() => setShowHistorial(!showHistorial)} className="w-full flex justify-between px-4 py-3.5 hover:bg-white/[0.02] transition-colors border-b border-zinc-850 flex-shrink-0">
                <div className="flex items-center gap-2.5 text-xs font-bold text-white/50 uppercase tracking-widest"><Clock className="w-4 h-4 text-amber-500" /> Historial Cierres</div>
                {showHistorial ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />}
              </button>
              {showHistorial && (
                <div className="p-3 bg-zinc-900/30 overflow-y-auto flex-1 flex flex-col gap-2.5 custom-scrollbar">
                  {semanas.map(sem => (
                    <div key={sem.id} className="bg-zinc-950/40 border border-zinc-850 rounded-lg p-3.5 hover:border-zinc-800 transition-colors">
                      <div className="flex justify-between items-start">
                        <p className="text-xs font-bold text-white/90">{fmtDate(sem.semana_inicio)} a {fmtDate(sem.semana_fin)}</p>
                        <span className="text-[8px] uppercase font-bold tracking-wider px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded">OK</span>
                      </div>
                      <p className="text-[10px] text-white/40 mt-1">{sem.total_trabajadores} trabajadores</p>
                      <div className="flex justify-between items-center pt-2.5 mt-2 border-t border-zinc-800/40">
                        <p className="text-sm font-bold text-amber-500">{fmtMoney(Number(sem.total_pagado))}</p>
                        {canEdit && <button onClick={() => handleRevertirSemana(sem)} disabled={isPending} className="text-[10px] font-bold text-red-400 hover:text-red-300 transition-colors uppercase tracking-wider">Revertir</button>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT PANEL */}
        <div className="lg:col-span-9 flex flex-col gap-5 overflow-y-auto pr-1 custom-scrollbar min-h-0">
          
          {/* Status Banner */}
          {semanaActualProcesada ? (
            <div className="flex items-center gap-4 rounded-xl border border-emerald-500/10 bg-emerald-500/5 px-5 py-4 flex-shrink-0">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0"><CheckCircle2 className="w-5 h-5 text-emerald-400" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-emerald-400">Nómina Cerrada y Registrada</p>
                <p className="text-xs text-white/50 mt-1">Periodo: {fmtDate(semanaActual.semana_inicio)} al {fmtDate(semanaActual.semana_fin)}  ·  {semanaActual.total_trabajadores} trabajadores  ·  {fmtMoney(Number(semanaActual.total_pagado))}</p>
              </div>
              <button onClick={() => handleRevertirSemana(semanaActual)} disabled={!canEdit || isPending} className="h-9 px-4 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-xs font-bold flex items-center gap-2 transition-colors disabled:opacity-40">
                {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Revertir
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-5 py-4 flex-shrink-0">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0"><AlertTriangle className="w-5 h-5 text-amber-500 animate-pulse" /></div>
                  <div>
                    <p className="text-sm font-semibold text-amber-500">Nómina Pendiente</p>
                    <p className="text-xs text-white/50 mt-1">{fmtDate(getWeekStart())} al {fmtDate(getWeekEnd())} · {data.length} activos · <span className="font-bold text-amber-400">{fmtMoney(totalSemana)}</span></p>
                  </div>
                </div>
                <button onClick={() => { setWeekRange({ inicio: getWeekStart(), fin: getWeekEnd() }); setShowProcesarModal(true); }} disabled={!canEdit || data.length === 0} className="bg-amber-600 hover:bg-amber-500 text-black font-bold h-10 px-5 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-lg shadow-amber-900/20 disabled:opacity-40 shrink-0 text-xs">
                  <Wallet className="w-4 h-4" /> Cerrar y Distribuir
                </button>
              </div>
              {procesadoOk && <div className="mt-3 flex items-center gap-2 text-xs text-emerald-400 font-bold"><CheckCircle2 className="w-3.5 h-3.5" />{procesadoOk}</div>}
            </div>
          )}

          {/* Anomaly Alert */}
          {prevSemana && Math.abs(weekDeltaPct) > 15 && (
            <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-5 py-3 flex items-center gap-3 flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0" />
              <p className="text-xs text-yellow-300">
                <strong>Anomalía detectada:</strong> La nómina estimada difiere un {Math.abs(weekDeltaPct).toFixed(1)}% respecto a la semana anterior ({fmtMoney(Number(prevSemana.total_pagado))}). Verifica que todos los trabajadores estén correctos.
              </p>
            </div>
          )}

          {/* Flujo Guiado Nómina 2.0 (Stepper Visual) */}
          <div className="bg-zinc-900/60 backdrop-blur-md border border-zinc-850 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 flex-shrink-0 shadow-lg">
            <div className="flex flex-col text-left w-full md:w-auto">
              <span className="text-[9px] font-bold text-amber-500 uppercase tracking-widest">Consola de Control</span>
              <h2 className="text-sm font-black text-white/90 uppercase tracking-wide mt-0.5">Nómina Guiada 2.0</h2>
            </div>
            <div className="flex items-center gap-2 md:gap-3 flex-wrap w-full md:w-auto justify-start md:justify-end">
              {[
                { step: 1, title: '1. Asistencia', desc: 'Esquemas & Días' },
                { step: 2, title: '2. Vales & Ajustes', desc: 'Bono Trans./Adelantos' },
                { step: 3, title: '3. Cierre & Reportes', desc: 'Consolidado & Cierre' },
              ].map(s => {
                const isActive = activeStep === s.step;
                const isCompleted = activeStep > s.step;
                return (
                  <button
                    key={s.step}
                    onClick={() => setActiveStep(s.step as 1 | 2 | 3)}
                    className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg border transition-all text-left group ${
                      isActive
                        ? 'bg-amber-600/10 border-amber-500 text-amber-400 shadow-md shadow-amber-500/5'
                        : isCompleted
                        ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400'
                        : 'bg-zinc-950/40 border-zinc-850/50 text-white/40 hover:border-zinc-800 hover:text-white/60'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      isActive
                        ? 'bg-amber-500 text-black'
                        : isCompleted
                        ? 'bg-emerald-500 text-black'
                        : 'bg-zinc-800 text-white/60'
                    }`}>
                      {isCompleted ? '✓' : s.step}
                    </div>
                    <div>
                      <p className="text-[10px] font-bold leading-tight">{s.title}</p>
                      <p className="text-[8px] text-white/30 leading-none mt-0.5 group-hover:text-white/40">{s.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Search */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 flex items-center gap-3 flex-shrink-0">
            <Search className="w-4 h-4 text-white/40 shrink-0" />
            <input type="text" placeholder="Buscar por nombre o cédula..." value={search} onChange={e => setSearch(e.target.value)} className="w-full bg-transparent border-0 text-sm text-white/90 placeholder-white/30 outline-none" />
          </div>

          {/* Grouped Worker Tables */}
          <div className="flex flex-col gap-6 pb-8">
            {Object.keys(groupedRows).length === 0 ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center"><Users className="w-12 h-12 text-white/20 mx-auto mb-3" /><p className="text-sm text-white/40">No hay trabajadores registrados o coincidentes.</p></div>
            ) : (
              Object.entries(groupedRows).map(([cargoName, rows]) => {
                const theme = getCargoTheme(cargoName);
                const groupTotal = rows.reduce((s, r) => s + r.total, 0);
                const groupSueldo = rows.reduce((s, r) => {
                  return s + calculateDefaultBaseSal(r.personal, r.estadoAsistencia, weekRange.inicio);
                }, 0);
                const groupBono = rows.reduce((s, r) => s + r.bonoTransporte, 0);
                const groupBonif = rows.reduce((s, r) => s + r.bonificaciones, 0);
                const groupVales = rows.reduce((s, r) => s + r.totalVales, 0);
                return (
                  <div key={cargoName} className="bg-zinc-900/40 backdrop-blur-md border border-zinc-800/80 rounded-xl overflow-hidden shadow-sm">
                    {/* Group Header */}
                    <div className="px-5 py-3.5 bg-zinc-900/80 border-b border-zinc-800 flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-3">
                        <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${theme.bg} ${theme.text} border ${theme.border}`}>{cargoName}</div>
                        <span className="text-[10px] text-white/40 font-bold uppercase tracking-wider">{rows.length} Trabajadores</span>
                      </div>
                      <span className="text-sm font-semibold text-amber-500">Subtotal: {fmtMoney(groupTotal)}</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-zinc-950/40 border-b border-zinc-800 text-[10px] font-bold text-white/50 uppercase tracking-wider">
                            <th className="px-5 py-3">Trabajador</th>
                            <th className={`px-5 py-3 text-center transition-all duration-300 ${activeStep === 1 ? 'bg-amber-500/10 text-amber-400 font-black border-x border-amber-500/20 shadow-sm' : ''}`}>Asistencia</th>
                            <th className="px-5 py-3 text-right">Sueldo</th>
                            <th className={`px-5 py-3 text-right transition-all duration-300 ${activeStep === 2 ? 'bg-amber-500/10 text-amber-400 font-black border-l border-amber-500/20 shadow-sm' : ''}`}>Bono T.</th>
                            <th className={`px-5 py-3 text-right transition-all duration-300 ${activeStep === 2 ? 'bg-amber-500/10 text-amber-400 font-black shadow-sm' : ''}`}>Bonos</th>
                            <th className={`px-5 py-3 text-right transition-all duration-300 ${activeStep === 2 ? 'bg-amber-500/10 text-amber-400 font-black border-r border-amber-500/20 shadow-sm' : ''}`}>Vales</th>
                            <th className={`px-5 py-3 text-right text-amber-500 transition-all duration-300 ${activeStep === 3 ? 'bg-amber-500/25 text-amber-300 font-black border-x border-amber-500/30 shadow-md' : ''}`}>Total</th>
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
                                {/* Attendance Toggles - Turno/Libre/Falta */}
                                <td className={`px-3 py-3 text-center transition-all duration-300 ${activeStep === 1 ? 'bg-amber-500/5 border-x border-amber-500/10' : ''}`}>
                                  <div className="inline-flex p-1 rounded-xl bg-zinc-950/60 border border-zinc-800/50">
                                    <button onClick={() => handleUpdateRow(p.id, { estadoAsistencia: 'trabajada' })} title="Semana Turno Laboral"
                                      className={`px-2.5 py-1.5 text-[10px] font-bold uppercase rounded-lg border transition-all flex items-center gap-1 ${row.estadoAsistencia === 'trabajada' ? 'bg-amber-500/15 text-amber-400 border-amber-500/30 shadow-md shadow-amber-500/5' : 'border-transparent text-white/40 hover:text-white/70'}`}>
                                      <Hammer className="w-3.5 h-3.5" /> Turno
                                    </button>
                                    <button onClick={() => handleUpdateRow(p.id, { estadoAsistencia: 'libre' })} title="Semana Libre"
                                      className={`px-2.5 py-1.5 text-[10px] font-bold uppercase rounded-lg border transition-all flex items-center gap-1 ${row.estadoAsistencia === 'libre' ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30 shadow-md shadow-cyan-500/5' : 'border-transparent text-white/40 hover:text-white/70'}`}>
                                      <Umbrella className="w-3.5 h-3.5" /> Libre
                                    </button>
                                    <button onClick={() => handleUpdateRow(p.id, { estadoAsistencia: 'no_laborado' })} title="No laboró"
                                      className={`px-2.5 py-1.5 text-[10px] font-bold uppercase rounded-lg border transition-all flex items-center gap-1 ${row.estadoAsistencia === 'no_laborado' ? 'bg-red-500/15 text-red-400 border-red-500/30 shadow-md shadow-red-500/5' : 'border-transparent text-white/40 hover:text-white/70'}`}>
                                      <XCircle className="w-3.5 h-3.5" /> Falta
                                    </button>
                                  </div>
                                </td>
                                {/* Sueldo */}
                                <td className="px-5 py-3 text-right font-sans tabular-nums text-xs text-white/80">
                                  {fmtMoney(calculateDefaultBaseSal(p, row.estadoAsistencia, weekRange.inicio))}
                                </td>
                                {/* Bono */}
                                <td className={`px-5 py-3 text-right transition-all duration-300 ${activeStep === 2 ? 'bg-amber-500/5 border-l border-amber-500/10' : ''}`}>
                                  <input type="number" value={row.bonoTransporte || ''} onChange={e => handleUpdateRow(p.id, { bonoTransporte: Number(e.target.value) || 0 })} placeholder="0.00" className="w-20 bg-zinc-950/40 border border-zinc-800 hover:border-zinc-700 focus:border-amber-500 text-white rounded-lg px-2.5 py-1 text-right text-xs transition-colors outline-none focus:ring-1 focus:ring-amber-500/50" />
                                </td>
                                {/* Bonificaciones */}
                                <td className={`px-5 py-3 text-right transition-all duration-300 ${activeStep === 2 ? 'bg-amber-500/5' : ''}`}>
                                  <input type="number" value={row.bonificaciones || ''} onChange={e => handleUpdateRow(p.id, { bonificaciones: Number(e.target.value) || 0 })} placeholder="0.00" className="w-20 bg-zinc-950/40 border border-zinc-800 hover:border-zinc-700 focus:border-amber-500 text-white rounded-lg px-2.5 py-1 text-right text-xs transition-colors outline-none focus:ring-1 focus:ring-amber-500/50" />
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
                                <td className={`px-5 py-3 text-right font-black text-amber-500 text-xs tabular-nums transition-all duration-300 ${activeStep === 3 ? 'bg-amber-500/10 border-x border-amber-500/20' : ''}`}>{fmtMoney(row.total)}</td>
                                {/* Actions */}
                                <td className="px-5 py-3 text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    <button onClick={() => setSelectedReceipt(row)} title="Ficha" className="p-1.5 rounded-lg hover:bg-white/[0.04] text-white/40 hover:text-white transition-colors"><Receipt className="w-4 h-4" /></button>
                                    {canEdit && (
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
                            <td className="px-5 py-2.5 text-[10px] font-bold text-white/50 uppercase tracking-wider" colSpan={2}>Subtotal {cargoName}</td>
                            <td className="px-5 py-2.5 text-right text-xs font-bold text-white/60 tabular-nums">{fmtMoney(groupSueldo)}</td>
                            <td className="px-5 py-2.5 text-right text-xs font-bold text-white/60 tabular-nums transition-all duration-300 border-l border-amber-500/10">{fmtMoney(groupBono)}</td>
                            <td className="px-5 py-2.5 text-right text-xs font-bold text-white/60 tabular-nums transition-all duration-300">{fmtMoney(groupBonif)}</td>
                            <td className="px-5 py-2.5 text-right text-xs font-bold text-red-400/70 tabular-nums transition-all duration-300 border-r border-amber-500/10">{groupVales > 0 ? `-${fmtMoney(groupVales)}` : '$0.00'}</td>
                            <td className={`px-5 py-2.5 text-right text-sm font-black text-amber-500 tabular-nums transition-all duration-300 ${activeStep === 3 ? 'bg-amber-500/20 border-x border-amber-500/30 shadow-md' : ''}`}>{fmtMoney(groupTotal)}</td>
                            <td></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ── SLIDE-OVER DRAWER ── */}
      {drawerPersonalId && drawerRow && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm" onClick={() => setDrawerPersonalId(null)}>
          <div className="w-full max-w-md bg-zinc-950 border-l border-zinc-800 shadow-2xl h-full flex flex-col animate-in slide-in-from-right duration-300" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-zinc-800 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl ${getAvatarColor(drawerRow.personal.cargo)} flex items-center justify-center text-white text-sm font-bold shadow-sm`}>{getInitials(drawerRow.personal.nombre_completo)}</div>
                <div>
                  <h3 className="text-lg font-bold text-white/95">{drawerRow.personal.nombre_completo}</h3>
                  <p className="text-xs text-white/40 mt-0.5">C.I. {drawerRow.personal.cedula} · {drawerRow.personal.cargo}</p>
                </div>
              </div>
              <button onClick={() => setDrawerPersonalId(null)} className="p-2 rounded-lg hover:bg-white/[0.05] text-white/40 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
            </div>

            {/* Drawer Tabs */}
            <div className="flex border-b border-zinc-800 px-6 flex-shrink-0">
              {(['vales', 'historial', 'rotacion'] as const).map(tab => (
                <button key={tab} onClick={() => setDrawerTab(tab)} className={`pb-2.5 px-3 text-xs font-bold tracking-wider uppercase border-b-2 transition-all ${drawerTab === tab ? 'border-amber-500 text-amber-500' : 'border-transparent text-white/40 hover:text-white/60'}`}>
                  {tab === 'vales' ? 'Vales' : tab === 'historial' ? 'Historial' : 'Rotación'}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
              
              {/* Profile Card (always visible) */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
                <h4 className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Perfil</h4>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div><span className="text-white/40">Salario Labor</span><p className="text-white/90 font-semibold tabular-nums">{fmtMoney(Number(drawerRow.personal.salario_base))}</p></div>
                  <div><span className="text-white/40">Salario Libre</span><p className="text-white/90 font-semibold tabular-nums">{fmtMoney(Number(drawerRow.personal.salario_libre) || 100)}</p></div>
                  <div><span className="text-white/40">Bono Transporte</span><p className="text-white/90 font-semibold tabular-nums">{fmtMoney(Number(drawerRow.personal.bono_transporte))}</p></div>
                  <div><span className="text-white/40">Ingreso</span><p className="text-white/90 font-semibold">{fmtDate(drawerRow.personal.fecha_ingreso)}</p></div>
                </div>
              </div>

              {/* TAB: Vales */}
              {drawerTab === 'vales' && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-2"><DollarSign className="w-3.5 h-3.5 text-red-400" /> Vales / Adelantos</h4>
                    <span className="text-xs font-bold text-red-400 tabular-nums">Total: {fmtMoney(drawerVales.reduce((s, v) => s + Number(v.monto), 0))}</span>
                  </div>
                  {loadingDrawer ? <div className="flex items-center justify-center py-6"><Loader2 className="w-5 h-5 text-amber-500 animate-spin" /></div> : drawerVales.length > 0 ? (
                    <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                      {drawerVales.map(v => (
                        <div key={v.id} className="flex items-center justify-between gap-3 bg-zinc-950/50 border border-zinc-800/50 rounded-lg px-3 py-2.5">
                          <div className="flex-1 min-w-0"><p className="text-xs text-white/80 font-medium truncate">{v.motivo || 'Adelanto'}</p><p className="text-[10px] text-white/30">{fmtDate(v.fecha)}</p></div>
                          <p className="text-xs font-bold text-red-400 tabular-nums shrink-0">{fmtMoney(Number(v.monto))}</p>
                          {canEdit && <button onClick={() => handleDeleteVale(v.id)} disabled={isPending} className="p-1 rounded hover:bg-red-500/10 text-white/30 hover:text-red-400 transition-colors shrink-0"><Trash2 className="w-3 h-3" /></button>}
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-xs text-white/30 text-center py-4">No hay vales pendientes</p>}
                  {canEdit && (
                    <div className="pt-3 border-t border-zinc-800 space-y-2.5">
                      <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Registrar vale</p>
                      <div className="flex gap-2">
                        <input type="number" placeholder="$ Monto" value={newValeMonto} onChange={e => setNewValeMonto(e.target.value)} className="w-24 bg-zinc-950/40 border border-zinc-800 focus:border-amber-500 text-white rounded-lg px-2.5 py-1.5 text-xs outline-none transition-colors focus:ring-1 focus:ring-amber-500/50" />
                        <input type="text" placeholder="Motivo" value={newValeMotivo} onChange={e => setNewValeMotivo(e.target.value)} className="flex-1 bg-zinc-950/40 border border-zinc-800 focus:border-amber-500 text-white rounded-lg px-2.5 py-1.5 text-xs outline-none transition-colors focus:ring-1 focus:ring-amber-500/50" />
                      </div>
                      <button onClick={handleAddVale} disabled={isPending || !newValeMonto} className="w-full bg-amber-600 hover:bg-amber-500 text-black font-bold h-9 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-40 text-xs">
                        {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Registrar Vale
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* TAB: Historial de Pagos */}
              {drawerTab === 'historial' && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
                  <h4 className="text-[10px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-2"><History className="w-3.5 h-3.5 text-amber-400" /> Historial de Pagos</h4>
                  {loadingDrawer ? <div className="flex items-center justify-center py-6"><Loader2 className="w-5 h-5 text-amber-500 animate-spin" /></div> : drawerHistorial.length > 0 ? (
                    <div className="space-y-2">
                      {/* Mini sparkline of payment history */}
                      {drawerHistorial.length >= 2 && (
                        <div className="flex items-center justify-center pb-2 border-b border-zinc-800">
                          <Sparkline data={[...drawerHistorial].reverse().map(h => Number(h.monto_pagado))} width={200} height={40} color="#f59e0b" />
                        </div>
                      )}
                      {drawerHistorial.map(h => (
                        <div key={h.semana_id} className="flex items-center justify-between gap-3 bg-zinc-950/50 border border-zinc-800/50 rounded-lg px-3 py-2.5">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-white/80 font-medium">{fmtDate(h.semana_inicio)} — {fmtDate(h.semana_fin)}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded ${h.es_semana_libre ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                                {h.es_semana_libre ? 'Libre' : 'Labor'}
                              </span>
                              {Number(h.bono_transporte_pagado) > 0 && <span className="text-[8px] text-white/30">+Trans. {fmtMoney(Number(h.bono_transporte_pagado))}</span>}
                            </div>
                          </div>
                          <p className="text-sm font-bold text-amber-500 tabular-nums shrink-0">{fmtMoney(Number(h.monto_pagado))}</p>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-xs text-white/30 text-center py-4">No hay pagos registrados aún</p>}
                </div>
              )}

              {/* TAB: Rotation Calendar */}
              {drawerTab === 'rotacion' && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
                    <h4 className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Esquema de Rotación</h4>
                  </div>
                  <p className="text-xs text-cyan-400 font-semibold">{ESQUEMA_LABELS[drawerRow.personal.esquema_rotacion] || drawerRow.personal.esquema_rotacion}</p>
                  {drawerRow.personal.rotacion_inicio_fecha && <p className="text-[10px] text-white/30">Inicio del ciclo: {fmtDate(drawerRow.personal.rotacion_inicio_fecha)}</p>}
                  
                  {/* Mini Gantt Calendar - next 6 weeks */}
                  <div className="pt-3 border-t border-zinc-800">
                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">Calendario Próximas 6 Semanas</p>
                    <div className="space-y-1.5">
                      {predictRotationCalendar(drawerRow.personal.esquema_rotacion, drawerRow.personal.rotacion_inicio_fecha, weekRange.inicio, 6).map((week, i) => {
                        const isCurrentWeek = week.weekStart === weekRange.inicio;
                        const endDate = new Date(week.weekStart);
                        endDate.setDate(endDate.getDate() + 6);
                        return (
                          <div key={i} className={`flex items-center gap-2 rounded-lg px-3 py-2 border transition-colors ${isCurrentWeek ? 'border-amber-500/30 bg-amber-500/5' : 'border-zinc-800/50 bg-zinc-950/30'}`}>
                            <div className={`w-2 h-8 rounded-full shrink-0 ${week.status === 'trabajada' ? 'bg-amber-500' : week.status === 'libre' ? 'bg-cyan-500' : 'bg-red-500'}`} />
                            <div className="flex-1">
                              <p className="text-[10px] text-white/60">{fmtDate(week.weekStart)} — {fmtDate(endDate.toISOString().split('T')[0])}</p>
                            </div>
                            <span className={`text-[8px] font-bold uppercase px-2 py-0.5 rounded ${week.status === 'trabajada' ? 'bg-amber-500/15 text-amber-400' : week.status === 'libre' ? 'bg-cyan-500/15 text-cyan-400' : 'bg-red-500/15 text-red-400'}`}>
                              {week.status === 'trabajada' ? '🔨 LABOR' : week.status === 'libre' ? '☀️ LIBRE' : '❌ FALTA'}
                            </span>
                            {isCurrentWeek && <span className="text-[8px] text-amber-500 font-bold">← SELEC.</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Quick Actions */}
              <div className="space-y-2">
                <button onClick={() => { openEdit(drawerRow.personal); setDrawerPersonalId(null); }} className="w-full btn-secondary h-10 flex items-center justify-center gap-2 text-xs"><Edit2 className="w-3.5 h-3.5" /> Editar Perfil</button>
                <button onClick={() => { setSelectedReceipt(drawerRow); setDrawerPersonalId(null); }} className="w-full btn-secondary h-10 flex items-center justify-center gap-2 text-xs"><Receipt className="w-3.5 h-3.5" /> Ficha de Pago</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Worker Form ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/70 backdrop-blur-sm" onClick={() => setShowModal(false)}>
          <div className="relative w-full sm:max-w-xl bg-zinc-950 border border-zinc-800 sm:rounded-2xl rounded-t-2xl shadow-2xl p-6 sm:p-8 max-h-[92dvh] overflow-y-auto text-white" onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowModal(false)} className="absolute top-6 right-6 text-white/40 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
            <h3 className="text-xl font-bold text-white/90 tracking-wide mb-6">{editItem ? 'Editar Trabajador' : 'Registrar Nuevo Trabajador'}</h3>
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
                    <select value={form.esquema_rotacion} onChange={e => setForm({...form, esquema_rotacion: e.target.value})} className="input-field">
                      <option value="FIJO_SEMANAL">Fijo Semanal</option>
                      <option value="MINA_2X1">Mina 2×1</option>
                      <option value="MOLINO_FIJO">Molino Fijo</option>
                      <option value="MOLINO_ROTATIVO">Molino Rotativo</option>
                      <option value="MINA_ROTATIVA_3G">Mina Rotativa 3G (1 Noche, 1 Día, 1 Libre)</option>
                      <option value="MOLINO_15X15">Molino 15x15 (2 labor, 1 libre pagada, 1 libre no pagada)</option>
                    </select>
                    {(form.esquema_rotacion === 'MINA_2X1' || form.esquema_rotacion === 'MOLINO_ROTATIVO' || form.esquema_rotacion === 'MINA_ROTATIVA_3G' || form.esquema_rotacion === 'MOLINO_15X15') && (
                      <div className="space-y-1"><label className="input-label">Fecha Inicio Ciclo</label><input type="date" value={form.rotacion_inicio_fecha} onChange={e => setForm({...form, rotacion_inicio_fecha: e.target.value})} className="input-field" /><p className="text-[10px] text-white/30">Primera semana laboral del trabajador.</p></div>
                    )}
                  </div>
                  <div className="space-y-1"><label className="input-label">Notas</label><textarea placeholder="Observaciones..." value={form.notas} onChange={e => setForm({...form, notas: e.target.value})} className="input-field h-20 resize-none text-xs" /></div>
                </>
              )}
            </div>
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-zinc-800">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
              <button onClick={handleSave} disabled={isPending} className="btn-primary min-w-[110px] justify-center">{isPending ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Cierre Financiero V3 ── */}
      {showProcesarModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/70 backdrop-blur-sm" onClick={() => setShowProcesarModal(false)}>
          <div className="relative w-full sm:max-w-lg bg-zinc-950 border border-zinc-800 sm:rounded-2xl rounded-t-2xl shadow-2xl p-6 sm:p-8 max-h-[92dvh] overflow-y-auto text-white" onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowProcesarModal(false)} className="absolute top-6 right-6 text-white/40 hover:text-white"><X className="w-5 h-5" /></button>
            <h3 className="text-lg font-semibold text-white/90 mb-2 flex items-center gap-2"><Wallet className="w-5 h-5 text-amber-500" /> Consola de Cierre</h3>
            <p className="text-xs text-white/40 mb-6 uppercase tracking-wider">Rango de nómina semanal</p>
            <div className="flex items-center gap-3 mb-6">
              <div className="flex-1"><label className="input-label">Inicio</label><input type="date" value={weekRange.inicio} onChange={e => setWeekRange({...weekRange, inicio: e.target.value})} className="input-field" /></div>
              <span className="text-white/40 self-end mb-3">a</span>
              <div className="flex-1"><label className="input-label">Fin</label><input type="date" value={weekRange.fin} onChange={e => setWeekRange({...weekRange, fin: e.target.value})} className="input-field" /></div>
            </div>
            <div className="p-5 rounded-xl bg-amber-500/5 border border-amber-500/20 mb-6">
              <p className="text-xs text-amber-200 tracking-wider">TOTAL NETO</p>
              <p className="text-3xl font-black text-amber-500 mt-1 leading-none">{fmtMoney(totalSemana)}</p>
              <p className="text-[10px] text-amber-500/60 mt-2 uppercase">{preNominaRows.length} trabajadores · {preNominaRows.filter(r => r.totalVales > 0).length} con vales</p>
            </div>
            <div className="space-y-4 mb-6">
              <h4 className="text-[10px] text-white/40 tracking-wider uppercase border-b border-zinc-800 pb-2">Distribución de Socios</h4>
              {[
                { name: 'Pedro Guajiro', pct: partnerSplits.pctPedro, color: 'cyan', gastoKey: 'gastoPedro' as const },
                { name: 'Darinel Riasco', pct: partnerSplits.pctDarinel, color: 'yellow', gastoKey: 'gastoDarinel' as const },
                { name: 'Molinos La Fé', pct: partnerSplits.pctLaFe, color: 'emerald', gastoKey: 'gastoLaFe' as const },
              ].map(s => (
                <div key={s.name} className="space-y-2">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-1.5 h-6 bg-${s.color}-500 rounded-full`} />
                      <div><p className="text-xs font-semibold text-white/95">{s.name}</p><p className="text-[10px] text-white/40 mt-0.5">{s.pct}%</p></div>
                    </div>
                    <p className={`text-base font-semibold text-${s.color}-400 tabular-nums`}>{fmtMoney((s.pct / 100) * totalSemana)}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <span className="text-[10px] text-white/30 shrink-0">Pagos directos:</span>
                    <input type="number" value={partnerGastos[s.gastoKey] || ''} onChange={e => setPartnerGastos({...partnerGastos, [s.gastoKey]: Number(e.target.value) || 0})} placeholder="0.00" className={`w-24 bg-zinc-950/40 border border-zinc-800 focus:border-${s.color}-500 text-white rounded-lg px-2.5 py-1 text-right text-xs outline-none transition-colors focus:ring-1 focus:ring-${s.color}-500/50`} />
                    {partnerGastos[s.gastoKey] > 0 && <span className={`text-[10px] text-${s.color}-400 font-bold`}>Neto: {fmtMoney((s.pct / 100) * totalSemana - partnerGastos[s.gastoKey])}</span>}
                  </div>
                </div>
              ))}
            </div>
            {(partnerGastos.gastoPedro > 0 || partnerGastos.gastoDarinel > 0 || partnerGastos.gastoLaFe > 0) && (
              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 mb-6 space-y-2">
                <h4 className="text-[10px] text-white/40 uppercase tracking-widest font-bold flex items-center gap-2"><TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> Liquidación Neta</h4>
                <div className="flex justify-between text-xs"><span className="text-white/50">Pedro:</span><span className="text-cyan-400 font-bold tabular-nums">{fmtMoney(Math.max(0, (partnerSplits.pctPedro / 100) * totalSemana - partnerGastos.gastoPedro))}</span></div>
                <div className="flex justify-between text-xs"><span className="text-white/50">Darinel:</span><span className="text-yellow-400 font-bold tabular-nums">{fmtMoney(Math.max(0, (partnerSplits.pctDarinel / 100) * totalSemana - partnerGastos.gastoDarinel))}</span></div>
                <div className="flex justify-between text-xs"><span className="text-white/50">La Fé:</span><span className="text-emerald-400 font-bold tabular-nums">{fmtMoney(Math.max(0, (partnerSplits.pctLaFe / 100) * totalSemana - partnerGastos.gastoLaFe))}</span></div>
              </div>
            )}
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-zinc-800">
              <button onClick={() => setShowProcesarModal(false)} className="btn-secondary">Cancelar</button>
              <button onClick={handleProcesarNomina} disabled={isPending} className="btn-primary min-w-[110px] justify-center">{isPending ? 'Procesando...' : 'Confirmar Cierre'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Import ── */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/70 backdrop-blur-sm" onClick={() => { setShowImport(false); setParsedEmps([]); setImportResult(null); }}>
          <div className="relative w-full sm:max-w-2xl bg-zinc-950 border border-zinc-800 sm:rounded-2xl rounded-t-2xl shadow-2xl p-6 sm:p-8 max-h-[88dvh] overflow-y-auto text-white" onClick={e => e.stopPropagation()}>
            <button onClick={() => { setShowImport(false); setParsedEmps([]); setImportResult(null); }} className="absolute top-6 right-6 text-white/40 hover:text-white"><X className="w-5 h-5" /></button>
            <h3 className="text-xl font-bold text-white/90 tracking-wide mb-6">Importar Nómina</h3>
            {!parsedEmps.length ? (
              <div className="space-y-4">
                <div className="flex gap-2 mb-4 bg-zinc-900 p-1 rounded-lg border border-zinc-800 w-fit">
                  <button onClick={() => setImportTab('excel')} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${importTab === 'excel' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-white/40 border border-transparent hover:text-white/70'}`}>Excel</button>
                  <button onClick={() => setImportTab('pdf')} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${importTab === 'pdf' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-white/40 border border-transparent hover:text-white/70'}`}>PDF</button>
                </div>
                <div className="border-2 border-dashed border-zinc-800 hover:border-amber-500/50 bg-zinc-900/10 rounded-xl p-10 text-center relative transition-all group">
                  <input type="file" accept={importTab === 'excel' ? '.xlsx,.xls' : '.pdf'} onChange={handleFile} disabled={importingState} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  {importingState ? (<div className="flex flex-col items-center gap-3"><Loader2 className="w-10 h-10 text-amber-500 animate-spin" /><span className="text-white/60 text-sm font-semibold">Parseando archivo...</span></div>) : (<div className="flex flex-col items-center gap-3"><Upload className="w-10 h-10 text-zinc-650 group-hover:text-amber-500 transition-colors" /><span className="text-white/60 text-sm font-semibold">Arrastra tu reporte aquí</span></div>)}
                </div>
                {parseError && <p className="text-red-400 text-xs bg-red-500/10 p-2.5 rounded-xl border border-red-500/20">{parseError}</p>}
                <button onClick={() => setShowImport(false)} className="btn-secondary w-full mt-4 flex justify-center text-xs font-bold uppercase py-3">Cerrar</button>
              </div>
            ) : (
              <div>
                <p className="text-xs text-white/50 mb-4">{parsedEmps.length} trabajadores de <strong className="text-amber-500">{area.toUpperCase()}</strong></p>
                <div className="max-h-64 overflow-y-auto border border-zinc-800 rounded-xl mb-4 bg-zinc-950/50">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-zinc-900 sticky top-0 border-b border-zinc-800 z-10 text-[10px] text-white/40 uppercase tracking-widest"><tr><th className="p-3">Nombre</th><th className="p-3">Cédula</th><th className="p-3">Cargo</th><th className="p-3 text-right">Sueldo</th><th className="p-3 text-center">Estado</th></tr></thead>
                    <tbody className="divide-y divide-zinc-800/30 text-white/80">
                      {importDiffs.map((diff, i) => (
                        <tr key={i}><td className="p-3 font-semibold">{diff.parsed.nombre_completo}</td><td className="p-3 text-white/40">{diff.parsed.cedula}</td><td className="p-3 text-white/50">{diff.parsed.cargo}</td><td className="p-3 text-right text-amber-500 font-bold">{fmtMoney(diff.parsed.salario_semanal)}</td>
                        <td className="p-3 text-center">{diff.status === 'nuevo' && <span className="px-2 py-0.5 text-[8px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold rounded uppercase">NUEVO</span>}{diff.status === 'cambio' && <span className="px-2 py-0.5 text-[8px] bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 font-bold rounded uppercase">AJUSTE ({diff.delta > 0 ? '+' : ''}{diff.delta})</span>}{diff.status === 'identico' && <span className="px-2 py-0.5 text-[8px] bg-zinc-850 text-zinc-400 border border-zinc-850 font-bold rounded uppercase">OK</span>}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {importResult && (<div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center mb-4"><CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" /><p className="text-emerald-300 font-semibold uppercase tracking-widest text-xs">¡Importación Exitosa!</p><p className="text-[10px] text-emerald-400/70 mt-1">{importResult.nuevos} nuevos, {importResult.actualizados} actualizados.</p></div>)}
                <div className="flex gap-3 mt-4">
                  <button onClick={() => { setParsedEmps([]); setImportResult(null); }} className="btn-secondary flex-1 flex justify-center text-xs font-bold py-2.5">Otro Archivo</button>
                  {!importResult && <button onClick={handleImportConfirm} disabled={isPending} className="btn-primary flex-1 flex justify-center text-xs font-bold py-2.5">{isPending ? 'IMPORTANDO...' : 'CONFIRMAR'}</button>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL: Borrar ── */}
      {showBorrarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setShowBorrarModal(false)}>
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-sm p-6 text-center shadow-2xl text-white" onClick={e => e.stopPropagation()}>
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4 animate-bounce" />
            <h3 className="text-lg font-bold mb-2">¿DAR DE BAJA TODO?</h3>
            <p className="text-xs text-white/50 mb-6">{data.length} trabajadores de {area.toUpperCase()} serán desactivados.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowBorrarModal(false)} className="btn-secondary flex-1 py-2.5 text-xs font-bold">Cancelar</button>
              <button onClick={handleBorrarTodo} disabled={isPending} className="bg-red-600 hover:bg-red-500 text-white font-bold h-10 px-4 rounded-lg flex-1 flex items-center justify-center transition-colors disabled:opacity-40 text-xs">{isPending ? 'PROCESANDO...' : 'DAR DE BAJA'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Recibo / Ficha de Pago ── */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm" onClick={() => setSelectedReceipt(null)}>
          <style>{`@media print{body *{visibility:hidden}#printable-receipt-card,#printable-receipt-card *{visibility:visible}#printable-receipt-card{position:absolute;left:0;top:0;width:100%;color:black!important;background:white!important;border:0!important;box-shadow:none!important}#receipt-buttons-bar{display:none!important}#printable-receipt-card button{display:none!important}#printable-receipt-card *{color:black!important}}`}</style>
          <div id="printable-receipt-card" className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl text-white" onClick={e => e.stopPropagation()}>
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
              <div className="flex justify-between"><span className="text-white/40">Sueldo:</span><span className="text-white/95 font-semibold tabular-nums">{fmtMoney(calculateDefaultBaseSal(selectedReceipt.personal, selectedReceipt.estadoAsistencia, weekRange.inicio))}</span></div>
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
            <div id="receipt-buttons-bar" className="flex gap-2 mt-6">
              <button onClick={() => setSelectedReceipt(null)} className="btn-secondary flex-1 flex items-center justify-center gap-1.5 h-10 text-xs font-bold"><X className="w-3.5 h-3.5" /> Cerrar</button>
              <button onClick={() => copyReceiptToClipboard(selectedReceipt)} className="btn-secondary flex-1 flex items-center justify-center gap-1.5 h-10 text-xs font-bold">
                {copiedReceipt ? <><Check className="w-3.5 h-3.5 text-emerald-400" /> ¡Copiado!</> : <><Copy className="w-3.5 h-3.5" /> WhatsApp</>}
              </button>
              <button onClick={() => window.print()} className="btn-primary flex-1 flex items-center justify-center gap-1.5 h-10 text-xs font-bold"><Printer className="w-3.5 h-3.5" /> Imprimir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
