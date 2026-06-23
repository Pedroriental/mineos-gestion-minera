'use server';

import { createServerClient } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';
import type { ImportarDespedidosRow, ImportarDespedidosResult } from '@/lib/types/importar-despedidos';

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
      const cedulaRaw = String(row.cedula || '').trim();
      if (!cedulaRaw) {
        cedulasNoEncontradas.push(`(sin cédula) - ${row.despidoCausa || 'sin nombre'}`);
        continue;
      }

      // Normalizar cédula: quitar puntos, guiones y espacios para comparar
      const cedulaNormalized = cedulaRaw.replace(/[.\-\s]/g, '');

      // Buscar primero con la cédula exacta, luego con normalizada
      let personal = null;
      const { data: exactMatch } = await supabase
        .from('personal')
        .select('id, estado_laboral, cedula')
        .eq('cedula', cedulaRaw)
        .maybeSingle();

      if (exactMatch) {
        personal = exactMatch;
      } else {
        // Buscar normalizada usando función RPC-like via filter
        const { data: allCedulas } = await supabase
          .from('personal')
          .select('id, estado_laboral, cedula');
        if (allCedulas) {
          const match = allCedulas.find(
            (p) => String(p.cedula).replace(/[.\-\s]/g, '') === cedulaNormalized,
          );
          personal = match || null;
        }
      }

      if (!personal) {
        cedulasNoEncontradas.push(cedulaRaw);
        continue;
      }

      // Si ya está despedido, solo actualizamos los datos de liquidación
      // (días, bonificaciones, semana libre) sin tocar estado/estatus
      const isAlreadyFired = personal.estado_laboral === 'DESPEDIDO';

      const updatePayload: Record<string, unknown> = {
        liquidacion_dias_trabajados: row.diasTrabajados || null,
        liquidacion_bonificaciones: row.bonificaciones || 0,
        liquidacion_cobra_semana_libre: row.cobraSemanaLibre,
        estado_manual_override: true,
        ultimo_update_estado_at: new Date().toISOString(),
      };

      if (!isAlreadyFired) {
        // Primera vez que se marca como despedido
        Object.assign(updatePayload, {
          estado_laboral: 'DESPEDIDO',
          estatus: 'LIQUIDADO',
          activo: false,
          despido_fecha: row.despidoFecha || null,
          despido_causa: row.despidoCausa || 'Despido',
          observacion_estado: row.despidoCausa || 'Despido',
          estado_inicio_fecha: row.despidoFecha || null,
        });
      }

      const { error } = await supabase
        .from('personal')
        .update(updatePayload)
        .eq('id', personal.id);

      if (error) {
        console.error(`Error al actualizar a ${cedulaRaw}:`, error.message);
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
      message: `${procesados} trabajador(es) procesado(s)${cedulasNoEncontradas.length > 0 ? `. ${cedulasNoEncontradas.length} no encontrado(s) o sin cédula` : ''}. La página se recargará para mostrar los cambios.`,
      totalProcesados: procesados,
      totalNoEncontrados: cedulasNoEncontradas.length,
      cedulasNoEncontradas,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al importar lote';
    return { ok: false, message };
  }
}
