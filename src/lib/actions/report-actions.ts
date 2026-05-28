'use server';

import { createServerClient } from '@/lib/supabase-server';
import type {
  FilterOptions,
  ProduccionReportFilters,
  NominaReportFilters,
  VoladurasReportFilters,
  QuemadoReportFilters,
  ExtraccionReportFilters,
  GastosReportFilters,
  BalanceReportFilters,
} from '../reports/report-types';
import type {
  ReporteProduccion,
  ReporteVoladura,
  ReporteExtraccion,
  ReporteQuemado,
  Gasto,
  Personal,
  NominaSemana,
  NominaRegistro,
  NominaCierre,
} from '../types';

// ── 1. Fetch Dynamic Dropdown Options ──────────────────────

export async function fetchFilterOptions(): Promise<FilterOptions> {
  const supabase = await createServerClient();

  // 1. Producción
  const { data: prodData } = await supabase
    .from('reportes_produccion')
    .select('molino, material');
  const molinosSet = new Set<string>();
  const materialesSet = new Set<string>();
  prodData?.forEach((r) => {
    if (r.molino) molinosSet.add(r.molino);
    if (r.material) materialesSet.add(r.material);
  });

  // 2. Personal & Cargos
  const { data: personalData } = await supabase
    .from('personal')
    .select('id, nombre_completo, cedula, cargo')
    .order('nombre_completo', { ascending: true });
  const cargosSet = new Set<string>();
  personalData?.forEach((p) => {
    if (p.cargo) cargosSet.add(p.cargo);
  });

  // 3. Voladuras
  const { data: volData } = await supabase
    .from('reportes_voladuras')
    .select('mina, vertical_disparo');
  const minasVolSet = new Set<string>();
  const verticalesVolSet = new Set<string>();
  volData?.forEach((v) => {
    if (v.mina) minasVolSet.add(v.mina);
    if (v.vertical_disparo) verticalesVolSet.add(v.vertical_disparo);
  });

  // 4. Extracción
  const { data: extData } = await supabase
    .from('reportes_extraccion')
    .select('mina, vertical');
  const minasExtSet = new Set<string>();
  const verticalesExtSet = new Set<string>();
  extData?.forEach((e) => {
    if (e.mina) minasExtSet.add(e.mina);
    if (e.vertical) verticalesExtSet.add(e.vertical);
  });

  // 5. Categorías Gasto
  const { data: catGastoData } = await supabase
    .from('categorias_gasto')
    .select('id, nombre, tipo')
    .eq('activo', true)
    .order('nombre', { ascending: true });

  return {
    produccion: {
      molinos: Array.from(molinosSet).sort(),
      materiales: Array.from(materialesSet).sort(),
    },
    nomina: {
      cargos: Array.from(cargosSet).sort(),
      personal: (personalData ?? []).map((p) => ({
        id: p.id,
        nombre_completo: p.nombre_completo,
        cedula: p.cedula,
      })),
    },
    voladuras: {
      minas: Array.from(minasVolSet).sort(),
      verticales: Array.from(verticalesVolSet).sort(),
    },
    extraccion: {
      minas: Array.from(minasExtSet).sort(),
      verticales: Array.from(verticalesExtSet).sort(),
    },
    gastos: {
      categorias: (catGastoData ?? []).map((c) => ({
        id: c.id,
        nombre: c.nombre,
        tipo: c.tipo,
      })),
    },
  };
}

// ── 2. Módulo: Producción ───────────────────────────────────

export async function fetchProduccionReport(
  filters: ProduccionReportFilters
): Promise<ReporteProduccion[]> {
  const supabase = await createServerClient();
  let query = supabase
    .from('reportes_produccion')
    .select('*')
    .gte('fecha', filters.dateRange.from)
    .lte('fecha', filters.dateRange.to);

  if (filters.molinos && filters.molinos.length > 0) {
    query = query.in('molino', filters.molinos);
  }
  if (filters.materiales && filters.materiales.length > 0) {
    query = query.in('material', filters.materiales);
  }
  if (filters.turnos && filters.turnos.length > 0) {
    query = query.in('turno', filters.turnos);
  }

  const { data, error } = await query.order('fecha', { ascending: true });
  if (error) {
    console.error('Error fetching produccion report:', error);
    throw new Error('Error al cargar reporte de producción');
  }
  return (data as ReporteProduccion[]) ?? [];
}

// ── 3. Módulo: Nómina ──────────────────────────────────────

