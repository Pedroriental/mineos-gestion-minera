import { createServerClient } from '@/lib/supabase-server';
import SatelliteCommandClient, { LocationData, GlobalData } from '@/components/dashboard/SatelliteCommandClient';

export const metadata = { title: 'Command Center - MineOS' };
export const revalidate = 60;

// Molinos que forman la LÍNEA PRINCIPAL (Plancha 1)
const LINEA_PRINCIPAL = new Set([
  'molino 1', 'molino 2', 'molino 3',
  'molino 1-2', 'molino 1-3', 'molino 2-3', 'molino 1-2-3',
]);

// ══════════════════════════════════════════════════════════════
// DICCIONARIO ESTRICTO DE NODOS FÍSICOS DEL COMPLEJO LA FE
// Coordenadas centradas (x 38-62, y 28-68) — diagrama de flujo planta ├║nica
// Flujo: Mantenimiento(izq) -> Molinos 1-2-3(centro) -> Continuo(der)
const NODE_DICT: Record<string, { x: number; y: number }> = {
  'Molino 1':        { x: 44, y: 34 },
  'Molino 2':        { x: 50, y: 46 },
  'Molino 3':        { x: 44, y: 58 },
  'Molino Continuo': { x: 60, y: 46 },
  'Mantenimiento':   { x: 36, y: 46 },
  'Molino 1-2':      { x: 47, y: 40 },
  'Molino 2-3':      { x: 47, y: 53 },
  'Molino 1-3':      { x: 44, y: 46 },
  'Molino 1-2-3':    { x: 50, y: 46 },
};

// Los 5 nodos físicos que SIEMPRE deben estar presentes en el mapa
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

export default async function DashboardPage() {
  const supabase = await createServerClient();
  const today = new Date().toISOString().split('T')[0];

  try {
    const [gastosRes, equiposRes, prodRes, volRes] = await Promise.all([
      supabase.from('gastos').select('monto').eq('fecha', today),
      supabase.from('equipos').select('estado').eq('activo', true),
      supabase.from('reportes_produccion').select('*').order('fecha', { ascending: false }).limit(500),
      supabase.from('reportes_voladuras').select('*').order('fecha', { ascending: false }).limit(50),
    ]);

    const reportesProd = (prodRes?.data ?? []) as any[];
    const reportesVol  = (volRes?.data  ?? []) as any[];

    // ── Global Totals ─────────────────────────────────────────
    const totalGrams    = reportesProd.reduce((s, r) => s + Number(r.oro_recuperado_g ?? 0), 0);
    const todayExpenses = (gastosRes.data ?? []).reduce((s, g) => s + Number(g.monto), 0);
    const notifications = reportesVol.slice(0, 1).map((v) => ({
      id: v.id, title: `Voladura: Mina ${v.mina ?? 'Desconocida'}`,
    }));

    // ── Balance Plancha 1 ─────────────────────────────────────
    const balancePlancha1 = Math.round(
      reportesProd
        .filter((r) => LINEA_PRINCIPAL.has(String(r.molino ?? '').trim().toLowerCase()))
        .reduce((s, r) => s + Number(r.oro_recuperado_g ?? 0), 0) * 100
    ) / 100;

    const globalData: GlobalData = {
      totalGrams,
      eqTotal: equiposRes.data?.length ?? 0,
      todayExpenses,
      notifications,
      balancePlancha1,
    };

    // ══════════════════════════════════════════════════════════
    // ALGORITMO ENGULLIDOR
    // 1. Pre-carga los 5 nodos físicos obligatorios (ALWAYS_PRESENT)
    //    con produccion=0 e Inactivo (o Mantenimiento para ese nodo).
    // 2. Luego agrupa todos los reportes, actualizando o creando nodos.
    // 3. Los combinados (1-2, 1-3, etc.) se agregan si tienen reportes.
    // ══════════════════════════════════════════════════════════
    const accumMap = new Map<string, Accum>();

    // Paso 1 — 5 nodos físicos siempre presentes
    for (const name of ALWAYS_PRESENT) {
      accumMap.set(name, makeAccum(name));
    }

    // Paso 2 — procesar reportes
    for (const r of reportesProd) {
      if (!r.molino) continue;

      const key    = normalizeMolinoName(String(r.molino));
      const isMant = /mantenimiento/i.test(key);
      const isCoco = /coco/i.test(key);
      const isVarios = /varios/i.test(key);
      if (isVarios) continue; // excluir "varios"

      if (!accumMap.has(key)) {
        accumMap.set(key, {
          name: key,
          coordinates: NODE_DICT[key] ?? { x: 60, y: 45 },
          status: isMant ? 'Mantenimiento' : isCoco ? 'Inactivo' : 'Activo',
          totalOro: 0, sumTenor: 0, sumMerma: 0, count: 0,
          materiales: new Set<string>(),
          origenes:   new Set<string>(),
        });
      }

      const ent = accumMap.get(key)!;
      const oro = Number(r.oro_recuperado_g ?? 0);

      // Si el nodo tenía datos (se acaba de actualizar desde producción),
      // cambiar su status a Activo si tiene oro
      if (oro > 0 && ent.status === 'Inactivo' && !isMant && !isCoco) {
        ent.status = 'Activo';
      }

      ent.totalOro += oro;
      ent.sumTenor += Number(r.tenor_tonelada_gpt ?? 0);
      ent.sumMerma += Number(r.merma_1_pct ?? 0);
      ent.count    += 1;

      const mat = String(r.material ?? '').trim();
      if (mat) ent.materiales.add(mat);

      const code = String(r.material_codigo ?? r.material ?? '').trim();
      const vm   = code.match(/[Vv](\d+)[Dd](\d+)/);
      if (vm) ent.origenes.add(`V${vm[1]}D${vm[2]}`);
    }

    const locations: LocationData[] = Array.from(accumMap.values())
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
