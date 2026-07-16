import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolverCompensacionGastos,
  formatCurrency,
  type CompensacionEmpresa,
  type GastoParaCompensacion,
} from '@/lib/compensacion-gastos';

const empresas: CompensacionEmpresa[] = [
  { id: 'la_fe', nombre: 'La Fé', nombre_corto: 'la_fe', porcentaje: 40, color: '#DAA520' },
  { id: 'los_riascos', nombre: 'Los Riasco', nombre_corto: 'los_riascos', porcentaje: 60, color: '#60A5FA' },
];

describe('resolverCompensacionGastos', () => {
  it('asigna gasto a una sola empresa', () => {
    const gastos: GastoParaCompensacion[] = [
      {
        id: '1',
        fecha: '2026-07-01',
        monto: 1000,
        categoria: 'Voladuras',
        pagos: [{ empresa_id: 'los_riascos', monto_pagado: 1000 }],
      },
    ];

    const resumen = resolverCompensacionGastos({
      gastos,
      empresas,
      mes: '2026-07',
      desde: '2026-07-01',
      hasta: '2026-07-31',
    });

    const cat = resumen.categorias[0];
    assert.equal(cat.total, 1000);
    assert.equal(cat.gastoRealPorEmpresa['los_riascos'], 1000);
    assert.equal(cat.gastoRealPorEmpresa['la_fe'] ?? 0, 0);
    assert.equal(cat.gastoTeoricoPorEmpresa['los_riascos'], 600);
    assert.equal(cat.gastoTeoricoPorEmpresa['la_fe'], 400);
    assert.equal(cat.compensacionPorEmpresa['los_riascos'], 400);
    assert.equal(cat.compensacionPorEmpresa['la_fe'] ?? 0, -400);
  });

  it('suma correctamente múltiples gastos de la misma categoría', () => {
    const gastos: GastoParaCompensacion[] = [
      {
        id: '1',
        fecha: '2026-07-01',
        monto: 500,
        categoria: 'Operaciones',
        pagos: [{ empresa_id: 'los_riascos', monto_pagado: 500 }],
      },
      {
        id: '2',
        fecha: '2026-07-15',
        monto: 700,
        categoria: 'Operaciones',
        pagos: [{ empresa_id: 'la_fe', monto_pagado: 700 }],
      },
    ];

    const resumen = resolverCompensacionGastos({
      gastos,
      empresas,
      mes: '2026-07',
      desde: '2026-07-01',
      hasta: '2026-07-31',
    });

    const cat = resumen.categorias[0];
    assert.equal(cat.nombre, 'Operaciones');
    assert.equal(cat.total, 1200);
    assert.equal(cat.gastoRealPorEmpresa['los_riascos'], 500);
    assert.equal(cat.gastoRealPorEmpresa['la_fe'], 700);
    assert.equal(cat.gastoTeoricoPorEmpresa['los_riascos'], 720);
    assert.equal(cat.gastoTeoricoPorEmpresa['la_fe'], 480);
    assert.equal(cat.compensacionPorEmpresa['los_riascos'], -220);
    assert.equal(cat.compensacionPorEmpresa['la_fe'], 220);
  });

  it('permite que un gasto sea pagado por múltiples empresas', () => {
    const gastos: GastoParaCompensacion[] = [
      {
        id: '1',
        fecha: '2026-07-01',
        monto: 1000,
        categoria: 'Voladuras',
        pagos: [
          { empresa_id: 'los_riascos', monto_pagado: 500 },
          { empresa_id: 'la_fe', monto_pagado: 500 },
        ],
      },
    ];

    const resumen = resolverCompensacionGastos({
      gastos,
      empresas,
      mes: '2026-07',
      desde: '2026-07-01',
      hasta: '2026-07-31',
    });

    const cat = resumen.categorias[0];
    assert.equal(cat.total, 1000);
    assert.equal(cat.gastoRealPorEmpresa['los_riascos'], 500);
    assert.equal(cat.gastoRealPorEmpresa['la_fe'], 500);
    // Real 500/500, Teórico 600/400, Comp -100/+100
    assert.equal(cat.compensacionPorEmpresa['los_riascos'] ?? 0, -100);
    assert.equal(cat.compensacionPorEmpresa['la_fe'] ?? 0, 100);
  });

  it('clasifica correctamente el estado de cada empresa', () => {
    const gastosLosRiascoPagaTodo: GastoParaCompensacion[] = [
      {
        id: '1',
        fecha: '2026-07-01',
        monto: 1000,
        categoria: 'Voladuras',
        pagos: [{ empresa_id: 'los_riascos', monto_pagado: 1000 }],
      },
    ];
    const resumen = resolverCompensacionGastos({
      gastos: gastosLosRiascoPagaTodo,
      empresas,
      mes: '2026-07',
      desde: '2026-07-01',
      hasta: '2026-07-31',
    });

    assert.equal(resumen.resumenPorEmpresa['los_riascos'].estado, 'debe_cobrar');
    assert.equal(resumen.resumenPorEmpresa['la_fe'].estado, 'debe_pagar');

    const gastosEquilibrados: GastoParaCompensacion[] = [
      {
        id: '1',
        fecha: '2026-07-01',
        monto: 1000,
        categoria: 'Voladuras',
        pagos: [
          { empresa_id: 'los_riascos', monto_pagado: 600 },
          { empresa_id: 'la_fe', monto_pagado: 400 },
        ],
      },
    ];
    const resumen2 = resolverCompensacionGastos({
      gastos: gastosEquilibrados,
      empresas,
      mes: '2026-07',
      desde: '2026-07-01',
      hasta: '2026-07-31',
    });

    assert.equal(resumen2.resumenPorEmpresa['los_riascos'].estado, 'equilibrado');
    assert.equal(resumen2.resumenPorEmpresa['la_fe'].estado, 'equilibrado');
  });

  it('maneja correctamente el caso del Excel del usuario', () => {
    // Reproduce el caso del Excel: 4 categorías con gastos reales
    const gastos: GastoParaCompensacion[] = [
      {
        id: '1',
        fecha: '2026-07-01',
        monto: 1000,
        categoria: 'Voladuras (Exp y Barre)',
        pagos: [{ empresa_id: 'los_riascos', monto_pagado: 1000 }],
      },
      {
        id: '2',
        fecha: '2026-07-15',
        monto: 15068.94,
        categoria: 'Operaciones de Mina',
        pagos: [
          { empresa_id: 'los_riascos', monto_pagado: 9504.95 },
          { empresa_id: 'la_fe', monto_pagado: 5564.0 },
        ],
      },
      {
        id: '3',
        fecha: '2026-07-20',
        monto: 2754.20,
        categoria: 'Comida en Mina',
        pagos: [
          { empresa_id: 'los_riascos', monto_pagado: 2629.20 },
          { empresa_id: 'la_fe', monto_pagado: 125.0 },
        ],
      },
      {
        id: '4',
        fecha: '2026-07-31',
        monto: 12560.71,
        categoria: 'Nómina en Mina',
        pagos: [
          { empresa_id: 'los_riascos', monto_pagado: 7536.43 },
          { empresa_id: 'la_fe', monto_pagado: 5024.28 },
        ],
      },
    ];

    const resumen = resolverCompensacionGastos({
      gastos,
      empresas,
      mes: '2026-07',
      desde: '2026-07-01',
      hasta: '2026-07-31',
    });

    assert.equal(resumen.totalGasto, 31383.85);
    assert.equal(resumen.totalRealPorEmpresa['los_riascos'], 20670.58);
    assert.equal(resumen.totalRealPorEmpresa['la_fe'], 10713.28);
    // El cálculo da 1840.27 para LR y -1840.26 para LF.
    // La diferencia de 0.01 es por precisión de redondeo de números flotantes.
    assert.equal(resumen.totalCompensacionPorEmpresa['los_riascos'], 1840.27);
    assert.equal(resumen.totalCompensacionPorEmpresa['la_fe'], -1840.26);
  });

  it('ordena categorías alfabéticamente', () => {
    const gastos: GastoParaCompensacion[] = [
      {
        id: '1',
        fecha: '2026-07-01',
        monto: 100,
        categoria: 'Voladuras',
        pagos: [{ empresa_id: 'los_riascos', monto_pagado: 100 }],
      },
      {
        id: '2',
        fecha: '2026-07-01',
        monto: 200,
        categoria: 'Comida',
        pagos: [{ empresa_id: 'los_riascos', monto_pagado: 200 }],
      },
      {
        id: '3',
        fecha: '2026-07-01',
        monto: 300,
        categoria: 'Operaciones',
        pagos: [{ empresa_id: 'los_riascos', monto_pagado: 300 }],
      },
    ];

    const resumen = resolverCompensacionGastos({
      gastos,
      empresas,
      mes: '2026-07',
      desde: '2026-07-01',
      hasta: '2026-07-31',
    });

    assert.deepEqual(
      resumen.categorias.map((c) => c.nombre),
      ['Comida', 'Operaciones', 'Voladuras'],
    );
  });

  it('redondea correctamente a 2 decimales', () => {
    const gastos: GastoParaCompensacion[] = [
      {
        id: '1',
        fecha: '2026-07-01',
        monto: 333.33,
        categoria: 'Test',
        pagos: [{ empresa_id: 'los_riascos', monto_pagado: 333.33 }],
      },
    ];

    const resumen = resolverCompensacionGastos({
      gastos,
      empresas,
      mes: '2026-07',
      desde: '2026-07-01',
      hasta: '2026-07-31',
    });

    const cat = resumen.categorias[0];
    assert.equal(cat.gastoTeoricoPorEmpresa['los_riascos'], 200);
    assert.equal(cat.gastoTeoricoPorEmpresa['la_fe'], 133.33);
  });
});

describe('formatCurrency', () => {
  it('formatea números con separadores de miles y 2 decimales', () => {
    assert.equal(formatCurrency(1000), '$1,000.00');
    assert.equal(formatCurrency(15068.94), '$15,068.94');
    assert.equal(formatCurrency(0), '$0.00');
    assert.equal(formatCurrency(-100), '-$100.00');
  });
});
