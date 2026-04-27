import { createServerClient } from '@/lib/supabase-server';
import DashboardClient from '@/components/dashboard/DashboardClient';

export const metadata = {
  title: 'Dashboard - MineOS',
};

// Next.js caching strategy: revalidate on demand or every 60 seconds (optional)
export const revalidate = 60;

export default async function DashboardPage() {
  const supabase = createServerClient();
  const today = new Date().toISOString().split('T')[0];

  try {
    const [
      gastosRes, equiposRes, stockRes, recentExpRes,
      historicalGastosRes, gastosByCatRes,
      balanceDiarioRes, reportesRes,
      voladuraRes, arenasRes, quemadaRes,
    ] = await Promise.all([
      supabase.from('gastos').select('monto').eq('fecha', today),
      supabase.from('equipos').select('estado').eq('activo', true),
      supabase.from('inventario_items').select('id').eq('activo', true).filter('stock_actual', 'lte', 'stock_minimo' as never),
      supabase.from('gastos').select('id, descripcion, monto, fecha, categorias_gasto(nombre)').order('created_at', { ascending: false }).limit(8),
      supabase.from('gastos').select('fecha, monto').order('fecha', { ascending: false }).limit(200),
      supabase.from('gastos').select('monto, categorias_gasto(nombre)').order('created_at', { ascending: false }).limit(500),
      supabase.from('balance_diario').select('*').order('fecha', { ascending: false }).limit(30),
      supabase.from('reportes_produccion').select('*').order('fecha', { ascending: false }).limit(500),
      supabase.from('reportes_voladuras').select('fecha, huecos_cantidad, chupis_cantidad, arroz_kg, numero_disparo, mina, turno, sin_novedad').order('fecha', { ascending: false }).limit(200),
      supabase.from('venta_arenas').select('fecha, cantidad_kg, precio_por_kg, total_venta, comprador').order('fecha', { ascending: false }).limit(200),
      supabase.from('quemada_plancha').select('fecha, gramos_oro_puro_recuperado, gramos_oro_bruto, porcentaje_pureza').order('fecha', { ascending: false }).limit(200),
    ]);

    // ── Gold Price: multi-step fallback ──
    let goldPrice: { usd_gramo: number; usd_onza: number } | null = null;

    // 1) Try today's cache
    const { data: todayCache } = await supabase
      .from('precio_oro_cache')
      .select('precio_usd_por_gramo, precio_usd_por_onza')
      .eq('fecha', today)
      .single();

    if (todayCache) {
      goldPrice = { usd_gramo: Number(todayCache.precio_usd_por_gramo), usd_onza: Number(todayCache.precio_usd_por_onza) };
    }

    // 2) Fallback: most recent cached price
    if (!goldPrice) {
      const { data: latestCache } = await supabase
        .from('precio_oro_cache')
        .select('precio_usd_por_gramo, precio_usd_por_onza')
        .order('fecha', { ascending: false })
        .limit(1)
        .single();

      if (latestCache) {
        goldPrice = { usd_gramo: Number(latestCache.precio_usd_por_gramo), usd_onza: Number(latestCache.precio_usd_por_onza) };
      }
    }

    // 3) Fallback: fetch live from free API and cache it
    if (!goldPrice) {
      try {
        const liveRes = await fetch('https://api.metalpriceapi.com/v1/latest?api_key=demo&base=USD&currencies=XAU', { next: { revalidate: 3600 } });
        if (liveRes.ok) {
          const liveData = await liveRes.json();
          if (liveData?.rates?.XAU) {
            const usdPerOnza = 1 / liveData.rates.XAU;
            const usdPerGramo = usdPerOnza / 31.1035;
            goldPrice = { usd_gramo: Math.round(usdPerGramo * 1000000) / 1000000, usd_onza: Math.round(usdPerOnza * 100) / 100 };
          }
        }
      } catch { /* silent */ }
    }

    // 4) Last resort
    if (!goldPrice) {
      goldPrice = { usd_gramo: 99.68, usd_onza: 3100.00 };
    }

    // Cache the price for today if we got it from a non-cache source
    if (goldPrice && !todayCache) {
      supabase.from('precio_oro_cache').upsert({
        fecha: today,
        precio_usd_por_gramo: goldPrice.usd_gramo,
        precio_usd_por_onza: goldPrice.usd_onza,
        fuente: 'fallback',
      }, { onConflict: 'fecha,fuente' }).then(() => {}); // fire and forget
    }

    const reportesProd = (reportesRes?.data || []) as Array<{
      id: string; fecha: string; molino: string; material: string;
      amalgama_1_g: number; amalgama_2_g: number; oro_recuperado_g: number;
      merma_1_pct: number; merma_2_pct: number; sacos: number;
      toneladas_procesadas: number; tenor_tonelada_gpt: number;
      turno: string; responsable?: string;
    }>;

    // ── Totals ──
    const totalGrams = reportesProd.reduce((s, r) => s + Number(r.oro_recuperado_g || 0), 0);
    const totalSacos = reportesProd.reduce((s, r) => s + (r.sacos || 0), 0);
    const totalTon = reportesProd.reduce((s, r) => s + Number(r.toneladas_procesadas || 0), 0);
    const todayReportes = reportesProd.filter(r => r.fecha === today);
    const todayGrams = todayReportes.reduce((s, r) => s + Number(r.oro_recuperado_g || 0), 0);
    const todaySacos = todayReportes.reduce((s, r) => s + (r.sacos || 0), 0);

    const todayExpenses = (gastosRes.data || []).reduce((sum, g) => sum + Number(g.monto), 0);
    const totalIncome = goldPrice ? totalGrams * goldPrice.usd_gramo : 0;

    // ── Equipment ──
    const eqData = equiposRes.data || [];
    const eqByState = {
      operativo: eqData.filter(e => e.estado === 'operativo').length,
      en_mantenimiento: eqData.filter(e => e.estado === 'en_mantenimiento').length,
      fuera_servicio: eqData.filter(e => e.estado === 'fuera_servicio').length,
      en_reparacion: eqData.filter(e => e.estado === 'en_reparacion').length,
    };

    // ── Production timeline ──
    const prodMap = new Map<string, { sacos: number; oro: number; ton: number }>();
    reportesProd.forEach(r => {
      const e = prodMap.get(r.fecha) || { sacos: 0, oro: 0, ton: 0 };
      e.oro += Number(r.oro_recuperado_g || 0);
      e.sacos += r.sacos || 0;
      e.ton += Number(r.toneladas_procesadas || 0);
      prodMap.set(r.fecha, e);
    });
    const productionTimeline = Array.from(prodMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-15)
      .map(([fecha, v]) => ({
        fecha: new Date(fecha + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }),
        Oro: Math.round(v.oro * 100) / 100,
        Sacos: v.sacos,
        Toneladas: Math.round(v.ton * 100) / 100,
      }));

    // ── Cash flow ──
    let cashFlow: Array<{ fecha: string; Ingresos: number; Gastos: number; Balance: number }> = [];
    if (balanceDiarioRes.data?.length) {
      cashFlow = balanceDiarioRes.data.map(b => ({
        fecha: new Date(b.fecha + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }),
        Ingresos: Math.round(Number(b.ingreso_total_usd)),
        Gastos: Math.round(Number(b.gasto_total_usd)),
        Balance: Math.round(Number(b.rentabilidad_usd)),
      })).reverse();
    } else {
      const dateMap = new Map<string, { income: number; expense: number }>();
      reportesProd.forEach(r => {
        const grams = Number(r.oro_recuperado_g);
        const income = goldPrice ? grams * goldPrice.usd_gramo : grams * 80;
        const e = dateMap.get(r.fecha) || { income: 0, expense: 0 };
        e.income += income;
        dateMap.set(r.fecha, e);
      });
      (historicalGastosRes.data || []).forEach(g => {
        const e = dateMap.get(g.fecha) || { income: 0, expense: 0 };
        e.expense += Number(g.monto);
        dateMap.set(g.fecha, e);
      });
      cashFlow = Array.from(dateMap.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-15).map(([fecha, v]) => ({
        fecha: new Date(fecha + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }),
        Ingresos: Math.round(v.income),
        Gastos: Math.round(v.expense),
        Balance: Math.round(v.income - v.expense),
      }));
    }

    // ── Expenses by category ──
    const catMap = new Map<string, number>();
    (gastosByCatRes.data || []).forEach((g: any) => {
      const name = g.categorias_gasto?.nombre || 'Sin categoría';
      catMap.set(name, (catMap.get(name) || 0) + Number(g.monto));
    });
    const PIE_COLORS = ['#F59E0B', '#3B82F6', '#10B981', '#8B5CF6', '#EF4444', '#06B6D4', '#EC4899', '#64748B'];
    const expensesByCategory = Array.from(catMap.entries())
      .map(([name, value], i) => ({ name, value: Math.round(value), color: PIE_COLORS[i % PIE_COLORS.length] }))
      .sort((a, b) => b.value - a.value).slice(0, 8);

    // ── Merma ──
    const allMermas = reportesProd.filter(r => r.merma_1_pct).map(r => Number(r.merma_1_pct));
    const avgMerma = allMermas.length > 0 ? allMermas.reduce((s, v) => s + v, 0) / allMermas.length : 0;

    // ── Molino breakdown ──
    const molinoMap = new Map<string, { oro: number; sacos: number }>();
    reportesProd.forEach(r => {
      const name = r.molino || 'Desconocido';
      const e = molinoMap.get(name) || { oro: 0, sacos: 0 };
      e.oro += Number(r.oro_recuperado_g);
      e.sacos += r.sacos;
      molinoMap.set(name, e);
    });
    const molinoData = Array.from(molinoMap.entries())
      .map(([name, v], i) => ({ name, oro: Math.round(v.oro * 100) / 100, sacos: v.sacos, color: PIE_COLORS[i % PIE_COLORS.length] }))
      .sort((a, b) => b.oro - a.oro);

    // ── Voladuras ──
    const reportesVol = (voladuraRes.data || []) as Array<{ fecha: string; huecos_cantidad: number; chupis_cantidad: number; arroz_kg: number; numero_disparo?: string; mina?: string; turno: string; sin_novedad: boolean }>;
    const todayVol = reportesVol.filter(v => v.fecha === today);
    const todayHuecos = todayVol.reduce((s, v) => s + (v.huecos_cantidad || 0), 0);
    const todayDisparos = todayVol.filter(v => v.numero_disparo).length;
    const totalHuecosAll = reportesVol.reduce((s, v) => s + (v.huecos_cantidad || 0), 0);
    const totalVolReportes = reportesVol.length;

    // ── Arenas ──
    const arenasData = (arenasRes.data || []) as Array<{ fecha: string; cantidad_kg: number; total_venta: number; comprador: string }>;
    const thisMonth = today.slice(0, 7);
    const arenasMonth = arenasData.filter(a => a.fecha?.startsWith(thisMonth));
    const arenasMonthTon = arenasMonth.reduce((s, a) => s + Number(a.cantidad_kg || 0), 0);
    const arenasMonthRevenue = arenasMonth.reduce((s, a) => s + Number(a.total_venta || 0), 0);
    const totalArenasRevenue = arenasData.reduce((s, a) => s + Number(a.total_venta || 0), 0);

    // ── Quemada ──
    const quemadaData = (quemadaRes.data || []) as Array<{ fecha: string; gramos_oro_puro_recuperado: number; gramos_oro_bruto?: number; porcentaje_pureza?: number }>;
    const totalOroQuemada = quemadaData.reduce((s, q) => s + Number(q.gramos_oro_puro_recuperado || 0), 0);
    const quemadaConPct = quemadaData.filter(q => q.porcentaje_pureza && q.porcentaje_pureza > 0);
    const avgRecupQuemada = quemadaConPct.length > 0 ? quemadaConPct.reduce((s, q) => s + Number(q.porcentaje_pureza), 0) / quemadaConPct.length : 0;

    // ── Recent activity for notifications ──
    const recentProd = reportesProd.slice(0, 3).map(r => ({
      id: r.id, type: 'production' as const, title: `${r.molino} — ${r.material}`,
      desc: `${Number(r.oro_recuperado_g).toFixed(2)}g Au • ${r.sacos} sacos`, date: r.fecha,
    }));
    const recentExp = (recentExpRes.data || []).slice(0, 2).map((g: any) => ({
      id: g.id, type: 'expense' as const, title: g.descripcion,
      desc: `$${Number(g.monto).toLocaleString()}`, date: g.fecha,
    }));
    const recentVol = reportesVol.slice(0, 2).map((v, i) => ({
      id: `vol-${i}`, type: 'voladura' as const, title: `Voladura — ${v.mina || 'Mina'}`,
      desc: `${v.huecos_cantidad} huecos${v.numero_disparo ? ` • Disparo #${v.numero_disparo}` : ''}`, date: v.fecha,
    }));
    const recentArenas = arenasData.slice(0, 1).map((a, i) => ({
      id: `arena-${i}`, type: 'arenas' as const, title: `Arenas — ${a.comprador}`,
      desc: `${Number(a.cantidad_kg).toFixed(1)} ton • $${Number(a.total_venta).toLocaleString()}`, date: a.fecha,
    }));
    const notifications = [...recentProd, ...recentExp, ...recentVol, ...recentArenas]
      .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);

    const data = {
      goldPrice, totalGrams, totalSacos, totalTon, totalIncome,
      todayGrams, todaySacos, todayExpenses,
      eqTotal: eqData.length, eqByState,
      lowStock: stockRes.data?.length || 0,
      productionTimeline, cashFlow,
      expensesByCategory, avgMerma: Math.round(avgMerma * 100) / 100,
      molinoData, notifications, numDays: prodMap.size,
      todayHuecos, todayDisparos, totalHuecosAll, totalVolReportes,
      arenasMonthTon, arenasMonthRevenue, totalArenasRevenue,
      totalOroQuemada, avgRecupQuemada: Math.round(avgRecupQuemada * 10) / 10,
      numQuemadas: quemadaData.length,
    };

    return <DashboardClient data={data} />;

  } catch (err) {
    console.error('Dashboard error:', err);
    return (
      <div className="p-8 text-center text-red-500 font-mono">
        Error loading dashboard data. Please try again later.
      </div>
    );
  }
}