export interface NominaReportRow {
  semana_id: string;
  semana_inicio: string;
  semana_fin: string;
  area: string;
  trabajador_nombre: string;
  trabajador_cedula: string;
  trabajador_cargo: string;
  monto_pagado: number;
  es_semana_libre: boolean;
  bono_transporte_pagado: number;
  tiene_cierre: boolean;
  cierre_total_usd: number;
  cierre_pedro: number;
  cierre_darinel: number;
  cierre_la_fe: number;
}

export async function fetchNominaReport(
  filters: NominaReportFilters
): Promise<NominaReportRow[]> {
  const supabase = await createServerClient();

  // 1. Fetch weeks in range
  let weekQuery = supabase
    .from('nomina_semanas')
    .select('id, semana_inicio, semana_fin, area')
    .gte('semana_inicio', filters.dateRange.from)
    .lte('semana_inicio', filters.dateRange.to);

  if (filters.areas && filters.areas.length > 0) {
    weekQuery = weekQuery.in('area', filters.areas);
  }

  const { data: weeks, error: weekErr } = await weekQuery;
  if (weekErr || !weeks || weeks.length === 0) {
    return [];
  }

  const weekIds = weeks.map((w) => w.id);

  // 2. Fetch registrations for those weeks
  let regQuery = supabase
    .from('nomina_registros')
    .select('id, semana_id, personal_id, monto_pagado, es_semana_libre, bono_transporte_pagado, personal(nombre_completo, cedula, cargo, area)')
    .in('semana_id', weekIds);

  const { data: registrations, error: regErr } = await regQuery;
  if (regErr || !registrations) {
    console.error('Error fetching registrations:', regErr);
    throw new Error('Error al cargar registros de nómina');
  }

  // 3. Fetch closures (cierres) for those weeks
  const { data: closures } = await supabase
    .from('nomina_cierres')
    .select('*')
    .in('semana_id', weekIds);

  const closuresMap = new Map<string, NominaCierre>();
  closures?.forEach((c) => closuresMap.set(c.semana_id, c as NominaCierre));

  // 4. Assemble rows and apply filters on personal metadata
  const rows: NominaReportRow[] = [];
  
  registrations.forEach((r: any) => {
    const pers = r.personal;
    if (!pers) return;

    // Filter by cargo
    if (filters.cargos && filters.cargos.length > 0) {
      if (!filters.cargos.includes(pers.cargo)) return;
    }

    // Filter by worker ID
    if (filters.personalId && filters.personalId !== '') {
      if (r.personal_id !== filters.personalId) return;
    }

    const week = weeks.find((w) => w.id === r.semana_id);
    if (!week) return;

    const cierre = closuresMap.get(r.semana_id);

    rows.push({
      semana_id: r.semana_id,
      semana_inicio: week.semana_inicio,
      semana_fin: week.semana_fin,
      area: week.area,
      trabajador_nombre: pers.nombre_completo,
      trabajador_cedula: pers.cedula,
      trabajador_cargo: pers.cargo,
      monto_pagado: r.monto_pagado,
      es_semana_libre: r.es_semana_libre,
      bono_transporte_pagado: r.bono_transporte_pagado,
      tiene_cierre: !!cierre,
      cierre_total_usd: cierre ? cierre.total_nomina_usd : 0,
      cierre_pedro: cierre ? cierre.monto_pedro : 0,
      cierre_darinel: cierre ? cierre.monto_darinel : 0,
      cierre_la_fe: cierre ? cierre.monto_la_fe : 0,
    });
  });

  return rows.sort((a, b) => a.semana_inicio.localeCompare(b.semana_inicio));
}

// ── 4. Módulo: Voladuras ────────────────────────────────────

export async function fetchVoladurasReport(
  filters: VoladurasReportFilters
): Promise<ReporteVoladura[]> {
  const supabase = await createServerClient();
  let query = supabase
    .from('reportes_voladuras')
    .select('*')
    .gte('fecha', filters.dateRange.from)
    .lte('fecha', filters.dateRange.to);

  if (filters.minas && filters.minas.length > 0) {
    query = query.in('mina', filters.minas);
  }
  if (filters.verticales && filters.verticales.length > 0) {
    query = query.in('vertical_disparo', filters.verticales);
  }
  if (filters.turnos && filters.turnos.length > 0) {
    query = query.in('turno', filters.turnos);
  }

  const { data, error } = await query.order('fecha', { ascending: true });
  if (error) {
    console.error('Error fetching voladuras report:', error);
    throw new Error('Error al cargar reporte de voladuras');
  }
  return (data as ReporteVoladura[]) ?? [];
}

// ── 5. Módulo: Quemado ──────────────────────────────────────

