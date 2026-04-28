import { createServerClient } from '@/lib/supabase-server';
import SatelliteCommandClient, { LocationData, GlobalData } from '@/components/dashboard/SatelliteCommandClient';

export const metadata = {
  title: 'Command Center - MineOS',
};

export const revalidate = 60;

// ── Coordenadas Conocidas para el Radar ──
const KNOWN_COORDS: Record<string, { x: number, y: number }> = {
  'Molino Continuo': { x: 42, y: 35 },
  'Molino 1': { x: 46, y: 38 },
  'Molino 2': { x: 48, y: 42 },
  'Molino 3': { x: 50, y: 40 },
  'Molino 1-2': { x: 47, y: 39 },
  'Molino 1-3': { x: 48, y: 39 },
  'Molino 2-3': { x: 49, y: 41 },
  'Molino Coco': { x: 38, y: 35 },
  'Mina Belén 2': { x: 65, y: 60 },
  'Veta Caratal': { x: 75, y: 72 },
  'Mina La Fe Sur': { x: 30, y: 65 },
};

function getSafeRandomCoord() {
  // Guardrail Espacial: X entre 10% y 90%, Y entre 20% y 75%
  return {
    x: Math.floor(10 + Math.random() * 80),
    y: Math.floor(20 + Math.random() * 55)
  };
}

export default async function DashboardPage() {
  const supabase = await createServerClient();
  const today = new Date().toISOString().split('T')[0];

  try {
    const [
      gastosRes, equiposRes, 
      reportesProdRes, reportesExtRes, voladuraRes
    ] = await Promise.all([
      supabase.from('gastos').select('monto').eq('fecha', today),
      supabase.from('equipos').select('estado').eq('activo', true),
      supabase.from('reportes_produccion').select('*').order('fecha', { ascending: false }).limit(500),
      supabase.from('reportes_extraccion').select('*').order('fecha', { ascending: false }).limit(500),
      supabase.from('reportes_voladuras').select('*').order('fecha', { ascending: false }).limit(50)
    ]);

    const reportesProd = (reportesProdRes?.data || []) as any[];
    const reportesExt = (reportesExtRes?.data || []) as any[];
    const reportesVol = (voladuraRes?.data || []) as any[];

    // ── Global Totals ──
    const totalGrams = reportesProd.reduce((s, r) => s + Number(r.oro_recuperado_g || 0), 0);
    const todayExpenses = (gastosRes.data || []).reduce((sum, g) => sum + Number(g.monto), 0);
    const eqData = equiposRes.data || [];

    // Notificaciones (Alertas)
    const notifications = reportesVol.slice(0, 1).map((v) => ({
      id: v.id, type: 'alert', title: `Voladura: Mina ${v.mina || 'Desconocida'}`,
    }));

    const globalData: GlobalData = {
      totalGrams,
      eqTotal: eqData.length,
      todayExpenses,
      notifications,
    };

    // ════════════════════════════════════════════════════════════
    // ALGORITMO ENGULLIDOR Y DE AGRUPACIÓN (TS)
    // ════════════════════════════════════════════════════════════
    const mapEntities = new Map<string, LocationData>();

    // Helper para inicializar entidad si no existe
    const getOrInitEntity = (id: string, name: string, type: 'molino' | 'mina'): LocationData => {
      if (!mapEntities.has(id)) {
        let status: 'Activo' | 'Mantenimiento' | 'Inactivo' = 'Activo';
        
        // Reglas de Status
        if (name.toLowerCase().includes('coco')) status = 'Inactivo';

        mapEntities.set(id, {
          id,
          name,
          type,
          coordinates: KNOWN_COORDS[name] || getSafeRandomCoord(),
          status,
          kpis: { produccion: 0, tenor: 0, merma: 0 },
          _count: 0, // variable temporal para promedios
          _sumMermas: 0
        } as LocationData & { _count: number, _sumMermas: number });
      }
      return mapEntities.get(id)!;
    };

    // 1. Parsear Reportes de Producción (Molinos)
    reportesProd.forEach(r => {
      if (!r.molino) return;
      const molinoName = String(r.molino).trim();
      
      const entity = getOrInitEntity(molinoName.toLowerCase().replace(/\s+/g, '-'), molinoName, 'molino') as any;
      
      // Aseguramos sumar sin discriminar el tipo de material (Guardrail 2)
      entity.kpis.produccion += Number(r.oro_recuperado_g || 0);
      
      // Calculo de Tenor Acumulado Simplificado y Promedio de Merma
      entity.kpis.tenor += Number(r.tenor_tonelada_gpt || 0); 
      entity._sumMermas += Number(r.merma_1_pct || 0);
      entity._count += 1;
    });

    // 2. Parsear Reportes de Extracción (Verticales / Minas)
    reportesExt.forEach(r => {
      let minaName = String(r.mina || r.vertical || 'Mina Desconocida').trim();
      
      // Detector de Regex para Verticales (V2D25)
      // Si el vertical dice "Vertical 2" y el disparo "25" -> V2D25
      const verticalMatch = String(r.vertical || '').match(/vertical\s*(\d+)/i);
      if (verticalMatch && r.numero_disparo) {
        minaName = `V${verticalMatch[1]}D${r.numero_disparo}`;
      }

      const entity = getOrInitEntity(minaName.toLowerCase().replace(/\s+/g, '-'), minaName, 'mina') as any;
      
      entity.kpis.produccion += Number(r.sacos_extraidos || 0); // En extraccion, la produccion la medimos en sacos
      entity.kpis.tenor = 0; // No hay tenor directo en extraccion
      entity._count += 1;
    });

    // 3. Finalizar promedios y mapear a Array
    const locations: LocationData[] = Array.from(mapEntities.values()).map((ent: any) => {
      if (ent._count > 0 && ent.type === 'molino') {
        ent.kpis.merma = Math.round(ent._sumMermas / ent._count);
        // Tenor real sumado / count (simplificacion)
        ent.kpis.tenor = Math.round((ent.kpis.tenor / ent._count) * 100) / 100;
        ent.kpis.produccion = Math.round(ent.kpis.produccion * 100) / 100;
      }
      // Limpiar propiedades temporales
      delete ent._count;
      delete ent._sumMermas;
      return ent;
    });

    // Inyectar el Molino Coco si no vino en la data para asegurar que se vea inactivo
    if (!locations.some(l => l.name.includes('Coco'))) {
       locations.push({
          id: 'molino-coco',
          name: 'Molino Coco',
          type: 'molino',
          coordinates: KNOWN_COORDS['Molino Coco'],
          status: 'Inactivo',
          kpis: { produccion: 0, tenor: 0, merma: 0 }
       });
    }

    return <SatelliteCommandClient locations={locations} globalData={globalData} />;

  } catch (err) {
    console.error('Dashboard error:', err);
    return (
      <div className="p-8 text-center text-red-500 font-mono">
        Error loading Command Center. Please try again later.
      </div>
    );
  }
}
