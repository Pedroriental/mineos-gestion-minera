'use server';

import { createServerClient } from '@/lib/supabase-server';
import {
  resolverCompensacionGastos,
  type CompensacionResumen,
  type CompensacionEmpresa,
  type GastoParaCompensacion,
} from '@/lib/compensacion-gastos';
import { monthBounds } from '@/lib/nomina/nomina-read-model';

export type CompensacionResponse =
  | { ok: true; data: CompensacionResumen }
  | { ok: false; message: string };

export async function generarCompensacionGastosAction(
  mes: string,
  dia?: string | null,
): Promise<CompensacionResponse> {
  try {
    if (!/^\d{4}-\d{2}$/.test(mes)) {
      return { ok: false, message: 'Formato de mes inválido (YYYY-MM)' };
    }

    const supabase = await createServerClient();

    // 1. Calcular rango de fechas
    const { desde, hasta } =
      dia && /^\d{4}-\d{2}-\d{2}$/.test(dia)
        ? { desde: dia, hasta: dia }
        : monthBounds(mes);

    // 2. Obtener empresas inversoras activas
    const { data: empresasData, error: empresasError } = await supabase
      .from('empresas_inversoras')
      .select('id, nombre, nombre_corto, porcentaje_participacion, color')
      .eq('activo', true)
      .order('nombre', { ascending: true });

    if (empresasError) {
      return { ok: false, message: empresasError.message };
    }

    if (!empresasData || empresasData.length === 0) {
      return {
        ok: false,
        message: 'No hay empresas inversoras activas. Configúralas primero.',
      };
    }

    const empresas: CompensacionEmpresa[] = empresasData.map((e) => ({
      id: e.id,
      nombre: e.nombre,
      nombre_corto: e.nombre_corto,
      porcentaje: Number(e.porcentaje_participacion),
      color: e.color ?? '#DAA520',
    }));

    // 3. Obtener gastos del rango con su categoría
    const { data: gastosData, error: gastosError } = await supabase
      .from('gastos')
      .select(
        'id, fecha, monto, descripcion, categoria_id, categorias_gasto(nombre)',
      )
      .gte('fecha', desde)
      .lte('fecha', hasta);

    if (gastosError) {
      return { ok: false, message: gastosError.message };
    }

    const gastosList = gastosData ?? [];

    if (gastosList.length === 0) {
      return {
        ok: false,
        message: 'No hay gastos registrados en este período.',
      };
    }

    // 4. Obtener relaciones gasto-empresa para todos los gastos
    const gastoIds = gastosList.map((g) => g.id);
    const { data: gastosEmpresasData, error: gastosEmpresasError } = await supabase
      .from('gastos_empresas')
      .select('gasto_id, empresa_id, monto_pagado')
      .in('gasto_id', gastoIds);

    if (gastosEmpresasError) {
      return { ok: false, message: gastosEmpresasError.message };
    }

    // 5. Indexar gastos_empresas por gasto_id
    const empresasPorGasto: Record<
      string,
      Array<{ empresa_id: string; monto_pagado: number }>
    > = {};
    for (const row of gastosEmpresasData ?? []) {
      if (!empresasPorGasto[row.gasto_id]) {
        empresasPorGasto[row.gasto_id] = [];
      }
      empresasPorGasto[row.gasto_id].push({
        empresa_id: row.empresa_id,
        monto_pagado: Number(row.monto_pagado),
      });
    }

    // 6. Mapear y filtrar gastos al formato del cálculo.
    // Reglas de exclusión:
    //   - "Gastos Molino": La Fé y Los Riasco no comparten gastos de molino, no genera compensación.
    //   - Nóminas: se dividen al 60/40 sin compensación.
    const gastos: GastoParaCompensacion[] = gastosList
      .filter((g) => {
        // Excluir categoría Gastos Molino completa
        const cat = Array.isArray(g.categorias_gasto)
          ? g.categorias_gasto[0]
          : g.categorias_gasto;
        const categoriaNombre = (cat?.nombre ?? '').toLowerCase();
        if (categoriaNombre.includes('molino')) return false;

        // Excluir únicamente gastos de nómina semanal
        const desc = (g.descripcion ?? '').toLowerCase();
        const esExcluido =
          desc.includes('nómina') ||
          desc.includes('nomina');
        return !esExcluido;
      })
      .map((g) => {
        const cat = Array.isArray(g.categorias_gasto)
          ? g.categorias_gasto[0]
          : g.categorias_gasto;
        return {
          id: g.id,
          fecha: g.fecha,
          monto: Number(g.monto),
          categoria: cat?.nombre ?? 'Sin categoría',
          descripcion: g.descripcion,
          pagos: empresasPorGasto[g.id] ?? [],
        };
      });

    // 7. Calcular compensación
    const resumen = resolverCompensacionGastos({
      gastos,
      empresas,
      mes,
      desde,
      hasta,
      dia: dia ?? null,
    });

    return { ok: true, data: resumen };
  } catch (err) {
    console.error('[compensacion-gastos] generar exception:', err);
    return { ok: false, message: 'Error al generar la compensación de gastos' };
  }
}

// ─── Tipos para el reporte individual por empresa ────────────────────────────

export type GastoEmpresa = {
  id: string;
  fecha: string;
  descripcion: string | null;
  categoria: string;
  montoTotal: number;
  montoPagado: number;
};

