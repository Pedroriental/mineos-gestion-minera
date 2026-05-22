import { createServerClient } from '@/lib/supabase-server';
import { computePlanchaBalances, resolvePlanchaLines } from '@/lib/dashboard-planchas';
import SatelliteCommandClient, { LocationData, GlobalData } from '@/components/dashboard/SatelliteCommandClient';

export const metadata = { title: 'Command Center - MineOS' };
export const revalidate = 60;

type SearchParams = Promise<{ desde?: string; hasta?: string }>;
interface PageProps {
  searchParams: SearchParams;
}

function periodBounds(desde?: string, hasta?: string) {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const from =
    desde ||
    `${firstDay.getFullYear()}-${String(firstDay.getMonth() + 1).padStart(2, '0')}-${String(firstDay.getDate()).padStart(2, '0')}`;
  const to =
    hasta ||
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return { from, to, today: to };
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

  try {
    const [gastosHoyRes, gastosPeriodoRes, equiposRes, prodRes, volRes, inventarioRes, personalRes] =
      await Promise.all([
        supabase.from('gastos').select('monto').eq('fecha', today),
        supabase.from('gastos').select('monto').gte('fecha', from).lte('fecha', to),
        supabase.from('equipos').select('estado').eq('activo', true),
        supabase
          .from('reportes_produccion')
          .select('molino, oro_recuperado_g, fecha, tenor_tonelada_gpt, merma_1_pct, material, material_codigo')
          .gte('fecha', from)
          .lte('fecha', to)
          .order('fecha', { ascending: false }),
        supabase.from('reportes_voladuras').select('*').order('fecha', { ascending: false }).limit(50),
        supabase.from('inventario_items').select('stock_actual, stock_minimo').eq('activo', true),
        supabase.from('personal').select('id').eq('activo', true).in('area', ['planta', 'mina']),
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
    const reportesVol = (volRes?.data ?? []) as { id: string; mina?: string | null }[];

    const totalGrams = reportesProd.reduce((s, r) => s + Number(r.oro_recuperado_g ?? 0), 0);
    const todayExpenses = (gastosHoyRes.data ?? []).reduce((s, g) => s + Number(g.monto), 0);
    const monthlyExpenses = (gastosPeriodoRes.data ?? []).reduce((s, g) => s + Number(g.monto), 0);
    const criticalInventory = (inventarioRes.data ?? []).filter(
      (i) => Number(i.stock_actual) <= Number(i.stock_minimo),
    ).length;
    const activePersonnel = personalRes.data?.length ?? 0;

    const notifications = reportesVol.slice(0, 1).map((v) => ({
      id: v.id,
      title: `Voladura: Mina ${v.mina ?? 'Desconocida'}`,
    }));

    const planchaLines = await resolvePlanchaLines(supabase);
    const balancesPlanchas = computePlanchaBalances(reportesProd, planchaLines);

    const globalData: GlobalData = {
      totalGrams,
      eqTotal: equiposRes.data?.length ?? 0,
      todayExpenses,
      monthlyExpenses,
      criticalInventory,
      activePersonnel,
      notifications,
      balancesPlanchas,
    };

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

    const locations: LocationData[] = Array.from(accumMap.values()).map((e) => ({
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

    return <SatelliteCommandClient locations={locations} globalData={globalData} />;
  } catch (err) {
    console.error('Dashboard error:', err);
    return (
      <div className="p-8 text-center text-red-500 font-mono">
        Error loading Command Center.
      </div>
    );
  }
}
