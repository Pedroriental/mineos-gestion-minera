import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isGastoInsumo, splitGastoMonto } from '@/lib/reconciliation/gastos-classify';
import type { Gasto } from '@/lib/types';

function gasto(partial: Partial<Gasto> & { monto: number }): Gasto {
  return {
    id: '1',
    fecha: '2026-05-01',
    monto: partial.monto,
    descripcion: partial.descripcion ?? '',
    categorias_gasto: partial.categorias_gasto ?? null,
    ...partial,
  } as Gasto;
}

describe('gastos-classify', () => {
  it('detecta insumos por categoria', () => {
    assert.equal(
      isGastoInsumo(gasto({ monto: 50, categorias_gasto: { id: '1', nombre: 'Explosivos' } })),
      true,
    );
  });

  it('splitGastoMonto asigna monto a un bucket', () => {
    assert.deepEqual(
      splitGastoMonto(gasto({ monto: 75, categorias_gasto: { id: '1', nombre: 'Insumos' } })),
      { insumos: 75, operativo: 0 },
    );
  });
});