export type GastosEmpresaResumen = {
  empresa: CompensacionEmpresa;
  mes: string;
  desde: string;
  hasta: string;
  gastos: GastoEmpresa[];
  totalGastado: number;
  compensacion: {
    totalCompartido: number;
    gastadoEmpresa: number;
    teorico: number;
    saldo: number;
    estado: 'debe_cobrar' | 'debe_pagar' | 'equilibrado';
  };
};

export type GastosEmpresaResponse =
  | { ok: true; data: GastosEmpresaResumen }
  | { ok: false; message: string };

/**
 * Trae todos los gastos del mes para una empresa específica (sin excluir nada).
 * Usado para el PDF individual de informe por empresa.
 */
export async function generarGastosEmpresaAction(
  mes: string,
  empresaId: string,
  dia?: string | null,
): Promise<GastosEmpresaResponse> {
  try {
    if (!/^\d{4}-\d{2}$/.test(mes)) {
      return { ok: false, message: 'Formato de mes inválido (YYYY-MM)' };
    }

    const supabase = await createServerClient();

    const { desde, hasta } =
      dia && /^\d{4}-\d{2}-\d{2}$/.test(dia)
        ? { desde: dia, hasta: dia }
        : monthBounds(mes);

    // 1. Datos de la empresa
    const { data: empresaData, error: empresaError } = await supabase
      .from('empresas_inversoras')
      .select('id, nombre, nombre_corto, porcentaje_participacion, color')
      .eq('id', empresaId)
      .eq('activo', true)
      .single();

    if (empresaError || !empresaData) {
      return { ok: false, message: 'Empresa no encontrada' };
    }

    const empresa: CompensacionEmpresa = {
      id: empresaData.id,
      nombre: empresaData.nombre,
      nombre_corto: empresaData.nombre_corto,
      porcentaje: Number(empresaData.porcentaje_participacion),
      color: empresaData.color ?? '#DAA520',
    };

    // 2. Todos los gastos del rango
    const { data: gastosData, error: gastosError } = await supabase
      .from('gastos')
      .select('id, fecha, monto, descripcion, categorias_gasto(nombre)')
      .gte('fecha', desde)
      .lte('fecha', hasta);

    if (gastosError) return { ok: false, message: gastosError.message };
    const gastosRaw = gastosData ?? [];

    if (gastosRaw.length === 0) {
      return { ok: false, message: 'No hay gastos en este período.' };
    }

    // 3. Pagos de esta empresa
    const gastoIds = gastosRaw.map((g) => g.id);
    const { data: pagosData, error: pagosError } = await supabase
      .from('gastos_empresas')
      .select('gasto_id, monto_pagado')
      .in('gasto_id', gastoIds)
      .eq('empresa_id', empresaId);

    if (pagosError) return { ok: false, message: pagosError.message };

    const pagoPorGasto: Record<string, number> = {};
    for (const p of pagosData ?? []) {
      pagoPorGasto[p.gasto_id] = Number(p.monto_pagado);
    }

    // 4. Todos los gastos donde la empresa pagó algo
    const gastos: GastoEmpresa[] = gastosRaw
      .filter((g) => (pagoPorGasto[g.id] ?? 0) > 0)
      .map((g) => {
        const catRaw = Array.isArray(g.categorias_gasto)
          ? g.categorias_gasto[0]
          : g.categorias_gasto;
        return {
          id: g.id,
          fecha: g.fecha,
          descripcion: g.descripcion,
          categoria: catRaw?.nombre ?? 'Sin categoría',
          montoTotal: Number(g.monto),
          montoPagado: pagoPorGasto[g.id],
        };
      })
      .sort((a, b) => a.fecha.localeCompare(b.fecha));

    const totalGastado = gastos.reduce((s, g) => s + g.montoPagado, 0);

    // 5. Compensación: solo gastos compartidos de mina (excluye molino y nóminas)
    let totalCompartido = 0;
    let gastadoEmpresaComp = 0;

    for (const g of gastosRaw) {
      const catRaw = Array.isArray(g.categorias_gasto)
        ? g.categorias_gasto[0]
        : g.categorias_gasto;
      const catNombre = (catRaw?.nombre ?? '').toLowerCase();
      const desc = (g.descripcion ?? '').toLowerCase();
      if (desc.includes('nómina') || desc.includes('nomina') || catNombre.includes('molino')) continue;

      totalCompartido += Number(g.monto);
      gastadoEmpresaComp += pagoPorGasto[g.id] ?? 0;
    }

    const teorico = Math.round(totalCompartido * (empresa.porcentaje / 100) * 100) / 100;
    const saldo = Math.round((gastadoEmpresaComp - teorico) * 100) / 100;
    let estado: 'debe_cobrar' | 'debe_pagar' | 'equilibrado';
    if (Math.abs(saldo) < 0.01) estado = 'equilibrado';
    else if (saldo > 0) estado = 'debe_cobrar';
    else estado = 'debe_pagar';

    return {
      ok: true,
      data: {
        empresa,
        mes,
        desde,
        hasta,
        gastos,
        totalGastado,
        compensacion: {
          totalCompartido: Math.round(totalCompartido * 100) / 100,
          gastadoEmpresa: Math.round(gastadoEmpresaComp * 100) / 100,
          teorico,
          saldo,
          estado,
        },
      },
    };
  } catch (err) {
    console.error('[compensacion-gastos] empresa exception:', err);
    return { ok: false, message: 'Error al generar el informe de empresa' };
  }
}
