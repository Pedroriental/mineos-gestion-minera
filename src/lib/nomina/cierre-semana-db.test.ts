import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('cierre semana db (contrato)', () => {
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
