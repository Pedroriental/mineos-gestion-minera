import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildHubTabConstructorPayload } from '@/lib/reports/hub-constructor-payload';
import type { ReportTabFilters } from '@/lib/reports/hub/report-tab-fetch';

const emptyTabFilters = (): ReportTabFilters => ({
  produccion: { molinos: [], materiales: [], turnos: [], groupBy: 'dia' },
  nomina: { areas: [], cargos: [], personalId: '', groupBy: 'semana', nominaDivisiones: [] },
  voladuras: { minas: [], verticales: [], turnos: [], groupBy: 'dia' },
  quemado: { turnos: [], groupBy: 'dia' },
  extraccion: { minas: [], verticales: [], turnos: [], groupBy: 'dia' },
  gastos: { categorias: [], tipos: [], proveedor: '', groupBy: 'dia' },
});

describe('hub-constructor-payload', () => {
  it('mapea producción con filtros y groupBy', () => {
    const tabFilters = {
      ...emptyTabFilters(),
      produccion: {
        groupBy: 'semana' as const,
        molinos: ['Molino A'],
        materiales: ['Oro'],
        turnos: ['dia'],
      },
    };

    const payload = buildHubTabConstructorPayload({
      dateRange: { from: '2026-05-01', to: '2026-05-31' },
      tab: 'produccion',
      tabFilters,
    });

    assert.equal(payload.modules?.[0], 'produccion');
    assert.equal(payload.groupBy, 'semana');
    assert.deepEqual(payload.filters?.produccion?.molino, { in: ['Molino A'] });
    assert.deepEqual(payload.filters?.produccion?.turno, { in: ['DÍA'] });
  });

  it('incluye filtros operativos molino/mina en reconciliacion key', () => {
    const payload = buildHubTabConstructorPayload({
      dateRange: { from: '2026-05-01', to: '2026-05-31' },
      tab: 'balance',
      tabFilters: emptyTabFilters(),
      selectedMolinos: ['M1'],
      selectedMinas: ['Norte'],
      balanceGroupBy: 'mes',
    });

    assert.deepEqual(payload.modules, ['balance']);
    assert.equal(payload.groupBy, 'mes');
    assert.deepEqual(payload.filters?.reconciliacion?.molinos, { in: ['M1'] });
    assert.deepEqual(payload.filters?.reconciliacion?.minas, { in: ['Norte'] });
  });
});
