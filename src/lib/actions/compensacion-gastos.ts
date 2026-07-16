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

    // 6. Mapear y filtrar gastos al formato del cálculo (excluyendo nóminas, mano de obra e instalación)
    const gastos: GastoParaCompensacion[] = gastosList
      .filter((g) => {
        const desc = (g.descripcion ?? '').toLowerCase();
        const esExcluido = 
          desc.includes('nómina') || 
          desc.includes('nomina') || 
          desc.includes('mano de obra') || 
          desc.includes('instalación') || 
          desc.includes('instalacion');
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
