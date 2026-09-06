import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveSemanaPeriodoDetachAction } from '@/lib/nomina/cierre-semana-db';

describe('cierre semana db (contrato)', () => {
  it('resolveSemanaPeriodoDetachAction nullifica si no hay conflicto', () => {
    assert.deepEqual(
      resolveSemanaPeriodoDetachAction({
        semanaTotalPagado: 100,
        semanaRegistrosCount: 5,
        hasNullPeriodConflict: false,
        conflictTotalPagado: 0,
        conflictRegistrosCount: 0,
      }),
      { action: 'nullify' },
    );
  });

  it('resolveSemanaPeriodoDetachAction borra semana vacía con conflicto', () => {
    assert.deepEqual(
      resolveSemanaPeriodoDetachAction({
        semanaTotalPagado: 0,
        semanaRegistrosCount: 0,
        hasNullPeriodConflict: true,
        conflictTotalPagado: 500,
        conflictRegistrosCount: 10,
      }),
      { action: 'delete_semana' },
    );
  });

  it('resolveSemanaPeriodoDetachAction borra conflicto vacío y conserva semana con datos', () => {
    assert.deepEqual(
      resolveSemanaPeriodoDetachAction({
        semanaTotalPagado: 500,
        semanaRegistrosCount: 10,
        hasNullPeriodConflict: true,
        conflictTotalPagado: 0,
        conflictRegistrosCount: 0,
      }),
      { action: 'delete_conflict' },
    );
  });

  it('resolveSemanaPeriodoDetachAction descarta semana del periodo pendiente con conflicto', () => {
    assert.deepEqual(
      resolveSemanaPeriodoDetachAction({
        semanaTotalPagado: 100,
        semanaRegistrosCount: 2,
        hasNullPeriodConflict: true,
        conflictTotalPagado: 50,
        conflictRegistrosCount: 1,
        periodoTotalUsd: 0,
      }),
      { action: 'delete_semana' },
    );
  });

  it('resolveSemanaPeriodoDetachAction bloquea si ambas semanas tienen datos distintos', () => {
    const result = resolveSemanaPeriodoDetachAction({
      semanaTotalPagado: 100,
      semanaRegistrosCount: 2,
      hasNullPeriodConflict: true,
      conflictTotalPagado: 50,
      conflictRegistrosCount: 1,
      periodoTotalUsd: 500,
    });
    assert.equal(result.action, 'blocked');
  });

  it('resolveSemanaPeriodoDetachAction descarta semana duplicada idéntica sin bloquear', () => {
    assert.deepEqual(
      resolveSemanaPeriodoDetachAction({
        semanaTotalPagado: 1425,
        semanaRegistrosCount: 13,
        hasNullPeriodConflict: true,
        conflictTotalPagado: 1425,
        conflictRegistrosCount: 13,
        periodoTotalUsd: 3610.72,
      }),
      { action: 'delete_semana' },
    );
  });

  it('resolveSemanaPeriodoDetachAction permite force para descartar semana con conflicto', () => {
    assert.deepEqual(
      resolveSemanaPeriodoDetachAction({
        semanaTotalPagado: 100,
        semanaRegistrosCount: 2,
        hasNullPeriodConflict: true,
        conflictTotalPagado: 50,
        conflictRegistrosCount: 1,
        periodoTotalUsd: 500,
        force: true,
      }),
      { action: 'delete_semana' },
    );
  });

  it('documenta que el upsert usa búsqueda explícita por periodo_id', () => {
    // Tras fix_historico_import_v2 la unicidad es parcial:
    // - (semana_inicio, area) WHERE periodo_id IS NULL
    // - (semana_inicio, area, periodo_id) WHERE periodo_id IS NOT NULL
    // PostgREST onConflict('semana_inicio,area') falla sin constraint global.
    const operativoKey = { semana_inicio: '2026-05-11', area: 'mina', periodo_id: null };
    const manualKey = {
      semana_inicio: '2026-05-11',
      area: 'mina',
      periodo_id: 'periodo-uuid',
    };
    assert.notDeepEqual(operativoKey.periodo_id, manualKey.periodo_id);
  });

  it('documenta que INSERT manual debe incluir area (default BD es mina)', () => {
    const input = { area: 'planta', semanaInicio: '2026-05-11', periodoId: 'periodo-planta' };
    assert.equal(input.area, 'planta');
    assert.notEqual(input.area, 'mina', 'sin area en INSERT la fila quedaría mina por DEFAULT');
  });

  it('documenta el contrato de re-consolidación de un periodo manual', () => {
    // Tras editar una semana consolidada y re-consolidar:
    // 1. El periodo mantiene su `id` original (UPDATE, no INSERT).
    // 2. `total_usd` se recalcula re-leyendo `nomina_semanas.total_pagado`.
    // 3. `metadata.semana_ids` se reemplaza con la nueva lista de semanas.
    // 4. Los links de `nomina_periodo_semanas` se borran y re-crean (idempotente).
    // 5. `nomina_semanas.periodo_id` se re-asigna para todas las semanas del rango.
    // 6. Se emite una entrada de auditoría con accion='RECONSOLIDAR_PERIODO' y
    //    `detalle` que incluya el total anterior y el nuevo.
    const previousTotalUsd = 1000;
    const newTotalUsd = 1250;
    const auditDetalle = `Periodo Demo: $${previousTotalUsd.toFixed(2)} -> $${newTotalUsd.toFixed(2)}`;
    assert.match(auditDetalle, /1000\.00/);
    assert.match(auditDetalle, /1250\.00/);
    assert.notEqual(previousTotalUsd, newTotalUsd);
  });
});
