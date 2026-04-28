import { createServerClient } from '@/lib/supabase-server';
import SatelliteCommandClient, { LocationData, GlobalData } from '@/components/dashboard/SatelliteCommandClient';

export const metadata = {
  title: 'Command Center - MineOS',
};

export const revalidate = 60;

// ══════════════════════════════════════════════════════════════
// DICCIONARIO DE NODOS FIJOS DEL COMPLEJO MINERO "LA FE"
// Coordenadas (x, y) en % del viewport. Diseñadas para no
// superponerse y distribuirse lógicamente en el mapa.
// ══════════════════════════════════════════════════════════════
const NODE_COORDS: Record<string, { x: number; y: number }> = {
  // Molinos individuales — zona central-izquierda
  'Molino 1':        { x: 32, y: 38 },
  'Molino 2':        { x: 38, y: 44 },
  'Molino 3':        { x: 32, y: 50 },
  'Molino Continuo': { x: 44, y: 41 },
  'Molino Coco':     { x: 26, y: 44 },

  // Combinaciones — posición intermedia entre sus componentes
  'Molino 1-2':      { x: 35, y: 40 },
  'Molino 1-3':      { x: 32, y: 44 },
  'Molino 2-3':      { x: 35, y: 47 },
  'Molino 1-2-3':    { x: 38, y: 40 },

  // Nodo de Mantenimiento
  'Mantenimiento':   { x: 24, y: 36 },
};

function getSafeRandomCoord() {
  // Guardrail Espacial: X 12-88%, Y 22-72%
  return {
    x: Math.floor(12 + Math.random() * 76),
    y: Math.floor(22 + Math.random() * 50),
  };
}

// Estructura interna extendida durante el procesamiento
interface EntityAccum {
  name: string;
  type: 'molino';
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

  try {
    const [gastosRes, equiposRes, reportesProdRes, voladuraRes] = await Promise.all([
      supabase.from('gastos').select('monto').eq('fecha', today),
      supabase.from('equipos').select('estado').eq('activo', true),
      supabase.from('reportes_produccion').select('*').order('fecha', { ascending: false }).limit(500),
      supabase.from('reportes_voladuras').select('*').order('fecha', { ascending: false }).limit(50),
    ]);

    const reportesProd = (reportesProdRes?.data || []) as any[];
    const reportesVol = (voladuraRes?.data || []) as any[];

    // ── Global Totals ──
    const totalGrams = reportesProd.reduce((s, r) => s + Number(r.oro_recuperado_g || 0), 0);
    const todayExpenses = (gastosRes.data || []).reduce((sum, g) => sum + Number(g.monto), 0);
    const eqData = equiposRes.data || [];

    const notifications = reportesVol.slice(0, 1).map((v) => ({
      id: v.id,
      type: 'alert',
      title: `Voladura: Mina ${v.mina || 'Desconocida'}`,
    }));

    const globalData: GlobalData = {
      totalGrams,
      eqTotal: eqData.length,
      todayExpenses,
      notifications,
    };

    // ══════════════════════════════════════════════════════════════
    // ALGORITMO ENGULLIDOR — Agrupa EXACTAMENTE por nombre de molino
    // ══════════════════════════════════════════════════════════════
    const entityMap = new Map<string, EntityAccum>();

    reportesProd.forEach((r) => {
      const molinoRaw = String(r.molino || '').trim();
      if (!molinoRaw) return; // Ignorar reportes sin molino

      // Normaliza nombre conservando combinaciones como "Molino 1-3"
      // pero capitalizando correctamente
      const molinoKey = molinoRaw;

      if (!entityMap.has(molinoKey)) {
        const isMantenimiento = molinoKey.toLowerCase().includes('mantenimiento');
        const isCoco = molinoKey.toLowerCase().includes('coco');

        entityMap.set(molinoKey, {
          name: molinoKey,
          type: 'molino',
          coordinates: NODE_COORDS[molinoKey] ?? getSafeRandomCoord(),
          status: isMantenimiento ? 'Mantenimiento' : isCoco ? 'Inactivo' : 'Activo',
          totalOro: 0,
          sumTenor: 0,
          sumMerma: 0,
          count: 0,
          materiales: new Set<string>(),
          origenes: new Set<string>(),
        });
      }

      const ent = entityMap.get(molinoKey)!;

      // Guardrail Material: suma todo sin discriminar tipo de material
      ent.totalOro += Number(r.oro_recuperado_g || 0);
      ent.sumTenor += Number(r.tenor_tonelada_gpt || 0);
      ent.sumMerma += Number(r.merma_1_pct || 0);
      ent.count += 1;

      // Extraer Material y Origen (Vertical/Disparo)
      if (r.material) ent.materiales.add(String(r.material).trim());
      // El "origen" del material viene del campo material_codigo o turno/responsable
      // En tu esquema, el Vertical/Disparo no está en producción directamente,
      // pero si se guarda en 'material' como código, lo capturamos:
      const materialCode = String(r.material_codigo || r.material || '').trim();
      const verticalMatch = materialCode.match(/v(\d+)d(\d+)/i);
      if (verticalMatch) {
        ent.origenes.add(`V${verticalMatch[1]}D${verticalMatch[2]}`);
      }
    });

    // ── Garantizar que Molino Coco aparezca como Inactivo aunque no tenga reportes ──
    if (!entityMap.has('Molino Coco')) {
      entityMap.set('Molino Coco', {
        name: 'Molino Coco',
        type: 'molino',
        coordinates: NODE_COORDS['Molino Coco'],
        status: 'Inactivo',
        totalOro: 0,
        sumTenor: 0,
        sumMerma: 0,
        count: 0,
        materiales: new Set(),
        origenes: new Set(),
      });
    }

    // ── Construir array final de LocationData (solo con producción > 0 O Inactivos) ──
    const locations: LocationData[] = Array.from(entityMap.values())
      .filter((e) => e.totalOro > 0 || e.status !== 'Activo') // Solo activos con prod + todos los inactivos/mant.
      .map((e) => ({
        id: e.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
        name: e.name,
        type: e.type,
        coordinates: e.coordinates,
        status: e.status,
        kpis: {
          produccion: Math.round(e.totalOro * 100) / 100,
          tenor: e.count > 0 ? Math.round((e.sumTenor / e.count) * 100) / 100 : 0,
          merma: e.count > 0 ? Math.round(e.sumMerma / e.count) : 0,
        },
        materiales: Array.from(e.materiales),
        origenes: Array.from(e.origenes),
      }));

    return <SatelliteCommandClient locations={locations} globalData={globalData} />;
  } catch (err) {
    console.error('Dashboard error:', err);
    return (
      <div className="p-8 text-center text-red-500 font-mono">
        Error loading Command Center. Please try again.
      </div>
    );
  }
}
