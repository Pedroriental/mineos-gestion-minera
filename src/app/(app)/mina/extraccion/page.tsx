import { createServerClient } from '@/lib/supabase-server';
import ExtraccionGerencialClient, { ExtraccionGerencialData } from './ExtraccionGerencialClient';
import type { ReporteExtraccion } from '@/lib/types';
import { format } from 'date-fns';

export default async function ExtraccionPage(props: {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  const searchParams = await props.searchParams;
  const supabase = await createServerClient();

  const hasParams = !!searchParams?.desde && !!searchParams?.hasta;
  const hoy = new Date();

  let query = supabase.from('reportes_extraccion').select('*');

  if (hasParams) {
    query = query
      .gte('fecha', searchParams.desde!)
      .lte('fecha', searchParams.hasta!)
      .order('fecha', { ascending: true })
      .order('created_at', { ascending: true });
  } else {
    query = query
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(500);
  }

  const { data } = await query;

  const reportes: ReporteExtraccion[] = (data as ReporteExtraccion[]) ?? [];

  const reportesValidos = reportes.filter(
    (r) => r && r.fecha && !Number.isNaN(Date.parse(r.fecha)),
  );

  const fechaHasta = hasParams
    ? searchParams.hasta!
    : (reportesValidos.length > 0
      ? reportesValidos[0].fecha
      : format(hoy, 'yyyy-MM-dd'));

  // 3. Procesamiento en Memoria (Node.js Server-Side)
  let totalSacos = 0;
  let totalDisparos = 0;
  let totalEventos = 0;
  
  // Agrupación diaria — solo días con registros (sin prellenar rangos vacíos)
  const agrupacionDiariaMap = new Map<string, { sacos: number; disparos: number; eventos: number }>();

  reportesValidos.forEach((r) => {
    const sacos = Number(r.sacos_extraidos) || 0;
    const isDisparo = r.numero_disparo ? 1 : 0;
    const eventos = r.eventos ? r.eventos.length : 0;

    totalSacos += sacos;
    totalDisparos += isDisparo;
    totalEventos += eventos;

    const current = agrupacionDiariaMap.get(r.fecha) ?? { sacos: 0, disparos: 0, eventos: 0 };
    current.sacos += sacos;
    current.disparos += isDisparo;
    current.eventos += eventos;
    agrupacionDiariaMap.set(r.fecha, current);
  });

  const serieDiaria: ExtraccionGerencialData['diaria'] = Array.from(agrupacionDiariaMap.entries())
    .map(([fecha, vals]) => ({
      fecha,
      sacos: vals.sacos,
      disparos: vals.disparos,
      eventos: vals.eventos,
    }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  const processedData: ExtraccionGerencialData = {
     kpis: {
        totalSacos,
        totalDisparos,
        totalEventos
     },
     diaria: serieDiaria,
     registros: hasParams ? [...reportesValidos].reverse() : reportesValidos,
  };

  return <ExtraccionGerencialClient data={processedData} selectedDateStr={fechaHasta} />;
}
