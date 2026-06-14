import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildGrupoMixtoRosterProjection,
  isGrupoMixtoPersonal,
  type GrupoMixtoHistoryWeek,
} from '@/lib/nomina/grupo-mixto-roster';
import type { Personal } from '@/lib/types';

function makePersonal(id: string, areaDetalle = 'Molinos- Grupo (mixto)'): Personal {
  return {
    id,
    cedula: id,
    nombre_completo: id,
    cargo: areaDetalle,
    area: 'planta',
    area_detalle: areaDetalle,
    salario_base: 75,
    salario_libre: 75,
    bono_transporte: 30,
    estatus: 'ACTIVO',
    fecha_ingreso: '2026-01-01',
    activo: true,
    esquema_rotacion: areaDetalle === 'Molinos- Grupo (mixto)' ? 'MOLINO_14X14' : 'FIJO_SEMANAL',
    rotacion_inicio_fecha: '2026-05-04',
    created_at: '',
    updated_at: '',
  };
}

function historyWeek(semana_inicio: string, ids: string[]): GrupoMixtoHistoryWeek {
  return {
    id: semana_inicio,
    semana_inicio,
    registros: ids.map((id) => ({
      personal_id: id,
      monto_pagado: 75,
      estado_asistencia: 'trabajada',
      personal: makePersonal(id),
    })),
  };
}

describe('grupo-mixto-roster', () => {
  it('identifica trabajadores de Molinos Grupo (mixto)', () => {
    assert.equal(isGrupoMixtoPersonal(makePersonal('g1')), true);
    assert.equal(isGrupoMixtoPersonal(makePersonal('admin', 'Administración')), false);
  });

  it('prefiere la cohorte de la misma posición del ciclo de 4 semanas', () => {
    const activePersonal = [
      ...Array.from({ length: 20 }, (_, i) => makePersonal(`g${i + 1}`)),
      makePersonal('admin-1', 'Administración'),
    ];

    const expectedCohort = ['g2', 'g4', 'g6', 'g8', 'g10', 'g12', 'g14', 'g16', 'g18'];
    const recentDifferentCohort = ['g1', 'g3', 'g5', 'g7', 'g9', 'g11', 'g13', 'g15'];

    const projection = buildGrupoMixtoRosterProjection({
      activePersonal,
      targetWeekStart: '2026-06-01',
      historyWeeks: [
        historyWeek('2026-05-18', recentDifferentCohort),
        historyWeek('2026-05-11', ['g1', 'g4', 'g7', 'g10']),
        historyWeek('2026-05-04', expectedCohort),
      ],
    });

    assert.equal(projection.shouldApply, true);
    assert.equal(projection.confidence, 'alta');
    assert.equal(projection.sourceWeekStart, '2026-05-04');
    assert.deepEqual(projection.expectedIds, [...expectedCohort].sort());
    assert.equal(projection.suppressedIds.length, 11);
  });

  it('no filtra si no hay historial suficiente', () => {
    const projection = buildGrupoMixtoRosterProjection({
      activePersonal: Array.from({ length: 20 }, (_, i) => makePersonal(`g${i + 1}`)),
      targetWeekStart: '2026-06-01',
      historyWeeks: [],
    });

    assert.equal(projection.shouldApply, false);
    assert.equal(projection.confidence, 'baja');
  });
});
