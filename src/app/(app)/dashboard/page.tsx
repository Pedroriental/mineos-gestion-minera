import { createServerClient } from '@/lib/supabase-server';
import SatelliteCommandClient, { LocationData, GlobalData } from '@/components/dashboard/SatelliteCommandClient';

export const metadata = { title: 'Command Center - MineOS' };
export const revalidate = 60;

// ══════════════════════════════════════════════════════════════
// DICCIONARIO ESTRICTO DE NODOS FÍSICOS DEL COMPLEJO LA FE
// Coordenadas (x, y) en % — zona segura: X 12-88, Y 22-72
// ══════════════════════════════════════════════════════════════
const NODE_DICT: Record<string, { x: number; y: number }> = {
  'Molino 1':        { x: 30, y: 36 },
  'Molino 2':        { x: 38, y: 48 },
  'Molino 3':        { x: 30, y: 56 },
  'Molino Continuo': { x: 47, y: 41 },
  'Mantenimiento':   { x: 22, y: 44 },
  'Molino 1-2':      { x: 34, y: 41 },
  'Molino 2-3':      { x: 34, y: 53 },
  'Molino 1-3':      { x: 30, y: 46 },
  'Molino 1-2-3':    { x: 34, y: 46 },
};

function safeRandom() {
  return { x: Math.floor(55 + Math.random() * 25), y: Math.floor(30 + Math.random() * 35) };
}

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

export default async function DashboardPage() {
  const supabase = await createServerClient();
  const today = new Date().toISOString().split('T')[0];

  // Inicio del mes actual para el balance de Plancha 1
  const thisMonth = today.slice(0, 7); // "YYYY-MM"

  try {
    const [gastosRes, equiposRes, prodRes, volRes, quemadoRes] = await Promise.all([
      supabase.from('gastos').select('monto').eq('fecha', today),
      supabase.from('equipos').select('estado').eq('activo', true),
      supabase.from('reportes_produccion').select('*').order('fecha', { ascending: false }).limit(500),
      supabase.from('reportes_voladuras').select('*').order('fecha', { ascending: false }).limit(50),
      // Quemado: traemos las planchas del mes actual para calcular Balance Plancha 1
      supabase
        .from('reportes_quemado')
        .select('planchas, total_oro_g, fecha')
        .gte('fecha', `${thisMonth}-01`)
        .lte('fecha', today)
        .order('fecha', { ascending: false }),
    ]);

    const reportesProd   = (prodRes?.data   ?? []) as any[];
    const reportesVol    = (volRes?.data    ?? []) as any[];
    const reportesQuemado = (quemadoRes?.data ?? []) as any[];

    // ── Balance Plancha 1 ─────────────────────────────────────
    // "Plancha 1" corresponde al primer elemento del array JSON `planchas`
    let balancePlancha1 = 0;
    for (const q of reportesQuemado) {
      const planchas = q.planchas as Array<{ amalgama_g: number; oro_recuperado_g: number }> | null;
      if (Array.isArray(planchas) && planchas.length >= 1) {
        balancePlancha1 += Number(planchas[0].oro_recuperado_g ?? 0);
      }
    }
    balancePlancha1 = Math.round(balancePlancha1 * 100) / 100;

    // ── Global Totals ─────────────────────────────────────────
    const totalGrams    = reportesProd.reduce((s, r) => s + Number(r.oro_recuperado_g ?? 0), 0);
    const todayExpenses = (gastosRes.data ?? []).reduce((s, g) => s + Number(g.monto), 0);
    const notifications = reportesVol.slice(0, 1).map((v) => ({
      id: v.id, title: `Voladura: Mina ${v.mina ?? 'Desconocida'}`,
    }));

    const globalData: GlobalData = {
      totalGrams,
      eqTotal: equiposRes.data?.length ?? 0,
      todayExpenses,
      notifications,
      balancePlancha1,
    };

    // ══════════════════════════════════════════════════════════
    // ALGORITMO ENGULLIDOR — Agrupa por nombre normalizado
    // del molino. NO crea nodos por vertical/disparo.
    // ══════════════════════════════════════════════════════════
    const accumMap = new Map<string, Accum>();

    for (const r of reportesProd) {
      if (!r.molino) continue;

      const key    = normalizeMolinoName(String(r.molino));
      const isMant = /mantenimiento/i.test(key);
      const isCoco = /coco/i.test(key);

      if (!accumMap.has(key)) {
        accumMap.set(key, {
          name: key,
          coordinates: NODE_DICT[key] ?? safeRandom(),
          status: isMant ? 'Mantenimiento' : isCoco ? 'Inactivo' : 'Activo',
          totalOro: 0, sumTenor: 0, sumMerma: 0, count: 0,
          materiales: new Set<string>(),
          origenes:   new Set<string>(),
        });
      }

      const ent = accumMap.get(key)!;
      ent.totalOro += Number(r.oro_recuperado_g ?? 0);
      ent.sumTenor += Number(r.tenor_tonelada_gpt ?? 0);
      ent.sumMerma += Number(r.merma_1_pct ?? 0);
      ent.count    += 1;

      const mat  = String(r.material ?? '').trim();
      if (mat) ent.materiales.add(mat);

      const code = String(r.material_codigo ?? r.material ?? '').trim();
      const vm   = code.match(/[Vv](\d+)[Dd](\d+)/);
      if (vm) ent.origenes.add(`V${vm[1]}D${vm[2]}`);
    }

    // Nodo Mantenimiento siempre presente
    if (!accumMap.has('Mantenimiento')) {
      accumMap.set('Mantenimiento', {
        name: 'Mantenimiento',
        coordinates: NODE_DICT['Mantenimiento'],
        status: 'Mantenimiento',
        totalOro: 0, sumTenor: 0, sumMerma: 0, count: 0,
        materiales: new Set(), origenes: new Set(),
      });
    }

    const locations: LocationData[] = Array.from(accumMap.values())
      .filter((e) => e.totalOro > 0 || e.status !== 'Activo')
      .map((e) => ({
        id: e.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
        name: e.name,
        type: 'molino' as const,
        coordinates: e.coordinates,
        status: e.status,
        kpis: {
          produccion: Math.round(e.totalOro * 100) / 100,
          tenor:      e.count > 0 ? Math.round((e.sumTenor / e.count) * 100) / 100 : 0,
          merma:      e.count > 0 ? Math.round(e.sumMerma / e.count) : 0,
        },
        materiales: Array.from(e.materiales).slice(0, 5),
        origenes:   Array.from(e.origenes).slice(0, 6),
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
