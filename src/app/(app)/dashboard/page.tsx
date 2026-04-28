import { createServerClient } from '@/lib/supabase-server';
import SatelliteCommandClient, { LocationData, GlobalData } from '@/components/dashboard/SatelliteCommandClient';

export const metadata = {
  title: 'Command Center - MineOS',
};

export const revalidate = 60;

export default async function DashboardPage() {
  const supabase = await createServerClient();
  const today = new Date().toISOString().split('T')[0];

  try {
    const [
      gastosRes, equiposRes, 
      reportesRes, voladuraRes
    ] = await Promise.all([
      supabase.from('gastos').select('monto').eq('fecha', today),
      supabase.from('equipos').select('estado').eq('activo', true),
      supabase.from('reportes_produccion').select('*').order('fecha', { ascending: false }).limit(500),
      supabase.from('reportes_voladuras').select('*').order('fecha', { ascending: false }).limit(50)
    ]);

    const reportesProd = (reportesRes?.data || []) as any[];
    const reportesVol = (voladuraRes?.data || []) as any[];

    // ── Global Totals ──
    const totalGrams = reportesProd.reduce((s, r) => s + Number(r.oro_recuperado_g || 0), 0);
    const todayExpenses = (gastosRes.data || []).reduce((sum, g) => sum + Number(g.monto), 0);
    const eqData = equiposRes.data || [];

    // Notificaciones (Alertas)
    const recentVol = reportesVol.slice(0, 1).map((v) => ({
      id: v.id, type: 'alert', title: `Voladura Programada: Mina ${v.mina || ''}`,
    }));
    const notifications = [...recentVol];

    const globalData: GlobalData = {
      totalGrams,
      eqTotal: eqData.length,
      todayExpenses,
      notifications,
    };

    // ── Data Mockeada Ultrarrealista (Locations) ──
    const locations: LocationData[] = [
      {
        id: 'mol-cont-01',
        name: 'Molino Continuo',
        type: 'molino',
        coordinates: { x: 42, y: 35 },
        status: 'Activo',
        kpis: { produccion: 254.3, tenor: 4.2, merma: 51 }
      },
      {
        id: 'mol-1-2',
        name: 'Molino 1-2',
        type: 'molino',
        coordinates: { x: 48, y: 38 },
        status: 'Activo',
        kpis: { produccion: 180.5, tenor: 3.8, merma: 55 }
      },
      {
        id: 'mol-2',
        name: 'Molino 2',
        type: 'molino',
        coordinates: { x: 45, y: 45 },
        status: 'Mantenimiento',
        kpis: { produccion: 0, tenor: 0, merma: 0 }
      },
      {
        id: 'mina-belen-2',
        name: 'Mina Belén 2',
        type: 'mina',
        coordinates: { x: 65, y: 60 },
        status: 'Activo',
        kpis: { produccion: 310.0, tenor: 5.1, merma: 48 }
      },
      {
        id: 'veta-caratal',
        name: 'Veta Caratal',
        type: 'mina',
        coordinates: { x: 75, y: 72 },
        status: 'Activo',
        kpis: { produccion: 125.0, tenor: 3.1, merma: 65 } // Merma > 60 para mostrar alerta
      },
      {
        id: 'mina-fe-sur',
        name: 'Mina La Fe Sur',
        type: 'mina',
        coordinates: { x: 30, y: 65 },
        status: 'Inactivo',
        kpis: { produccion: 0, tenor: 0, merma: 0 }
      }
    ];

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
