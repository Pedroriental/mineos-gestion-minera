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

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + cost,
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

function fuzzyNameDistance(a: string, b: string): number {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return Infinity;
  if (na === nb) return 0;
  // Permitir tolerancia de 1 caracter por cada 10 del nombre más largo (mín 2)
  const tolerance = Math.max(2, Math.floor(Math.min(na.length, nb.length) / 8));
  return levenshtein(na, nb) <= tolerance ? levenshtein(na, nb) : Infinity;
}

function findFuzzyNameMatch(
  name: string,
  candidates: ExistingPersonal[],
): { record: ExistingPersonal; distance: number } | null {
  const n = normalizeName(name);
  if (!n) return null;
  let best: { record: ExistingPersonal; distance: number } | null = null;
  for (const c of candidates) {
    const d = fuzzyNameDistance(n, c.nombre_completo);
    if (d === Infinity) continue;
    if (!best || d < best.distance) {
      best = { record: c, distance: d };
    }
  }
  return best;
}

const SN_CEDULA_PREFIX = 'SN-';

function nextSNCedula(existingCedulas: string[]): string {
  let max = 0;
  for (const c of existingCedulas) {
    if (typeof c !== 'string') continue;
    if (!c.toUpperCase().startsWith(SN_CEDULA_PREFIX)) continue;
    const num = parseInt(c.slice(SN_CEDULA_PREFIX.length), 10);
    if (Number.isFinite(num) && num > max) max = num;
  }
  return `${SN_CEDULA_PREFIX}${String(max + 1).padStart(4, '0')}`;
}

function deriveNameFromCargo(cargo: string, area: string): string {
  const cargoTrim = (cargo || '').trim();
  const areaLabel = area === 'mina'
    ? 'Mina'
    : area === 'planta'
      ? 'Planta'
      : area === 'administracion'
        ? 'Administración'
        : area === 'seguridad'
          ? 'Seguridad'
          : area === 'transporte'
            ? 'Transporte'
            : '';
  if (cargoTrim && areaLabel) return `${cargoTrim} ${areaLabel}`;
  if (cargoTrim) return cargoTrim;
  if (areaLabel) return `Trabajador ${areaLabel}`;
  return 'Trabajador';
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
      const cedulaOriginal = (row.cedula || '').trim();
      const cedulaNorm = normalizeCedula(row.cedula);
      const nombreOriginal = (row.nombre || '').trim();
      const nombreNorm = normalizeName(row.nombre);
      const cargoTrim = (row.cargo || '').trim();
      const label = `${nombreOriginal || '(sin nombre)'} (${cedulaOriginal || 's/c'})`;

      const tieneDatosPago = Number.isFinite(row.salarioSemana) && row.salarioSemana > 0
        || (Number.isFinite(row.diasTrabajados) && row.diasTrabajados > 0);

      if (!cedulaNorm && !nombreNorm && !cargoTrim && !tieneDatosPago) {
        detalle.push({
          cedula: row.cedula,
          nombre: row.nombre,
          estado: 'skipped',
          message: 'Fila vacía',
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

      // Auto-generar cédula/nombre si faltan y la fila tiene datos útiles
      let autoGeneratedCedula = false;
      let autoGeneratedNombre = false;
      let effectiveCedula = cedulaNorm;
      let effectiveNombre = nombreNorm;
      let autoMatchType: 'auto-generated' | 'auto-cedula' | 'auto-nombre' | undefined;

      if (!effectiveCedula) {
        const cedulasExistentes = Array.from(byCedula.keys());
        effectiveCedula = nextSNCedula(cedulasExistentes);
        autoGeneratedCedula = true;
      }
      if (!effectiveNombre) {
        effectiveNombre = normalizeName(deriveNameFromCargo(cargoTrim, area));
        autoGeneratedNombre = true;
      }
      if (autoGeneratedCedula && autoGeneratedNombre) autoMatchType = 'auto-generated';
      else if (autoGeneratedCedula) autoMatchType = 'auto-cedula';
      else if (autoGeneratedNombre) autoMatchType = 'auto-nombre';

      // 1) match por cédula
      let existing = byCedula.get(effectiveCedula) ?? null;
      let matchedBy: 'cedula' | 'nombre' | 'fuzzy-name' | 'auto-generated' | 'auto-cedula' | 'auto-nombre' | undefined;
      if (existing) {
        matchedBy = 'cedula';
      } else {
        // 2) match por nombre normalizado exacto
        existing = byName.get(effectiveNombre) ?? null;
        if (existing) {
          matchedBy = 'nombre';
        } else if (!autoGeneratedNombre) {
          // 3) match fuzzy por nombre solo si el nombre vino del Excel
          // (no tiene sentido comparar un nombre auto-generado como "Supervisor Mina"
          // contra otros trabajadores)
          const fuzzy = findFuzzyNameMatch(row.nombre, personalList);
          if (fuzzy) {
            existing = fuzzy.record;
            matchedBy = 'fuzzy-name';
          }
        }
      }
      if (!matchedBy && autoMatchType) {
        matchedBy = autoMatchType;
      }

      try {
        let personalId: string;
        if (!existing) {
          // 3) crear
          const cargo = cargoTrim || 'Palero';
          const esquemaRotacion = ESQUEMA_ROTACION_POR_AREA[area] ?? 'FIJO_SEMANAL';
          const fechaIngreso = row.despidoFecha || new Date().toISOString().slice(0, 10);
          const nombreParaInsert = autoGeneratedNombre
            ? deriveNameFromCargo(cargoTrim, area)
            : nombreOriginal;

          const { data: inserted, error: insertErr } = await supabase
            .from('personal')
            .insert({
              cedula: effectiveCedula,
              nombre_completo: nombreParaInsert,
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
            nombre_completo: nombreParaInsert,
            estado_laboral: 'DESPEDIDO',
            cedula: effectiveCedula,
            area,
          };
          byCedula.set(effectiveCedula, newRecord);
          byName.set(normalizeName(nombreParaInsert), newRecord);

          detalle.push({
            cedula: row.cedula,
            nombre: row.nombre,
            estado: 'created',
            matchedBy,
            incompleteData: autoGeneratedCedula || autoGeneratedNombre,
            message: autoGeneratedCedula && autoGeneratedNombre
              ? `Cédula ${effectiveCedula} y nombre "${nombreParaInsert}" generados automáticamente`
              : autoGeneratedCedula
                ? `Cédula ${effectiveCedula} generada automáticamente`
                : `Nombre "${nombreParaInsert}" derivado del cargo`,
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
