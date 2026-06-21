import dynamic from 'next/dynamic';
import { createServerClient } from '@/lib/supabase-server';
import { buildDashboardAlerts } from '@/lib/dashboard-alerts';

import { DashboardCommandSkeleton } from '@/components/dashboard/DashboardCommandSkeleton';
import type { LocationData, GlobalData } from '@/components/dashboard/types';
import DashboardMobileWrapper from './DashboardMobileWrapper';

const SatelliteCommandClient = dynamic(
  () => import('@/components/dashboard/SatelliteCommandClient'),
  { loading: () => <DashboardCommandSkeleton /> },
);

export const metadata = { title: 'Command Center - MineOS' };
export const revalidate = 60;

type SearchParams = Promise<{ desde?: string; hasta?: string }>;
interface PageProps {
  searchParams: SearchParams;
}

function periodBounds(desde?: string, hasta?: string) {
  const today = new Date();
  const to =
    hasta ||
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  let from = desde;
  if (!from) {
    const thirtyDaysAgo = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30);
    from = `${thirtyDaysAgo.getFullYear()}-${String(thirtyDaysAgo.getMonth() + 1).padStart(2, '0')}-${String(thirtyDaysAgo.getDate()).padStart(2, '0')}`;
  }
  return { from, to, today: to };
}

