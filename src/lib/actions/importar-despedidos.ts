'use server';

import { createServerClient } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';

export type ImportarDespedidosRow = {
  cedula: string;
  diasTrabajados: number;
  cobraSemanaLibre: boolean;
  bonificaciones: number;
  despidoFecha: string;
  despidoCausa: string;
};

export type ImportarDespedidosResult = {
  ok: boolean;
  message: string;
  totalProcesados?: number;
  totalNoEncontrados?: number;
  cedulasNoEncontradas?: string[];
};

/**
 * Procesa un lote de despidos desde un Excel/CSV.
 * Por cada fila: busca al trabajador por cédula y lo marca como DESPEDIDO
 * con la fecha, causa y días trabajados especificados.
 * NO procesa la liquidación — eso se hace después desde el panel
 * "Despedidos" con los checkboxes y la distribución.
 */
export async function importarDespedidosLoteAction(
  rows: ImportarDespedidosRow[],
): Promise<ImportarDespedidosResult> {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, message: 'No autenticado' };
    if (rows.length === 0) return { ok: false, message: 'Sin filas para importar' };

    let procesados = 0;
    const cedulasNoEncontradas: string[] = [];

    for (const row of rows) {
      const cedula = String(row.cedula || '').trim();
      if (!cedula) continue;

      const { data: personal } = await supabase
        .from('personal')
        .select('id, estado_laboral')
        .eq('cedula', cedula)
        .maybeSingle();

      if (!personal) {
        cedulasNoEncontradas.push(cedula);
        continue;
      }

      // Solo actualiza si aún no está despedido (idempotente)
      if (personal.estado_laboral === 'DESPEDIDO') {
        procesados++;
        continue;
      }

      const { error } = await supabase
        .from('personal')
        .update({
          estado_laboral: 'DESPEDIDO',
          estatus: 'LIQUIDADO',
          activo: false,
          despido_fecha: row.despidoFecha || null,
          despido_causa: row.despidoCausa || 'Despido',
          observacion_estado: row.despidoCausa || 'Despido',
          estado_inicio_fecha: row.despidoFecha || null,
          estado_manual_override: true,
          ultimo_update_estado_at: new Date().toISOString(),
        })
        .eq('id', personal.id);

      if (error) {
        console.error(`Error al marcar como despedido a ${cedula}:`, error.message);
        continue;
      }
      procesados++;
    }

    const paths = ['/admin/trabajadores', '/admin/nomina', '/mina/nomina', '/planta/nomina', '/operaciones/resumen', '/dashboard'];
    for (const p of paths) {
      try { await revalidatePath(p); } catch {}
    }

    return {
      ok: true,
      message: `${procesados} trabajador(es) marcado(s) como despedido${cedulasNoEncontradas.length > 0 ? `. ${cedulasNoEncontradas.length} cédula(s) no encontrada(s)` : ''}.`,
      totalProcesados: procesados,
      totalNoEncontrados: cedulasNoEncontradas.length,
      cedulasNoEncontradas,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al importar lote';
    return { ok: false, message };
  }
}