export async function fetchQuemadoReport(
  filters: QuemadoReportFilters
): Promise<ReporteQuemado[]> {
  const supabase = await createServerClient();
  let query = supabase
    .from('reportes_quemado')
    .select('*')
    .gte('fecha', filters.dateRange.from)
    .lte('fecha', filters.dateRange.to);

  if (filters.turnos && filters.turnos.length > 0) {
    query = query.in('turno', filters.turnos);
  }

  const { data, error } = await query.order('fecha', { ascending: true });
  if (error) {
    console.error('Error fetching quemado report:', error);
    throw new Error('Error al cargar reporte de quemado');
  }
  return (data as ReporteQuemado[]) ?? [];
}

// ── 6. Módulo: Extracción ───────────────────────────────────

export async function fetchExtraccionReport(
  filters: ExtraccionReportFilters
): Promise<ReporteExtraccion[]> {
  const supabase = await createServerClient();
  let query = supabase
    .from('reportes_extraccion')
    .select('*')
    .gte('fecha', filters.dateRange.from)
    .lte('fecha', filters.dateRange.to);

  if (filters.minas && filters.minas.length > 0) {
    query = query.in('mina', filters.minas);
  }
  if (filters.verticales && filters.verticales.length > 0) {
    query = query.in('vertical', filters.verticales);
  }
  if (filters.turnos && filters.turnos.length > 0) {
    query = query.in('turno', filters.turnos);
  }

  const { data, error } = await query.order('fecha', { ascending: true });
  if (error) {
    console.error('Error fetching extraccion report:', error);
    throw new Error('Error al cargar reporte de extracción');
  }
  return (data as ReporteExtraccion[]) ?? [];
}

// ── 7. Módulo: Gastos ───────────────────────────────────────

export async function fetchGastosReport(
  filters: GastosReportFilters
): Promise<Gasto[]> {
  const supabase = await createServerClient();
  let query = supabase
    .from('gastos')
    .select('*, categorias_gasto(*)')
    .gte('fecha', filters.dateRange.from)
    .lte('fecha', filters.dateRange.to);

  if (filters.categorias && filters.categorias.length > 0) {
    query = query.in('categoria_id', filters.categorias);
  }

  const { data, error } = await query.order('fecha', { ascending: true });
  if (error) {
    console.error('Error fetching gastos report:', error);
    throw new Error('Error al cargar reporte de gastos');
  }

  // Filter client-side for type (categories_gasto.tipo) and search term (proveedor/factura)
  let result = (data as Gasto[]) ?? [];

  if (filters.tipos && filters.tipos.length > 0) {
    result = result.filter((g) => {
      const tipo = g.categorias_gasto?.tipo;
      return tipo && filters.tipos!.includes(tipo);
    });
  }

  if (filters.proveedor && filters.proveedor.trim() !== '') {
    const search = filters.proveedor.toLowerCase().trim();
    result = result.filter((g) => {
      return (
        g.proveedor?.toLowerCase().includes(search) ||
        g.descripcion?.toLowerCase().includes(search) ||
        g.factura_referencia?.toLowerCase().includes(search)
      );
    });
  }

  return result;
}

// ── 8. Módulo: Balance General ──────────────────────────────

export interface BalanceReportData {
  produccion: ReporteProduccion[];
  gastos: Gasto[];
  nomina: NominaReportRow[];
  ventasArenas: any[];
}

export async function fetchBalanceReport(
  filters: BalanceReportFilters
): Promise<BalanceReportData> {
  const supabase = await createServerClient();

  // Load all components for the Balance General
  // 1. Producción (oro recuperado)
  const { data: prodData } = await supabase
    .from('reportes_produccion')
    .select('*')
    .gte('fecha', filters.dateRange.from)
    .lte('fecha', filters.dateRange.to);

  // 2. Gastos
  const { data: gastosData } = await supabase
    .from('gastos')
    .select('*, categorias_gasto(*)')
    .gte('fecha', filters.dateRange.from)
    .lte('fecha', filters.dateRange.to);

  // 3. Nómina Semana-Cierre
  const nominaRows = await fetchNominaReport({
    dateRange: filters.dateRange,
  });

  // 4. Ventas de Arenas (Ingresos adicionales)
  const { data: ventasArenas } = await supabase
    .from('venta_arenas')
    .select('*')
    .gte('fecha', filters.dateRange.from)
    .lte('fecha', filters.dateRange.to);

  return {
    produccion: (prodData as ReporteProduccion[]) ?? [],
    gastos: (gastosData as Gasto[]) ?? [],
    nomina: nominaRows,
    ventasArenas: (ventasArenas as any[]) ?? [],
  };
}
