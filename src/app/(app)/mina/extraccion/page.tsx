import { createServerClient } from '@/lib/supabase-server';
import ExtraccionGerencialClient, { ExtraccionGerencialData } from './ExtraccionGerencialClient';
import type { ReporteExtraccion } from '@/lib/types';
import { differenceInDays, parseISO, format } from 'date-fns';

export default async function ExtraccionPage(props: {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  const searchParams = await props.searchParams;
  const supabase = await createServerClient();

  const hasParams = !!searchParams?.desde && !!searchParams?.hasta;
  const hoy = new Date();

  let query = supabase
    .from('reportes_extraccion')
    .select('*')
    .order('fecha', { ascending: true })
    .order('created_at', { ascending: true });

  if (hasParams) {
    query = query.gte('fecha', searchParams.desde!).lte('fecha', searchParams.hasta!);
  }

  const { data } = await query;

  const reportes: ReporteExtraccion[] = (data as ReporteExtraccion[]) ?? [];

  const reportesValidos = reportes.filter(
    (r) => r && r.fecha && !Number.isNaN(Date.parse(r.fecha)),
  );

  const fechaDesde = hasParams
    ? searchParams.desde!
    : (reportesValidos.length > 0
      ? reportesValidos[0].fecha
      : format(hoy, 'yyyy-MM-dd'));
  const fechaHasta = hasParams
    ? searchParams.hasta!
    : (reportesValidos.length > 0
      ? reportesValidos[reportesValidos.length - 1].fecha
      : format(hoy, 'yyyy-MM-dd'));

  // 3. Procesamiento en Memoria (Node.js Server-Side)
  let totalSacos = 0;
  let totalDisparos = 0;
  let totalEventos = 0;
  
  // Agrupación diaria
  const agrupacionDiariaMap = new Map<string, { sacos: number; disparos: number; eventos: number }>();
  
  // Prellenar todas las fechas del rango
  const startD = parseISO(fechaDesde);
  const endD = parseISO(fechaHasta);
  const totalDiasRango = Math.max(1, differenceInDays(endD, startD) + 1);

  for (let i = 0; i < totalDiasRango; i++) {
     const d = new Date(startD);
     d.setDate(d.getDate() + i);
     agrupacionDiariaMap.set(format(d, 'yyyy-MM-dd'), { sacos: 0, disparos: 0, eventos: 0 });
  }

  // Llenar datos reales y calcular globales
  reportesValidos.forEach(r => {
    const sacos = Number(r.sacos_extraidos) || 0;
    const isDisparo = r.numero_disparo ? 1 : 0;
    const eventos = r.eventos ? r.eventos.length : 0;

    totalSacos += sacos;
    totalDisparos += isDisparo;
    totalEventos += eventos;
    
    if (agrupacionDiariaMap.has(r.fecha)) {
       const current = agrupacionDiariaMap.get(r.fecha)!;
       current.sacos += sacos;
       current.disparos += isDisparo;
       current.eventos += eventos;
    }
  });

  // Construir Serie Diaria para Gráfico
  const serieDiaria: ExtraccionGerencialData['diaria'] = [];
  agrupacionDiariaMap.forEach((vals, fecha) => {
    serieDiaria.push({
       fecha,
       sacos: vals.sacos,
       disparos: vals.disparos,
       eventos: vals.eventos
    });
  });

  const processedData: ExtraccionGerencialData = {
     kpis: {
        totalSacos,
        totalDisparos,
        totalEventos
     },
     diaria: serieDiaria,
     registros: [...reportesValidos].reverse() // Reverse para mostrar lo más reciente primero en la tabla
  };

  return <ExtraccionGerencialClient data={processedData} selectedDateStr={fechaHasta} />;
}