function monthWindow(dateIso: string) {
  const [yearRaw, monthRaw] = dateIso.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return null;
  }

  const pad = (n: number) => String(n).padStart(2, '0');
  const first = `${year}-${pad(month)}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const last = `${year}-${pad(month)}-${pad(lastDay)}`;
  return { from: first, to: last };
}

// ══════════════════════════════════════════════════════════════
// DICCIONARIO ESTRICTO DE NODOS FÍSICOS DEL COMPLEJO LA FE
const NODE_DICT: Record<string, { x: number; y: number }> = {
  'Mantenimiento':   { x: 15, y: 50 },
  'Molino 1':        { x: 35, y: 25 },
  'Molino 1-2':      { x: 50, y: 35 },
  'Molino 1-3':      { x: 35, y: 50 },
  'Molino 2':        { x: 65, y: 25 },
  'Molino 2-3':      { x: 65, y: 50 },
  'Molino 3':        { x: 50, y: 75 },
  'Molino Continuo': { x: 85, y: 40 },
  'Molino 1-2-3':    { x: 50, y: 50 },
};

const ALWAYS_PRESENT = [
  'Molino 1', 'Molino 2', 'Molino 3', 'Molino Continuo', 'Mantenimiento',
] as const;

function normalizeMolinoName(raw: string): string {
  const t = raw.trim();
  if (/^Molino\s+\d[-\d]+$/i.test(t)) return t.replace(/\s+/, ' ');
  if (/^Molino\s+(continuo|coco|1|2|3)$/i.test(t)) return t.replace(/\s+/, ' ');
  if (/^mantenimiento$/i.test(t)) return 'Mantenimiento';
  return t;
}

interface Accum {
  name: string;
  coordinates: { x: number; y: number };
  status: 'Activo' | 'Mantenimiento' | 'Inactivo';
  totalOro: number;
  sumTenor: number;
  sumMerma: number;
  count: number;
  materiales: Set<string>;
  origenes: Set<string>;
}

function makeAccum(name: string): Accum {
  const isMant = /mantenimiento/i.test(name);
  return {
    name,
    coordinates: NODE_DICT[name] ?? { x: 60, y: 45 },
    status: isMant ? 'Mantenimiento' : 'Inactivo',
    totalOro: 0, sumTenor: 0, sumMerma: 0, count: 0,
    materiales: new Set<string>(),
    origenes:   new Set<string>(),
  };
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const { desde, hasta } = await searchParams;
  const { from, to, today } = periodBounds(desde, hasta);

  const supabase = await createServerClient();

  // Detect user role from JWT
  const { data: { user } } = await supabase.auth.getUser();
  const userRole: string = user?.user_metadata?.role ?? 'admin';
  const isMiningSupervisor = userRole === 'mining_supervisor';
  const isMillSupervisor = userRole === 'mill_supervisor';
  const isSupervisor = isMiningSupervisor || isMillSupervisor;

  // Helper: evita que una excepción de red cascadee todo el dashboard
  const safeCatch = async <T,>(promise: any): Promise<T> => {
    try { return await (promise as Promise<T>); } catch { return undefined as unknown as T; }
  };

  type GastoRow = { monto: number };
  type ProdRow = { fecha?: string; molino?: string | null; oro_recuperado_g?: number | null; tenor_tonelada_gpt?: number | null; merma_1_pct?: number | null; material?: string | null; material_codigo?: string | null };
  type InventarioRow = { id: string; nombre: string; stock_actual: number; stock_minimo: number };
  type PersonalAreaRow = { area: string };
  type VoladuraRow = { id: string; mina: string; fecha: string; sin_novedad: boolean };
  type ValesRow = { id: string; monto: number; personal: { area: string } };
  type NominaSemanaRow = { area: string; semana_inicio: string };
  type EquiposResponse = { data: never[]; count: number };
  type PersonalCountResponse = { data: never[]; count: number };

  try {
    // Role-based query filtering
    // mining_supervisor: only mina data (voladuras, extraccion, personal de mina)
    // mill_supervisor: only molino data (produccion, quemado, acarreo, personal de planta)
    // admin/admin_developer: everything

    const [
      gastosHoyRes,
      gastosPeriodoRes,
      equiposRes,
      prodRes,
      quemadoRes,
      volRes,
      extraccionRes,
      acarreoRes,
      inventarioRes,
      nominaSemanasRes,
      personalAreasRes,
      valesPendientesRes,
      personalRes,
    ] = await Promise.all([
      safeCatch<{ data: GastoRow[]; error: any }>(
        isSupervisor
          ? supabase.from('gastos').select('monto').eq('fecha', today).limit(500)
          : supabase.from('gastos').select('monto').eq('fecha', today).limit(500),
      ),
      safeCatch<{ data: GastoRow[]; error: any }>(
        isSupervisor
          ? supabase.from('gastos').select('monto').gte('fecha', from).lte('fecha', to).limit(500)
          : supabase.from('gastos').select('monto').gte('fecha', from).lte('fecha', to).limit(500),
      ),
      safeCatch<EquiposResponse>(
        isSupervisor
          ? supabase.from('equipos').select('id', { count: 'exact', head: true }).eq('activo', true)
          : supabase.from('equipos').select('id', { count: 'exact', head: true }).eq('activo', true),
      ),
      safeCatch<{ data: ProdRow[]; error: any }>(
        isMiningSupervisor
          ? supabase.from('reportes_produccion').select('fecha, molino, oro_recuperado_g, tenor_tonelada_gpt, merma_1_pct, material, material_codigo').gte('fecha', from).lte('fecha', to).order('fecha', { ascending: false }).limit(500)
          : supabase.from('reportes_produccion').select('fecha, molino, oro_recuperado_g, tenor_tonelada_gpt, merma_1_pct, material, material_codigo').gte('fecha', from).lte('fecha', to).order('fecha', { ascending: false }).limit(500),
      ),
      safeCatch<{ data: { total_oro_g: number }[]; error: any }>(
        isMiningSupervisor
          ? supabase.from('reportes_quemado').select('total_oro_g').gte('fecha', from).lte('fecha', to).limit(0)
          : supabase.from('reportes_quemado').select('total_oro_g').gte('fecha', from).lte('fecha', to),
      ),
      safeCatch<{ data: VoladuraRow[]; error: any }>(
        isMiningSupervisor
          ? supabase.from('reportes_voladuras').select('id, mina, fecha, sin_novedad').gte('fecha', from).lte('fecha', to).order('fecha', { ascending: false }).limit(500)
          : isMillSupervisor
            ? supabase.from('reportes_voladuras').select('id, mina, fecha, sin_novedad').gte('fecha', from).lte('fecha', to).limit(0)
            : supabase.from('reportes_voladuras').select('id, mina, fecha, sin_novedad').gte('fecha', from).lte('fecha', to).eq('sin_novedad', false).order('fecha', { ascending: false }).limit(10),
      ),
      safeCatch<{ data: { sacos_extraidos: number; fecha: string; vertical?: string; mina?: string }[]; error: any }>(
        isMiningSupervisor
          ? supabase.from('reportes_extraccion').select('sacos_extraidos, fecha, vertical, mina').gte('fecha', from).lte('fecha', to).order('fecha', { ascending: false }).limit(500)
          : supabase.from('reportes_extraccion').select('sacos_extraidos').limit(0),
      ),
      safeCatch<{ data: { carga_total: number; fecha: string }[]; error: any }>(
        isMillSupervisor
          ? supabase.from('reportes_acarreo').select('carga_total, fecha').gte('fecha', from).lte('fecha', to).order('fecha', { ascending: false }).limit(500)
          : supabase.from('reportes_acarreo').select('carga_total').limit(0),
      ),
      safeCatch<{ data: InventarioRow[]; error: any }>(
        supabase.from('inventario_items').select('id, nombre, stock_actual, stock_minimo').eq('activo', true).limit(500),
      ),
      safeCatch<{ data: NominaSemanaRow[]; error: any }>(supabase.from('nomina_semanas').select('area, semana_inicio').limit(200)),
      safeCatch<{ data: PersonalAreaRow[]; error: any }>(
        isMiningSupervisor
          ? supabase.from('personal').select('area').eq('activo', true).eq('area', 'mina').limit(500)
          : isMillSupervisor
            ? supabase.from('personal').select('area').eq('activo', true).eq('area', 'planta').limit(500)
            : supabase.from('personal').select('area').eq('activo', true).in('area', ['planta', 'mina', 'administracion']).limit(500),
      ),
      safeCatch<{ data: ValesRow[]; error: any }>(
        supabase.from('nomina_vales').select('id, monto, personal:personal_id(area)').eq('estado', 'PENDIENTE').limit(500),
      ),
      safeCatch<PersonalCountResponse>(
        isMiningSupervisor
          ? supabase.from('personal').select('id', { count: 'exact', head: true }).eq('activo', true).eq('area', 'mina')
          : isMillSupervisor
            ? supabase.from('personal').select('id', { count: 'exact', head: true }).eq('activo', true).eq('area', 'planta')
            : supabase.from('personal').select('id', { count: 'exact', head: true }).eq('activo', true).in('area', ['planta', 'mina']),
      ),
    ]);

    const reportesProd = (prodRes?.data ?? []) as {
      molino?: string | null;
      oro_recuperado_g?: number | null;
      fecha?: string;
      tenor_tonelada_gpt?: number | null;
      merma_1_pct?: number | null;
      material?: string | null;
      material_codigo?: string | null;
    }[];
    const inventarioRows = inventarioRes.data ?? [];
    const totalGrams = reportesProd.reduce((s, r) => s + Number(r.oro_recuperado_g ?? 0), 0);
    const todayExpenses = (gastosHoyRes.data ?? []).reduce((s, g) => s + Number(g.monto), 0);
    const monthlyExpenses = (gastosPeriodoRes.data ?? []).reduce((s, g) => s + Number(g.monto), 0);
    const criticalInventory = inventarioRows.filter(
      (i) => Number(i.stock_minimo) > 0 && Number(i.stock_actual) <= Number(i.stock_minimo),
    ).length;
    const activePersonnel = personalRes.count ?? 0;

    const personalCountByArea: Record<string, number> = {};
    for (const p of personalAreasRes.data ?? []) {
      const area = String(p.area ?? '');
      if (!area) continue;
      personalCountByArea[area] = (personalCountByArea[area] ?? 0) + 1;
    }

    // ── Mining Supervisor: Extracción breakdown ──
    const extraccionRows = (extraccionRes?.data ?? []) as { sacos_extraidos: number; fecha: string; vertical?: string; mina?: string }[];
    const sacosExtraidosPeriodo = extraccionRows.reduce((s, r) => s + Number(r.sacos_extraidos ?? 0), 0);
    const sacosExtraidosHoy = extraccionRows
      .filter((r) => r.fecha === today)
      .reduce((s, r) => s + Number(r.sacos_extraidos ?? 0), 0);
    const extraccionesPeriodo = extraccionRows.length;
    const verticalMap = new Map<string, number>();
    for (const r of extraccionRows) {
      const v = String(r.vertical ?? r.mina ?? '').trim();
      if (!v) continue;
      verticalMap.set(v, (verticalMap.get(v) ?? 0) + Number(r.sacos_extraidos ?? 0));
    }
    const miningVerticales = Array.from(verticalMap.entries())
      .map(([name, sacos]) => ({ name, sacos }))
      .sort((a, b) => b.sacos - a.sacos)
      .slice(0, 6);

    // ── Mining Supervisor: Voladuras breakdown ──
    const voladurasRows = (volRes?.data ?? []) as VoladuraRow[];
    const voladurasPeriodo = voladurasRows.length;
    const voladurasConNovedad = voladurasRows.filter((v) => !v.sin_novedad).length;
    const minaMap = new Map<string, { voladuras: number; sinNovedad: boolean }>();
    for (const v of voladurasRows) {
      const m = String(v.mina ?? '').trim();
      if (!m) continue;
      const entry = minaMap.get(m) ?? { voladuras: 0, sinNovedad: true };
      entry.voladuras += 1;
      if (!v.sin_novedad) entry.sinNovedad = false;
      minaMap.set(m, entry);
    }
    const miningMinas = Array.from(minaMap.entries())
      .map(([name, data]) => ({ name, voladuras: data.voladuras, sinNovedad: data.sinNovedad }))
      .sort((a, b) => b.voladuras - a.voladuras)
      .slice(0, 6);

    // ── Mill Supervisor: Acarreo breakdown ──
    const acarreoRows = (acarreoRes?.data ?? []) as { carga_total: number; fecha: string }[];
    const cargaAcarreadaPeriodo = acarreoRows.reduce((s, r) => s + Number(r.carga_total ?? 0), 0);
    const acarreosPeriodo = acarreoRows.length;

    // Removed alerts fetching

    const useCustomWindow = Boolean(desde || hasta);
    let kpiFrom = from;
    let kpiTo = to;

    if (!useCustomWindow) {
      const [latestProdRes, latestQuemadoRes] = await Promise.all([
        safeCatch<{ data: { fecha: string }[]; error: any }>(
          supabase.from('reportes_produccion').select('fecha').order('fecha', { ascending: false }).limit(1),
        ),
        safeCatch<{ data: { fecha: string }[]; error: any }>(
          supabase.from('reportes_quemado').select('fecha').order('fecha', { ascending: false }).limit(1),
        ),
      ]);

      const latestProdDate = latestProdRes?.data?.[0]?.fecha;
      const latestQuemadoDate = latestQuemadoRes?.data?.[0]?.fecha;
      const latestDate = [latestProdDate, latestQuemadoDate].filter(Boolean).sort().at(-1);
      const resolvedMonth = latestDate ? monthWindow(latestDate) : null;
      if (resolvedMonth) {
        kpiFrom = resolvedMonth.from;
        kpiTo = resolvedMonth.to;
      }
    }

    const [kpiProdRes, kpiQuemadoRes] = await Promise.all([
      safeCatch<{ data: ProdRow[]; error: any }>(
        supabase.from('reportes_produccion').select('molino, oro_recuperado_g, material_codigo').gte('fecha', kpiFrom).lte('fecha', kpiTo).limit(1000),
      ),
      safeCatch<{ data: { total_oro_g: number }[]; error: any }>(
        supabase.from('reportes_quemado').select('total_oro_g').gte('fecha', kpiFrom).lte('fecha', kpiTo).limit(1000),
      ),
    ]);

    // ── Producción Mensual (oro_recuperado_g del mes KPI) ──
    const kpiProdRows = (kpiProdRes?.data ?? []) as ProdRow[];
    const produccionMensual = kpiProdRows.reduce((s, r) => s + Number(r.oro_recuperado_g ?? 0), 0);

    // ── Oro Quemado Mensual (total_oro_g del mes KPI) ──
    const kpiQuemadoRows = (kpiQuemadoRes?.data ?? []) as { total_oro_g: number }[];
    const oroQuemadoMensual = kpiQuemadoRows.reduce((s, q) => s + Number(q.total_oro_g ?? 0), 0);

    // ── Balance Plancha 1 (3 verticales por material_codigo + Molino Continuo) ──
    const esVertical = (r: ProdRow) => {
      const c = String(r.material_codigo ?? '').trim();
      return /^V[1-3]/i.test(c);
    };
    const esContinuo = (r: ProdRow) => r.molino?.trim() === 'Molino Continuo';
    const balancePlancha1 = kpiProdRows
      .filter((r) => esVertical(r) || esContinuo(r))
      .reduce((s, r) => s + Number(r.oro_recuperado_g ?? 0), 0);

    // ── Oro Total Recuperado (KPI Principal) ──
    const oroTotalRecuperado = produccionMensual + oroQuemadoMensual;

    const balancesPlanchasArr =
        balancePlancha1 > 0
          ? [{ id: 'plancha-1', label: 'Balance Plancha 1', grams: balancePlancha1 }]
          : [];

    const globalData: GlobalData = {
      totalGrams,
      eqTotal: equiposRes.count ?? 0,
      todayExpenses,
      monthlyExpenses,
      criticalInventory,
      activePersonnel,
      produccionMensual,
      oroTotalRecuperado,
      balancePlancha1,
      balancesPlanchas: balancesPlanchasArr,
      // ── Mining ──
      sacosExtraidosHoy,
      sacosExtraidosPeriodo,
      extraccionesPeriodo,
      voladurasPeriodo,
      voladurasConNovedad,
      equiposOperativos: equiposRes.count ?? 0,
      miningVerticales,
      miningMinas,
      // ── Mill ──
      oroQuemadoPeriodo: oroQuemadoMensual,
      cargaAcarreadaPeriodo,
      acarreosPeriodo,
      produccionesPeriodo: reportesProd.length,
      planchasBreakdown: balancesPlanchasArr.map((p) => ({
        id: p.id,
        label: p.label,
        oro: p.grams,
        amalgama: 0,
      })),
    };

    const locations: LocationData[] = isMiningSupervisor
      ? []
      : (() => {
          const accumMap = new Map<string, Accum>();

          for (const name of ALWAYS_PRESENT) {
            accumMap.set(name, makeAccum(name));
          }

          for (const r of reportesProd) {
            if (!r.molino) continue;

            const key = normalizeMolinoName(String(r.molino));
            const isMant = /mantenimiento/i.test(key);
            const isCoco = /coco/i.test(key);
            const isVarios = /varios/i.test(key);
            if (isVarios) continue;

            if (!accumMap.has(key)) {
              accumMap.set(key, {
                name: key,
                coordinates: NODE_DICT[key] ?? { x: 60, y: 45 },
                status: isMant ? 'Mantenimiento' : isCoco ? 'Inactivo' : 'Activo',
                totalOro: 0, sumTenor: 0, sumMerma: 0, count: 0,
                materiales: new Set<string>(),
                origenes: new Set<string>(),
              });
            }

            const ent = accumMap.get(key)!;
            const oro = Number(r.oro_recuperado_g ?? 0);

            if (oro > 0 && ent.status === 'Inactivo' && !isMant && !isCoco) {
              ent.status = 'Activo';
            }

            ent.totalOro += oro;
            ent.sumTenor += Number(r.tenor_tonelada_gpt ?? 0);
            ent.sumMerma += Number(r.merma_1_pct ?? 0);
            ent.count += 1;

            const mat = String(r.material ?? '').trim();
            if (mat) ent.materiales.add(mat);

            const code = String(r.material_codigo ?? r.material ?? '').trim();
            const vm = code.match(/[Vv](\d+)[Dd](\d+)/);
            if (vm) ent.origenes.add(`V${vm[1]}D${vm[2]}`);
          }

          return Array.from(accumMap.values()).map((e) => ({
            id: e.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
            name: e.name,
            type: 'molino' as const,
            coordinates: e.coordinates,
            status: e.status,
            kpis: {
              produccion: Math.round(e.totalOro * 100) / 100,
              tenor: e.count > 0 ? Math.round((e.sumTenor / e.count) * 100) / 100 : 0,
              merma: e.count > 0 ? Math.round(e.sumMerma / e.count) : 0,
            },
            materiales: Array.from(e.materiales).slice(0, 5),
            origenes: Array.from(e.origenes).slice(0, 6),
          }));
        })();

    return <DashboardMobileWrapper locations={locations} globalData={globalData} role={userRole} />;
  } catch (err) {
    console.error('Dashboard error:', err);
    return (
      <div className="p-8 text-center text-red-500 font-mono">
        Error loading Command Center.
      </div>
    );
  }
}
