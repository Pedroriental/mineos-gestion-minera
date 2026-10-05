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

  it('maneja correctamente el caso del Excel del usuario (Mes Completo Julio 2026 - $97.600,33)', () => {
    const gastos: GastoParaCompensacion[] = [
      {
        id: '1',
        fecha: '2026-07-11',
        monto: 21250.00,
        categoria: 'Voladuras (Exp y Barre)',
        pagos: [
          { empresa_id: 'los_riascos', monto_pagado: 1000.00 },
          { empresa_id: 'la_fe', monto_pagado: 20250.00 },
        ],
      },
      {
        id: '2',
        fecha: '2026-07-15',
        monto: 44701.87,
        categoria: 'Operaciones de Mina',
        pagos: [
          { empresa_id: 'los_riascos', monto_pagado: 24671.86 },
          { empresa_id: 'la_fe', monto_pagado: 20030.01 },
        ],
      },
      {
        id: '3',
        fecha: '2026-07-20',
        monto: 4931.34,
        categoria: 'Comida en Mina',
        pagos: [
          { empresa_id: 'los_riascos', monto_pagado: 4806.34 },
          { empresa_id: 'la_fe', monto_pagado: 125.00 },
        ],
      },
      {
        id: '4',
        fecha: '2026-07-31',
        monto: 26717.12,
        categoria: 'Nómina en Mina',
        pagos: [
          { empresa_id: 'los_riascos', monto_pagado: 16030.27 },
          { empresa_id: 'la_fe', monto_pagado: 10686.85 },
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

    // Validar Totales Generales
    assert.equal(resumen.totalGasto, 97600.33);
    assert.equal(resumen.totalRealPorEmpresa['los_riascos'], 46508.47);
    assert.equal(resumen.totalRealPorEmpresa['la_fe'], 51091.86);
    assert.equal(resumen.totalTeoricoPorEmpresa['los_riascos'], 58560.20);
    assert.equal(resumen.totalTeoricoPorEmpresa['la_fe'], 39040.13);
    assert.equal(resumen.totalCompensacionPorEmpresa['los_riascos'], -12051.73);
    assert.equal(resumen.totalCompensacionPorEmpresa['la_fe'], 12051.73);

    // Validar Estados
    assert.equal(resumen.resumenPorEmpresa['los_riascos'].estado, 'debe_pagar');
    assert.equal(resumen.resumenPorEmpresa['la_fe'].estado, 'debe_cobrar');
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

  it('calcula compensación correctamente con getJulio2026GastosParaCompensacion', async () => {
    const { getJulio2026GastosParaCompensacion, getJulio2026GastosParaEmpresa } = await import(
      '@/lib/data/julio-2026-gastos'
    );
    const gastosJulio = getJulio2026GastosParaCompensacion(empresas);
    assert.ok(gastosJulio.length > 0);

    const resumen = resolverCompensacionGastos({
      gastos: gastosJulio,
      empresas,
      mes: '2026-07',
      desde: '2026-07-01',
      hasta: '2026-07-31',
    });

    assert.equal(resumen.totalGasto, 97600.32);
    assert.equal(resumen.resumenPorEmpresa['los_riascos'].estado, 'debe_pagar');
    assert.equal(resumen.resumenPorEmpresa['la_fe'].estado, 'debe_cobrar');

    const repFe = getJulio2026GastosParaEmpresa('la_fe', empresas);
    assert.equal(repFe.empresa.nombre, 'La Fé');
    assert.ok(repFe.totalGastado > 0);
  });

  it('calcula compensación de Mina Agosto 2026 con exactitud matemática ($82.477,75)', async () => {
    const { getAgosto2026GastosParaCompensacion, getAgosto2026GastosParaEmpresa } = await import(
      '@/lib/data/agosto-2026-gastos'
    );
    const gastosAgosto = getAgosto2026GastosParaCompensacion(empresas);
    assert.ok(gastosAgosto.length > 0);

    const resumen = resolverCompensacionGastos({
      gastos: gastosAgosto,
      empresas,
      mes: '2026-08',
      desde: '2026-08-01',
      hasta: '2026-08-31',
    });

    const feEmp = empresas.find((e) => e.nombre_corto.includes('fe'))!;
    const riascoEmp = empresas.find((e) => e.nombre_corto.includes('riasco'))!;

    assert.equal(resumen.totalGasto, 82477.75);
    assert.equal(resumen.totalRealPorEmpresa[riascoEmp.id], 52584.96);
    assert.equal(resumen.totalRealPorEmpresa[feEmp.id], 29892.79);
    assert.equal(resumen.totalTeoricoPorEmpresa[riascoEmp.id], 49486.65);
    assert.equal(resumen.totalTeoricoPorEmpresa[feEmp.id], 32991.10);
    assert.equal(resumen.totalCompensacionPorEmpresa[riascoEmp.id], 3098.31);
    assert.equal(resumen.totalCompensacionPorEmpresa[feEmp.id], -3098.31);

    assert.equal(resumen.resumenPorEmpresa['los_riascos'].estado, 'debe_cobrar');
    assert.equal(resumen.resumenPorEmpresa['la_fe'].estado, 'debe_pagar');

    const repFe = getAgosto2026GastosParaEmpresa(feEmp.id, empresas);
    assert.equal(repFe.empresa.nombre, 'La Fé');
    assert.equal(repFe.totalGastado, 29892.79);
    assert.equal(repFe.compensacion.saldo, -3098.31);

    const repRiasco = getAgosto2026GastosParaEmpresa(riascoEmp.id, empresas);
    assert.equal(repRiasco.empresa.nombre, 'Los Riasco');
    assert.equal(repRiasco.totalGastado, 52584.96);
    assert.equal(repRiasco.compensacion.saldo, 3098.31);
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
