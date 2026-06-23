'use server';

import { createServerClient } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';
import type {
  ImportarDespedidosRow,
  ImportarDespedidosResult,
  ImportarDespedidosDetalle,
} from '@/lib/types/importar-despedidos';

const ESQUEMA_ROTACION_POR_AREA: Record<string, string> = {
  mina: 'MINA_2X1',
  planta: 'MOLINO_FIJO',
  administracion: 'FIJO_SEMANAL',
  seguridad: 'FIJO_SEMANAL',
  transporte: 'FIJO_SEMANAL',
};

function normalizeCedula(raw: string): string {
  return String(raw || '').replace(/[.\-\s]/g, '').trim();
}

function normalizeName(raw: string): string {
  return String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

type ExistingPersonal = {
  id: string;
  nombre_completo: string;
  estado_laboral: string;
  cedula: string;
  area?: string;
};

type AreaLiteral = 'mina' | 'planta' | 'administracion' | 'seguridad' | 'transporte';

/**
 * Procesa un lote de despidos desde un Excel/CSV.
 * Por cada fila intenta:
 *   1) match por cédula normalizada
 *   2) match por nombre normalizado (si la cédula no aparece o no coincide)
 *   3) si no match: crear el trabajador en la BD con los datos del Excel
 *   4) marcar como DESPEDIDO + persistir liquidación
 *
 * La liquidación económica se procesa después desde el panel "Despedidos"
 * con los checkboxes y la distribución.
 */
export async function importarDespedidosLoteAction(
  rows: ImportarDespedidosRow[],
  area: AreaLiteral = 'mina',
): Promise<ImportarDespedidosResult> {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, message: 'No autenticado' };
    if (rows.length === 0) return { ok: false, message: 'Sin filas para importar' };

    const { data: { user: authUser }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !authUser) {
      return { ok: false, message: 'No se pudo obtener el usuario actual' };
    }

    // Obtener complex_id del usuario para heredarlo en registros nuevos
    let complexId: string | null = null;
    const { data: profileRow } = await supabase
      .from('profiles')
      .select('complex_id')
      .eq('id', authUser.id)
      .maybeSingle();
    if (profileRow?.complex_id) {
      complexId = profileRow.complex_id as string;
    } else {
      const { data: userRow } = await supabase
        .from('users')
        .select('complex_id')
        .eq('id', authUser.id)
        .maybeSingle();
      complexId = (userRow?.complex_id as string) ?? null;
    }

    // Cargar el catálogo completo de personal una sola vez (no asumimos índice)
    // Filtramos por área para reducir el set cuando el área es mina/planta.
    const { data: allPersonal, error: listErr } = await supabase
      .from('personal')
      .select('id, nombre_completo, estado_laboral, cedula, area');
    if (listErr) {
      return { ok: false, message: `Error al leer personal: ${listErr.message}` };
    }
    const personalList: ExistingPersonal[] = allPersonal ?? [];

    // Índices para match rápido
    const byCedula = new Map<string, ExistingPersonal>();
    const byName = new Map<string, ExistingPersonal>();
    for (const p of personalList) {
      const c = normalizeCedula(p.cedula);
      if (c) byCedula.set(c, p);
      const n = normalizeName(p.nombre_completo);
      if (n) byName.set(n, p);
    }

    const detalle: ImportarDespedidosDetalle[] = [];
    let creados = 0;
    let actualizados = 0;
    let errores = 0;

    for (const row of rows) {
      const cedulaNorm = normalizeCedula(row.cedula);
      const nombreNorm = normalizeName(row.nombre);
      const label = `${row.nombre || '(sin nombre)'} (${row.cedula || 's/c'})`;

      if (!cedulaNorm) {
        detalle.push({
          cedula: row.cedula,
          nombre: row.nombre,
          estado: 'skipped',
          message: 'Sin cédula',
        });
        continue;
      }
      if (!nombreNorm) {
        detalle.push({
          cedula: row.cedula,
          nombre: row.nombre,
          estado: 'skipped',
          message: 'Sin nombre',
        });
        continue;
      }
      if (!Number.isFinite(row.salarioSemana) || row.salarioSemana <= 0) {
        detalle.push({
          cedula: row.cedula,
          nombre: row.nombre,
          estado: 'skipped',
          message: 'Salario semanal inválido',
        });
        continue;
      }

      // 1) match por cédula
      let existing = byCedula.get(cedulaNorm) ?? null;
      let matchedBy: 'cedula' | 'nombre' | undefined;
      if (existing) {
        matchedBy = 'cedula';
      } else {
        // 2) match por nombre normalizado
        existing = byName.get(nombreNorm) ?? null;
        if (existing) matchedBy = 'nombre';
      }

      try {
        let personalId: string;
        if (!existing) {
          // 3) crear
          const cargo = row.cargo?.trim() || 'Palero';
          const esquemaRotacion = ESQUEMA_ROTACION_POR_AREA[area] ?? 'FIJO_SEMANAL';
          const fechaIngreso = row.despidoFecha || new Date().toISOString().slice(0, 10);

          const { data: inserted, error: insertErr } = await supabase
            .from('personal')
            .insert({
              cedula: cedulaNorm,
              nombre_completo: row.nombre.trim(),
              cargo,
              area,
              area_detalle: 'General',
              salario_base: row.salarioSemana,
              salario_libre: row.salarioSemana,
              bono_transporte: 0,
              fecha_ingreso: fechaIngreso,
              ajuste_antiguedad_dias: 0,
              esquema_rotacion: esquemaRotacion,
              estado_laboral: 'DESPEDIDO',
              estatus: 'LIQUIDADO',
              activo: false,
              despido_fecha: row.despidoFecha || null,
              despido_causa: row.despidoCausa || 'Despido',
              observacion_estado: row.despidoCausa || 'Despido',
              estado_inicio_fecha: row.despidoFecha || null,
              complex_id: complexId,
              liquidacion_dias_trabajados: row.diasTrabajados || null,
              liquidacion_bonificaciones: row.bonificaciones || 0,
              liquidacion_cobra_semana_libre: !!row.cobraSemanaLibre,
              estado_manual_override: true,
              ultimo_update_estado_at: new Date().toISOString(),
            })
            .select('id')
            .single();

          if (insertErr || !inserted) {
            throw new Error(insertErr?.message ?? 'No se pudo crear el trabajador');
          }
          personalId = inserted.id as string;

          // actualizar índices para siguientes iteraciones
          const newRecord: ExistingPersonal = {
            id: personalId,
            nombre_completo: row.nombre.trim(),
            estado_laboral: 'DESPEDIDO',
            cedula: cedulaNorm,
            area,
          };
          byCedula.set(cedulaNorm, newRecord);
          byName.set(nombreNorm, newRecord);

          detalle.push({
            cedula: row.cedula,
            nombre: row.nombre,
            estado: 'created',
          });
          creados++;
        } else {
          // 4) actualizar existente
          personalId = existing.id;
          const isAlreadyFired = existing.estado_laboral === 'DESPEDIDO';

          const updatePayload: Record<string, unknown> = {
            liquidacion_dias_trabajados: row.diasTrabajados || null,
            liquidacion_bonificaciones: row.bonificaciones || 0,
            liquidacion_cobra_semana_libre: !!row.cobraSemanaLibre,
            liquidacion_persiste: true,
            estado_manual_override: true,
            ultimo_update_estado_at: new Date().toISOString(),
          };

          if (!isAlreadyFired) {
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

          const { error: updateErr } = await supabase
            .from('personal')
            .update(updatePayload)
            .eq('id', personalId);

          if (updateErr) throw new Error(updateErr.message);

          detalle.push({
            cedula: row.cedula,
            nombre: row.nombre,
            estado: 'updated',
            matchedBy,
          });
          actualizados++;
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error desconocido';
        detalle.push({
          cedula: row.cedula,
          nombre: row.nombre,
          estado: 'error',
          message,
        });
        errores++;
        console.error(`[importarDespedidosLoteAction] ${label}:`, message);
      }
    }

    const omitidos = detalle.filter((d) => d.estado === 'skipped').length;
    const totalProcesados = creados + actualizados;

    const paths = [
      '/admin/trabajadores',
      '/admin/nomina',
      '/mina/nomina',
      '/planta/nomina',
      '/operaciones/resumen',
      '/dashboard',
    ];
    for (const p of paths) {
      try { await revalidatePath(p); } catch {}
    }

    let message = `${totalProcesados} trabajador(es) procesado(s)`;
    if (creados > 0) message += `, ${creados} nuevo(s)`;
    if (actualizados > 0) message += `, ${actualizados} actualizado(s)`;
    if (omitidos > 0) message += `, ${omitidos} omitido(s)`;
    if (errores > 0) message += `, ${errores} con error`;

    return {
      ok: true,
      message,
      totalProcesados,
      totalNoEncontrados: omitidos,
      totalCreados: creados,
      totalActualizados: actualizados,
      totalErrores: errores,
      detalle,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al importar lote';
    return { ok: false, message };
  }
}
