import type { ParsedNominaPeriod, InferredWorkerProfile, PersonalSnapshot } from '@/lib/nomina/types';
import { buildPersonalSnapshot } from '@/lib/nomina/types';
import { getWeekEnd } from '@/lib/nomina/week-utils';
import type { Personal } from '@/lib/types';
import { parseNovedadTurno } from '@/lib/nomina-novedad-turno';

/**
 * Área por defecto cuando una sección parseada no tiene área definida.
 * Se mantiene 'mina' como fallback, pero el flujo normal usa el área real de la sección.
 */
export const IMPORT_HISTORICO_AREA_DEFAULT = 'mina';

export type ImportCommitPersonalRow = {
  cedula: string;
  nombre_completo: string;
  cargo: string;
  area: string;
  area_detalle: string | null;
  salario_base: number;
  salario_libre: number;
  esquema_rotacion: string;
  rotacion_inicio_fecha: string | null;
  fecha_ingreso: string;
  bono_transporte?: number;
};

export type ImportCommitRegistro = {
  cedula: string;
  monto_pagado: number;
  es_semana_libre: boolean;
  estado_asistencia: string;
  dias_trabajados: number;
  salario_base_calculado: number;
  bonificaciones: number;
  total_vales: number;
  personal_snapshot: PersonalSnapshot;
  novedad_turno?: string;
  novedad_turno_obs?: string;
};

export type ImportCommitSemana = {
  semana_inicio: string;
  semana_fin: string;
  area: string;
  total_trabajadores: number;
  total_pagado: number;
  registros: ImportCommitRegistro[];
};

export type ImportCommitPayload = {
  label: string;
  range_start: string;
  range_end: string;
  total_usd: number;
  origen: string;
  user_id?: string;
  metadata: Record<string, unknown>;
  semanas: ImportCommitSemana[];
  personal: ImportCommitPersonalRow[];
};

