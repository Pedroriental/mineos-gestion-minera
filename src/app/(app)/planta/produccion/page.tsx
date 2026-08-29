import { createServerClient } from '@/lib/supabase-server';
import ProduccionGerencialClient, { ProduccionGerencialData } from './ProduccionGerencialClient';
import type { ReporteProduccion } from '@/lib/types';
import { differenceInDays, parseISO, format } from 'date-fns';

const DAILY_GOLD_TARGET = 15; // 15g de Au/día según requerimiento de Planta

export default async function ProduccionPage(props: {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  const searchParams = await props.searchParams;
  const supabase = await createServerClient();

  // 1. Manejo de Fechas
  const hasParams = !!searchParams?.desde && !!searchParams?.hasta;
  const hoy = new Date();

  let query = supabase
    .from('reportes_produccion')
    .select('*')
    .order('fecha', { ascending: true })
    .order('created_at', { ascending: true });

  if (hasParams) {
    query = query.gte('fecha', searchParams.desde!).lte('fecha', searchParams.hasta!);
  }

  // 2. Consulta en paralelo a Supabase
  const [{ data }, { data: quemadoData }] = await Promise.all([
    query,
    supabase
      .from('reportes_quemado')
      .select('total_oro_g, fecha')
      .order('fecha', { ascending: false })
      .limit(2),
  ]);

  const reportes: ReporteProduccion[] = (data as ReporteProduccion[]) ?? [];
  const totalOroQuemado = (quemadoData ?? []).reduce((s: number, r: any) => s + (Number(r.total_oro_g) || 0), 0);
  const countQuemado    = (quemadoData ?? []).length;

  // 3. Filtrar registros válidos para evitar caídas por datos corruptos
  const reportesValidos = reportes.filter(
    (r) => r && r.fecha && !isNaN(Date.parse(r.fecha))
  );

  // 3b. Fechas Efectivas para el Gráfico
  const fechaDesde = hasParams 
    ? searchParams.desde! 
    : (reportesValidos.length > 0 && reportesValidos[0].fecha ? reportesValidos[0].fecha : format(hoy, 'yyyy-MM-dd'));
  const fechaHasta = hasParams 
    ? searchParams.hasta! 
    : (reportesValidos.length > 0 && reportesValidos[reportesValidos.length - 1].fecha ? reportesValidos[reportesValidos.length - 1].fecha : format(hoy, 'yyyy-MM-dd'));

  // 3c. Procesamiento en Memoria (Node.js Server-Side)
  let totalOro = 0;
  let totalTon = 0;
  
  // Agrupación diaria
  const produccionDiariaMap = new Map<string, { oro: number; ton: number }>();
  
  // Prellenar el mapa con todas las fechas del rango para asegurar continuidad en el gráfico
  const startD = parseISO(fechaDesde);
  const endD = parseISO(fechaHasta);
  
  let totalDiasRango = 1;
  if (!isNaN(startD.getTime()) && !isNaN(endD.getTime())) {
    totalDiasRango = Math.max(1, differenceInDays(endD, startD) + 1);
  }

  for (let i = 0; i < totalDiasRango; i++) {
     const d = new Date(startD);
     d.setDate(d.getDate() + i);
     produccionDiariaMap.set(format(d, 'yyyy-MM-dd'), { oro: 0, ton: 0 });
  }

  // Llenar datos reales
  reportesValidos.forEach(r => {
    const oro = Number(r.oro_recuperado_g) || 0;
    const ton = Number(r.toneladas_procesadas) || 0;
    totalOro += oro;
    totalTon += ton;
    
    if (produccionDiariaMap.has(r.fecha)) {
       const current = produccionDiariaMap.get(r.fecha)!;
       current.oro += oro;
       current.ton += ton;
    }
  });

  // Construir Serie de Tiempo (Diaria)
  const serieDiaria: ProduccionGerencialData['diaria'] = [];
  let metaAcumulada = 0;
  let oroAcumulado = 0;

  produccionDiariaMap.forEach((vals, fecha) => {
    metaAcumulada += DAILY_GOLD_TARGET;
    oroAcumulado += vals.oro;
    
    const tenorVal = vals.ton > 0 ? vals.oro / vals.ton : 0;
    
    serieDiaria.push({
       fecha,
       oro: Number(vals.oro.toFixed(2)),
       oroAcumulado: Number(oroAcumulado.toFixed(2)),
       metaDiaria: DAILY_GOLD_TARGET,
       metaAcumulada: metaAcumulada,
       tenor: isFinite(tenorVal) ? Number(tenorVal.toFixed(2)) : 0,
       toneladas: Number(vals.ton.toFixed(2))
    });
  });

  // 4. Cálculo de KPIs Generales de forma ultra segura
  const metaTotalOro = totalDiasRango * DAILY_GOLD_TARGET;
  const rawCumplimientoOro = metaTotalOro > 0 ? ((totalOro - metaTotalOro) / metaTotalOro) * 100 : 0;
  const cumplimientoOro = isFinite(rawCumplimientoOro) ? rawCumplimientoOro : 0;
  
  const rawTenorPromedio = totalTon > 0 ? totalOro / totalTon : 0;
  const tenorPromedio = isFinite(rawTenorPromedio) ? rawTenorPromedio : 0;

  // Eficiencia Molino simulada
  const diasProductivos = Array.from(produccionDiariaMap.values()).filter(v => v.ton > 0).length;
  const rawEficienciaMolino = totalDiasRango > 0 ? (diasProductivos / totalDiasRango) * 100 : 0;
  const eficienciaMolino = isFinite(rawEficienciaMolino) ? rawEficienciaMolino : 0;

  const eficienciaData = [
     { name: 'Operativo', value: diasProductivos },
     { name: 'Inactivo', value: Math.max(0, totalDiasRango - diasProductivos) }
  ];

  const processedData: ProduccionGerencialData = {
     kpis: {
        oroRecuperado: Number(totalOro.toFixed(2)),
        toneladas: Number(totalTon.toFixed(2)),
        tenorPromedio: Number(tenorPromedio.toFixed(2)),
        eficienciaMolino: eficienciaMolino,
        cumplimientoOro: cumplimientoOro,
        cumplimientoTon: 95.5
     },
     diaria: serieDiaria,
     eficienciaData,
     registros: [...reportesValidos].reverse()
  };

  return <ProduccionGerencialClient data={processedData} selectedDateStr={fechaHasta} totalOroQuemado={totalOroQuemado} countQuemado={countQuemado} />;
}
