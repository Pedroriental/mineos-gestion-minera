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

  // 2. Consulta Única a Supabase
  let query = supabase
    .from('reportes_produccion')
    .select('*')
    .order('fecha', { ascending: true })
    .order('created_at', { ascending: true });

  if (hasParams) {
    query = query.gte('fecha', searchParams.desde!).lte('fecha', searchParams.hasta!);
  }

  const { data } = await query;
  const reportes: ReporteProduccion[] = (data as ReporteProduccion[]) ?? [];

  // 2b. Cargar total oro quemado del mismo período
  let quemadoQuery = supabase
    .from('reportes_quemado')
    .select('total_oro_g');
  if (hasParams) {
    quemadoQuery = quemadoQuery.gte('fecha', searchParams.desde!).lte('fecha', searchParams.hasta!);
  }
  const { data: quemadoData } = await quemadoQuery;
  const totalOroQuemado = (quemadoData ?? []).reduce((s: number, r: any) => s + (Number(r.total_oro_g) || 0), 0);

  // 3. Fechas Efectivas para el Gráfico
  const fechaDesde = hasParams ? searchParams.desde! : (reportes.length > 0 ? reportes[0].fecha : format(hoy, 'yyyy-MM-dd'));
  const fechaHasta = hasParams ? searchParams.hasta! : (reportes.length > 0 ? reportes[reportes.length - 1].fecha : format(hoy, 'yyyy-MM-dd'));

  // 3. Procesamiento en Memoria (Node.js Server-Side)
  let totalOro = 0;
  let totalTon = 0;
  
  // Agrupación diaria
  const produccionDiariaMap = new Map<string, { oro: number; ton: number }>();
  
  // Prellenar el mapa con todas las fechas del rango para asegurar continuidad en el gráfico
  const startD = parseISO(fechaDesde);
  const endD = parseISO(fechaHasta);
  const totalDiasRango = Math.max(1, differenceInDays(endD, startD) + 1);

  for (let i = 0; i < totalDiasRango; i++) {
     const d = new Date(startD);
     d.setDate(d.getDate() + i);
     produccionDiariaMap.set(format(d, 'yyyy-MM-dd'), { oro: 0, ton: 0 });
  }

  // Llenar datos reales
  reportes.forEach(r => {
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
    serieDiaria.push({
       fecha,
       oro: Number(vals.oro.toFixed(2)),
       oroAcumulado: Number(oroAcumulado.toFixed(2)),
       metaDiaria: DAILY_GOLD_TARGET,
       metaAcumulada: metaAcumulada,
       tenor: vals.ton > 0 ? Number((vals.oro / vals.ton).toFixed(2)) : 0,
       toneladas: Number(vals.ton.toFixed(2))
    });
  });

  // 4. Cálculo de KPIs Generales
  const metaTotalOro = totalDiasRango * DAILY_GOLD_TARGET;
  const cumplimientoOro = metaTotalOro > 0 ? ((totalOro - metaTotalOro) / metaTotalOro) * 100 : 0;
  
  const tenorPromedio = totalTon > 0 ? totalOro / totalTon : 0;

  // Eficiencia Molino simulada basada en data existente (Días productivos vs Días inactivos)
  const diasProductivos = Array.from(produccionDiariaMap.values()).filter(v => v.ton > 0).length;
  const eficienciaMolino = (diasProductivos / totalDiasRango) * 100;

  const eficienciaData = [
     { name: 'Operativo', value: diasProductivos },
     { name: 'Inactivo', value: totalDiasRango - diasProductivos }
  ];

  const processedData: ProduccionGerencialData = {
     kpis: {
        oroRecuperado: Number(totalOro.toFixed(2)),
        toneladas: Number(totalTon.toFixed(2)),
        tenorPromedio: Number(tenorPromedio.toFixed(2)),
        eficienciaMolino: eficienciaMolino,
        cumplimientoOro: cumplimientoOro,
        cumplimientoTon: 95.5 // Dummy / placeholder value as Ton target wasn't specified
     },
     diaria: serieDiaria,
     eficienciaData,
     registros: reportes.reverse() // Revertir para que la tabla muestre lo más reciente primero
  };

  return <ProduccionGerencialClient data={processedData} selectedDateStr={fechaHasta} totalOroQuemado={totalOroQuemado} />;
}