export function buildImportCommitPayload(
  period: ParsedNominaPeriod,
  profiles: InferredWorkerProfile[],
  options?: {
    label?: string;
    userId?: string;
    existingPersonal?: Map<string, Personal>;
    applyInference?: boolean;
  },
): ImportCommitPayload {
  const profileByCedula = new Map(profiles.map((p) => [p.cedula, p]));
  const personalMap = new Map<string, ImportCommitPersonalRow>();

  for (const section of period.sections) {
    // Usar el área real de la sección (mina, planta, administracion).
    // Si la sección no tiene área, caemos al default 'mina'.
    const sectionArea = (section.area as Personal['area']) || IMPORT_HISTORICO_AREA_DEFAULT;

    for (const row of section.rows) {
      if (!row._valid) continue;
      const inf = profileByCedula.get(row.cedula);
      const existing = options?.existingPersonal?.get(row.cedula);

      const applyInf = options?.applyInference !== false && inf;
      const skipRotationUpdate = existing?.rotacion_inicio_fecha && inf && inf.confidence < 0.85;

      // Si el trabajador ya fue visto en otra sección, preservar el primer mapeo
      // (los trabajadores no deben aparecer duplicados en el payload de personal).
      if (personalMap.has(row.cedula)) continue;

      personalMap.set(row.cedula, {
        cedula: row.cedula,
        nombre_completo: row.nombre_completo,
        cargo: row.cargo,
        area: sectionArea,
        area_detalle: section.areaDetalle ?? section.title ?? section.cargo,
        salario_base: applyInf ? inf!.salario_base : existing ? Number(existing.salario_base) : inf?.salario_base ?? 0,
        salario_libre: applyInf ? inf!.salario_libre : existing ? Number(existing.salario_libre) : inf?.salario_libre ?? 0,
        esquema_rotacion: applyInf && !skipRotationUpdate
          ? inf!.esquema_rotacion
          : existing?.esquema_rotacion ?? inf?.esquema_rotacion ?? 'FIJO_SEMANAL',
        rotacion_inicio_fecha: applyInf && !skipRotationUpdate
          ? inf!.rotacion_inicio_fecha
          : existing?.rotacion_inicio_fecha ?? inf?.rotacion_inicio_fecha ?? null,
        fecha_ingreso: row.fecha_ingreso,
        bono_transporte: existing ? Number(existing.bono_transporte) : 0,
      });
    }
  }

  const semanaMap = new Map<string, ImportCommitSemana>();

  // Mapa cedula -> área real para usarlo al construir semanas
  const areaBySection = new Map<string, Personal['area']>();
  for (const section of period.sections) {
    for (const row of section.rows) {
      if (row._valid && !areaBySection.has(row.cedula)) {
        areaBySection.set(row.cedula, (section.area as Personal['area']) || IMPORT_HISTORICO_AREA_DEFAULT);
      }
    }
  }

  for (const flat of period.flatCells) {
    const section = period.sections.find((s) => s.id === flat.sectionId);
    if (!section) continue;
    const personal = personalMap.get(flat.worker.cedula);
    if (!personal) continue;

    // Usar el área de la sección, no un valor hardcodeado
    const area = (section.area as Personal['area']) || IMPORT_HISTORICO_AREA_DEFAULT;
    const key = `${flat.weekStart}|${area}`;
    if (!semanaMap.has(key)) {
      semanaMap.set(key, {
        semana_inicio: flat.weekStart,
        semana_fin: getWeekEnd(flat.weekStart),
        area,
        total_trabajadores: 0,
        total_pagado: 0,
        registros: [],
      });
    }

    const inf = profileByCedula.get(flat.worker.cedula);
    const estado =
      flat.cell.estado ??
      inf?.weekEstados[flat.weekStart] ??
      (flat.cell.amount <= 0 ? 'no_laborado' : 'trabajada');

    const snapshot: PersonalSnapshot = {
      cedula: personal.cedula,
      nombre_completo: personal.nombre_completo,
      cargo: personal.cargo,
      area: personal.area,
        area_detalle: personal.area_detalle,
        section_id: section.id,
        section_title: section.title,
        salario_base: personal.salario_base,
      salario_libre: personal.salario_libre,
      bono_transporte: personal.bono_transporte ?? 0,
      esquema_rotacion: personal.esquema_rotacion,
      rotacion_inicio_fecha: personal.rotacion_inicio_fecha,
    };

    let novedad_turno = 'ACTIVO';
    let novedad_turno_obs = '';

    if (flat.worker.observaciones) {
      const parsed = parseNovedadTurno(flat.worker.observaciones);
      novedad_turno = parsed;
      novedad_turno_obs = flat.worker.observaciones.trim();
    }

    const cellWarnings = flat.cell._warnings || [];
    const noteText = cellWarnings.find((w) => /trabajador|accidente|se paga|enviado/i.test(w));
    if (noteText) {
      novedad_turno = /accidente|reposo|médico|medico/i.test(noteText) ? 'REPOSO' : 'OTRO';
      novedad_turno_obs = noteText.replace(/\s+/g, ' ').trim();
    }

    // Si el trabajador ya existía en la base con un estado especial (despedido, reposo, vacaciones),
    // agregamos su estado y causa en la observación del registro de nómina.
    // Omitimos completamente si es una vacación automática por rotación.
    const existing = options?.existingPersonal?.get(flat.worker.cedula);
    if (existing) {
      const est = existing.estado_laboral;
      const causa = existing.despido_causa || existing.observacion_estado || '';
      const isAutoRotation = est === 'VACACIONES' && causa.includes('[auto-rotación]');

      if ((est === 'DESPEDIDO' || est === 'REPOSO' || est === 'VACACIONES') && !isAutoRotation) {
        const causaStr = causa ? ` (Causa: ${causa})` : '';
        const statusNote = `[Estado anterior en sistema: ${est}${causaStr}]`;
        if (novedad_turno_obs) {
          novedad_turno_obs = `${statusNote} · ${novedad_turno_obs}`;
        } else {
          novedad_turno_obs = statusNote;
          novedad_turno = est; // Reflejar su estado si no tiene otra novedad de nota
        }
      }
    }

    semanaMap.get(key)!.registros.push({
      cedula: flat.worker.cedula,
      monto_pagado: flat.cell.amount,
      es_semana_libre: estado === 'libre',
      estado_asistencia: estado,
      dias_trabajados: estado === 'no_laborado' ? 0 : 7,
      salario_base_calculado: flat.cell.amount,
      bonificaciones: 0,
      total_vales: 0,
      personal_snapshot: snapshot,
      novedad_turno,
      novedad_turno_obs,
    });
  }

  const semanas = [...semanaMap.values()].map((s) => {
    const total_pagado = parseFloat(
      s.registros.reduce((n, r) => n + r.monto_pagado, 0).toFixed(2),
    );
    const ids = new Set(s.registros.map((r) => r.cedula));
    return {
      ...s,
      total_pagado,
      total_trabajadores: ids.size,
    };
  });

  const sectionTotals = period.sections.map((s) => ({
    id: s.id,
    title: s.title,
    area: s.area,
    total: s.sectionTotal,
  }));

  return {
    label: options?.label ?? `Nómina ${period.rangeStart} — ${period.rangeEnd}`,
    range_start: period.rangeStart,
    range_end: period.rangeEnd,
    total_usd: period.grandTotal,
    origen: 'import_historico',
    user_id: options?.userId,
    metadata: {
      source: period.source,
      sourceFileName: period.sourceFileName,
      sectionTotals,
      stats: period.stats,
    },
    semanas,
    personal: [...personalMap.values()],
  };
}

export function snapshotFromPersonal(p: Personal): PersonalSnapshot {
  return buildPersonalSnapshot(p);
}
