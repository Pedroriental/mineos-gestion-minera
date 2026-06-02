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
import { normalizeString, getBestCanonicalName } from '../reports/report-engine';

// ── 1. Fetch Dynamic Dropdown Options ──────────────────────

export async function fetchFilterOptions(): Promise<FilterOptions> {
  const supabase = await createServerClient();

  const getCanonicalList = (rawValues: (string | undefined | null)[]) => {
    const groups = new Map<string, Set<string>>();
    rawValues.forEach((val) => {
      if (val) {
        const key = normalizeString(val);
        if (!groups.has(key)) groups.set(key, new Set());
        groups.get(key)!.add(val);
      }
    });
    return Array.from(groups.values())
      .map((set) => getBestCanonicalName(Array.from(set)))
      .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  };

  // 1. Producción
  const { data: prodData } = await supabase
    .from('reportes_produccion')
    .select('molino, material')
    .limit(500);
  const molinosRaw: string[] = [];
  const materialesRaw: string[] = [];
  prodData?.forEach((r) => {
    if (r.molino) molinosRaw.push(r.molino);
    if (r.material) materialesRaw.push(r.material);
  });

  // 2. Personal & Cargos
  const { data: personalData } = await supabase
    .from('personal')
    .select('id, nombre_completo, cedula, cargo')
    .order('nombre_completo', { ascending: true });
  const cargosRaw: string[] = [];
  personalData?.forEach((p) => {
    if (p.cargo) cargosRaw.push(p.cargo);
  });

  // 3. Voladuras
  const { data: volData } = await supabase
    .from('reportes_voladuras')
    .select('mina, vertical_disparo')
    .limit(500);
  const minasVolRaw: string[] = [];
  const verticalesVolRaw: string[] = [];
  volData?.forEach((v) => {
    if (v.mina) minasVolRaw.push(v.mina);
    if (v.vertical_disparo) verticalesVolRaw.push(v.vertical_disparo);
  });

  // 4. Extracción
  const { data: extData } = await supabase
    .from('reportes_extraccion')
    .select('mina, vertical')
    .limit(500);
  const minasExtRaw: string[] = [];
  const verticalesExtRaw: string[] = [];
  extData?.forEach((e) => {
    if (e.mina) minasExtRaw.push(e.mina);
    if (e.vertical) verticalesExtRaw.push(e.vertical);
  });

  // 5. Categorías Gasto
  const { data: catGastoData } = await supabase
    .from('categorias_gasto')
    .select('id, nombre, tipo')
    .eq('activo', true)
    .order('nombre', { ascending: true });

  return {
    produccion: {
      molinos: getCanonicalList(molinosRaw),
      materiales: getCanonicalList(materialesRaw),
    },
    nomina: {
      cargos: getCanonicalList(cargosRaw),
      personal: (personalData ?? []).map((p) => ({
        id: p.id,
        nombre_completo: p.nombre_completo,
        cedula: p.cedula,
      })),
    },
    voladuras: {
      minas: getCanonicalList(minasVolRaw),
      verticales: getCanonicalList(verticalesVolRaw),
    },
    extraccion: {
      minas: getCanonicalList(minasExtRaw),
      verticales: getCanonicalList(verticalesExtRaw),
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

  if (filters.turnos && filters.turnos.length > 0) {
    query = query.in('turno', filters.turnos);
  }

  const { data, error } = await query.order('fecha', { ascending: true });
  if (error) {
    console.error('Error fetching produccion report:', error);
    throw new Error('Error al cargar reporte de producción');
  }

  let result = (data as ReporteProduccion[]) ?? [];

  if (filters.molinos && filters.molinos.length > 0) {
    const targetSet = new Set(filters.molinos.map((m) => normalizeString(m)));
    result = result.filter((r) => r.molino && targetSet.has(normalizeString(r.molino)));
  }

  if (filters.materiales && filters.materiales.length > 0) {
    const targetSet = new Set(filters.materiales.map((m) => normalizeString(m)));
    result = result.filter((r) => r.material && targetSet.has(normalizeString(r.material)));
  }

  return result;
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

    // Filter by cargo (case and accent-insensitive)
    if (filters.cargos && filters.cargos.length > 0) {
      const targetSet = new Set(filters.cargos.map((c) => normalizeString(c)));
      if (!pers.cargo || !targetSet.has(normalizeString(pers.cargo))) return;
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

  if (filters.turnos && filters.turnos.length > 0) {
    query = query.in('turno', filters.turnos);
  }

  const { data, error } = await query.order('fecha', { ascending: true });
  if (error) {
    console.error('Error fetching voladuras report:', error);
    throw new Error('Error al cargar reporte de voladuras');
  }

  let result = (data as ReporteVoladura[]) ?? [];

  if (filters.minas && filters.minas.length > 0) {
    const targetSet = new Set(filters.minas.map((m) => normalizeString(m)));
    result = result.filter((v) => v.mina && targetSet.has(normalizeString(v.mina)));
  }

  if (filters.verticales && filters.verticales.length > 0) {
    const targetSet = new Set(filters.verticales.map((v) => normalizeString(v)));
    result = result.filter((v) => v.vertical_disparo && targetSet.has(normalizeString(v.vertical_disparo)));
  }

  return result;
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

  if (filters.turnos && filters.turnos.length > 0) {
    query = query.in('turno', filters.turnos);
  }

  const { data, error } = await query.order('fecha', { ascending: true });
  if (error) {
    console.error('Error fetching extraccion report:', error);
    throw new Error('Error al cargar reporte de extracción');
  }

  let result = (data as ReporteExtraccion[]) ?? [];

  if (filters.minas && filters.minas.length > 0) {
    const targetSet = new Set(filters.minas.map((m) => normalizeString(m)));
    result = result.filter((e) => e.mina && targetSet.has(normalizeString(e.mina)));
  }

  if (filters.verticales && filters.verticales.length > 0) {
    const targetSet = new Set(filters.verticales.map((v) => normalizeString(v)));
    result = result.filter((e) => e.vertical && targetSet.has(normalizeString(e.vertical)));
  }

  return result;
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
    const search = normalizeString(filters.proveedor);
    result = result.filter((g) => {
      return (
        normalizeString(g.proveedor).includes(search) ||
        normalizeString(g.descripcion).includes(search) ||
        normalizeString(g.factura_referencia).includes(search)
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
