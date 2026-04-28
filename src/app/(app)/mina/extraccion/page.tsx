import { createServerClient } from '@/lib/supabase-server';
import ExtraccionGerencialClient, { ExtraccionGerencialData } from './ExtraccionGerencialClient';
import type { ReporteExtraccion } from '@/lib/types';
import { differenceInDays, parseISO, format, subDays } from 'date-fns';

export default async function ExtraccionPage(props: {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  const searchParams = await props.searchParams;
  const supabase = await createServerClient();

  // 1. Manejo de Fechas (Fallback 30 días)
  const hoy = new Date();
  const fechaHasta = searchParams?.hasta || format(hoy, 'yyyy-MM-dd');
  const fechaDesde = searchParams?.desde || format(subDays(hoy, 30), 'yyyy-MM-dd');

  // 2. Consulta a Supabase con filtro de fechas estricto
  const { data } = await supabase
    .from('reportes_extraccion')
    .select('*')
    .gte('fecha', fechaDesde)
    .lte('fecha', fechaHasta)
    .order('fecha', { ascending: true })
    .order('created_at', { ascending: true });

  const reportes: ReporteExtraccion[] = (data as ReporteExtraccion[]) ?? [];

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
  reportes.forEach(r => {
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
     registros: reportes.reverse() // Reverse para mostrar lo más reciente primero en la tabla
  };

  return <ExtraccionGerencialClient data={processedData} selectedDateStr={fechaHasta} />;
}
