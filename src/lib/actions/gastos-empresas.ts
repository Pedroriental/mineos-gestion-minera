'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase-server';
import '@/lib/validations/empresas-inversoras';

export type ActionResult<T = void> =
  | { ok: true; data?: T; message: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

export async function asignarGastoAEmpresaAction(
  gastoId: string,
  empresaId: string,
  montoPagado: number,
): Promise<ActionResult> {
  try {
    const supabase = await createServerClient();

    const { data: empresa } = await supabase
      .from('empresas_inversoras')
      .select('porcentaje_participacion')
      .eq('id', empresaId)
      .single();

    if (!empresa) {
      return { ok: false, message: 'Empresa no encontrada' };
    }

    const { error } = await supabase.from('gastos_empresas').upsert(
      {
        gasto_id: gastoId,
        empresa_id: empresaId,
        monto_pagado: montoPagado,
        porcentaje: Number(empresa.porcentaje_participacion),
        es_pago_directo: true,
      },
      { onConflict: 'gasto_id,empresa_id' },
    );

    if (error) {
      console.error('[gastos-empresas] asignar error:', error.message);
      return { ok: false, message: error.message };
    }

    revalidatePath('/admin/gastos');
    revalidatePath('/admin/gastos/resumen');
    return { ok: true, message: 'Empresa asignada al gasto correctamente' };
  } catch (err) {
    console.error('[gastos-empresas] asignar exception:', err);
    return { ok: false, message: 'Error al asignar empresa al gasto' };
  }
}

export async function quitarGastoDeEmpresaAction(
  gastoId: string,
  empresaId: string,
): Promise<ActionResult> {
  try {
    const supabase = await createServerClient();
    const { error } = await supabase
      .from('gastos_empresas')
      .delete()
      .eq('gasto_id', gastoId)
      .eq('empresa_id', empresaId);

    if (error) {
      console.error('[gastos-empresas] quitar error:', error.message);
      return { ok: false, message: error.message };
    }

    revalidatePath('/admin/gastos');
    revalidatePath('/admin/gastos/resumen');
    return { ok: true, message: 'Empresa removida del gasto' };
  } catch (err) {
    console.error('[gastos-empresas] quitar exception:', err);
    return { ok: false, message: 'Error al remover empresa del gasto' };
  }
}

export async function getGastosEmpresasAction(
  gastoIds: string[],
): Promise<ActionResult<Record<string, Array<{ empresa_id: string; monto_pagado: number }>>>> {
  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from('gastos_empresas')
      .select('gasto_id, empresa_id, monto_pagado')
      .in('gasto_id', gastoIds);

    if (error) {
      console.error('[gastos-empresas] get error:', error.message);
      return { ok: false, message: error.message };
    }

    const grouped: Record<string, Array<{ empresa_id: string; monto_pagado: number }>> = {};
    for (const row of data ?? []) {
      if (!grouped[row.gasto_id]) grouped[row.gasto_id] = [];
      grouped[row.gasto_id].push({
        empresa_id: row.empresa_id,
        monto_pagado: Number(row.monto_pagado),
      });
    }

    return { ok: true, data: grouped, message: 'OK' };
  } catch (err) {
    console.error('[gastos-empresas] get exception:', err);
    return { ok: false, message: 'Error al obtener empresas de gastos' };
  }
}
