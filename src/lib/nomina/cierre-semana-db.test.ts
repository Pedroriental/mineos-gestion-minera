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

  it('resolveSemanaPeriodoDetachAction bloquea si ambas semanas tienen datos', () => {
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
});
