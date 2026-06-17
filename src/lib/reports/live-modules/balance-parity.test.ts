import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { aggregateBalanceFromContext } from '@/lib/reports/live-modules/balance-live';
import type { BalanceLiveContext } from '@/lib/reports/live-modules/balance-live';

function minimalContext(overrides?: Partial<BalanceLiveContext>): BalanceLiveContext {
  return {
    balance: {
      produccion: [
        { id: '1', fecha: '2026-05-01', molino: 'M1', oro_recuperado_g: 100 } as never,
      ],
      ventasArenas: [],
      nomina: [],
      gastos: [],
    },
    precioOro: {
      usdPorGramo: 80,
      modo: 'manual',
      fuenteEtiqueta: 'manual',
      origenUi: 'Biblioteca',
      fechaCache: null,
    },
    sacosExtraccion: 0,
    oroQuemadoG: 0,
    nominaSemanasUsd: 0,
    ...overrides,
  };
}

describe('balance-live paridad', () => {
  it('aggregateBalanceFromContext expone KPIs y filas', () => {
    const result = aggregateBalanceFromContext(minimalContext(), 'dia');
    assert.equal(result.aggregated.kpis.ingresoOroUsd, 8000);
    assert.equal(result.aggregated.rows.length, 1);
    assert.equal(result.precioOro.usdPorGramo, 80);
  });

  it('hub y constructor comparten totales con mismo contexto', () => {
    const ctx = minimalContext();
    const hub = aggregateBalanceFromContext(ctx, 'semana');
    const ctor = aggregateBalanceFromContext(ctx, 'semana');
    assert.equal(hub.aggregated.kpis.rentabilidadUsd, ctor.aggregated.kpis.rentabilidadUsd);
    assert.equal(hub.aggregated.kpis.ingresoTotalUsd, ctor.aggregated.kpis.ingresoTotalUsd);
  });

  it('desglosa insumos en filas cuando hay gastos clasificables', () => {
    const ctx = minimalContext({
      balance: {
        produccion: [],
        ventasArenas: [],
        nomina: [],
        gastos: [
          {
            id: 'g1',
            fecha: '2026-05-01',
            monto: 200,
            descripcion: 'Diesel planta',
            categorias_gasto: { id: 'c1', nombre: 'Combustible' },
          } as never,
          {
            id: 'g2',
            fecha: '2026-05-01',
            monto: 100,
            descripcion: 'Admin',
            categorias_gasto: { id: 'c2', nombre: 'Servicios' },
          } as never,
        ],
      },
    });
    const result = aggregateBalanceFromContext(ctx, 'dia');
    assert.equal(result.aggregated.rows[0]?.gastosInsumos, 200);
    assert.equal(result.aggregated.rows[0]?.gastosOperativos, 100);
  });
});
