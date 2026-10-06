/**
 * Datos históricos y facturas consolidadas de Julio 2026 ($97.600,33).
 * Utilizado como fuente de verdad para el cálculo de compensación de gastos
 * y como fallback ante problemas de replicación o RLS en Supabase.
 */

import { DEFAULT_EMPRESAS_INVERSORAS, type CompensacionEmpresa, type GastoParaCompensacion } from '@/lib/compensacion-gastos';
import type { GastoEmpresa, GastosEmpresaResumen, GastoCompartidoDetalle } from '@/lib/actions/compensacion-gastos';
import type { Gasto } from '@/lib/types';

export interface Julio2026ItemRaw {
  fecha: string;
  categoriaNombre: string;
  descripcion: string;
  monto: number;
  proveedor: string;
  pagos: Array<{ pagador: 'riasco' | 'fe'; monto_pagado: number; porcentaje: number }>;
}

export const RAW_JULIO_2026_ITEMS: Array<any> = [
      // --- Voladuras (Explosivos y Barre) ---
      {
        fecha: '2026-07-11',
        categoriaNombre: 'Voladuras (Exp y Barre)',
        descripcion: '50 metros de Cordón Detonante',
        monto: 1000.00,
        proveedor: 'Los Riasco',
        pagos: [{ pagador: 'riasco', monto_pagado: 1000.00, porcentaje: 100 }],
      },
      {
        fecha: '2026-07-17',
        categoriaNombre: 'Voladuras (Exp y Barre)',
        descripcion: '350 LP y 50 m de Trenzas',
        monto: 20250.00,
        proveedor: 'La Fe',
        pagos: [{ pagador: 'fe', monto_pagado: 20250.00, porcentaje: 100 }],
      },

      // --- Comida en Mina ---
      {
        fecha: '2026-07-02',
        categoriaNombre: 'Comida en Mina',
        descripcion: 'Viveres - Plaza Exito',
        monto: 401.28,
        proveedor: 'Comercializadora Plaza Exito, C.A.',
        pagos: [{ pagador: 'riasco', monto_pagado: 401.28, porcentaje: 100 }],
      },
      {
        fecha: '2026-07-02',
        categoriaNombre: 'Comida en Mina',
        descripcion: 'Hortalizas - PEH',
        monto: 62.22,
        proveedor: 'Inversiones PEH, C.A.',
        pagos: [{ pagador: 'riasco', monto_pagado: 62.22, porcentaje: 100 }],
      },
      {
        fecha: '2026-07-02',
        categoriaNombre: 'Comida en Mina',
        descripcion: 'Hortalizas - PEH',
        monto: 81.91,
        proveedor: 'Inversiones PEH, C.A.',
        pagos: [{ pagador: 'riasco', monto_pagado: 81.91, porcentaje: 100 }],
      },
      {
        fecha: '2026-07-02',
        categoriaNombre: 'Comida en Mina',
        descripcion: 'Viveres - Plaza Exito',
        monto: 2005.55,
        proveedor: 'Comercializadora Plaza Exito, C.A.',
        pagos: [{ pagador: 'riasco', monto_pagado: 2005.55, porcentaje: 100 }],
      },
      {
        fecha: '2026-07-09',
        categoriaNombre: 'Comida en Mina',
        descripcion: 'Hortalizas - PEH',
        monto: 145.64,
        proveedor: 'Inversiones PEH, C.A.',
        pagos: [{ pagador: 'riasco', monto_pagado: 145.64, porcentaje: 100 }],
      },
      {
        fecha: '2026-07-15',
        categoriaNombre: 'Comida en Mina',
        descripcion: 'Hidratación y Hielo',
        monto: 57.60,
        proveedor: 'Proveedor Comunitario',
        pagos: [{ pagador: 'riasco', monto_pagado: 57.60, porcentaje: 100 }],
      },
      {
        fecha: '2026-07-17',
        categoriaNombre: 'Comida en Mina',
        descripcion: 'Viveres - Plaza Exito',
        monto: 1735.15,
        proveedor: 'Comercializadora Plaza Exito, C.A.',
        pagos: [{ pagador: 'riasco', monto_pagado: 1735.15, porcentaje: 100 }],
      },
      {
        fecha: '2026-07-17',
        categoriaNombre: 'Comida en Mina',
        descripcion: 'Hortalizas - PEH',
        monto: 120.95,
        proveedor: 'Inversiones PEH, C.A.',
        pagos: [{ pagador: 'riasco', monto_pagado: 120.95, porcentaje: 100 }],
      },
      {
        fecha: '2026-07-24',
        categoriaNombre: 'Comida en Mina',
        descripcion: 'Carne de Res',
        monto: 93.33,
        proveedor: 'Proveedor Comunitario',
        pagos: [{ pagador: 'riasco', monto_pagado: 93.33, porcentaje: 100 }],
      },
      {
        fecha: '2026-07-24',
        categoriaNombre: 'Comida en Mina',
        descripcion: 'Hidratación e Hielo',
        monto: 90.00,
        proveedor: 'Proveedor Comunitario',
        pagos: [{ pagador: 'riasco', monto_pagado: 90.00, porcentaje: 100 }],
      },
      {
        fecha: '2026-07-25',
        categoriaNombre: 'Comida en Mina',
        descripcion: 'Hortalizas - PEH',
        monto: 129.67,
        proveedor: 'Inversiones PEH, C.A.',
        pagos: [
          { pagador: 'fe', monto_pagado: 125.00, porcentaje: 96 },
          { pagador: 'riasco', monto_pagado: 4.67, porcentaje: 4 },
        ],
      },
      {
        fecha: '2026-07-31',
        categoriaNombre: 'Comida en Mina',
        descripcion: 'Hidratación e Hielo',
        monto: 8.03,
        proveedor: 'Proveedor Comunitario',
        pagos: [{ pagador: 'riasco', monto_pagado: 8.03, porcentaje: 100 }],
      },

      // --- Nómina en Mina ---
      {
        fecha: '2026-07-05',
        categoriaNombre: 'Nómina en Mina',
        descripcion: 'Nómina Semanal Mina (Día 5)',
        monto: 5900.71,
        proveedor: 'Nómina Operativa',
        pagos: [
          { pagador: 'riasco', monto_pagado: 3540.43, porcentaje: 60 },
          { pagador: 'fe', monto_pagado: 2360.28, porcentaje: 40 },
        ],
      },
      {
        fecha: '2026-07-12',
        categoriaNombre: 'Nómina en Mina',
        descripcion: 'Nómina Semanal Mina (Día 12)',
        monto: 6660.00,
        proveedor: 'Nómina Operativa',
        pagos: [
          { pagador: 'riasco', monto_pagado: 3996.00, porcentaje: 60 },
          { pagador: 'fe', monto_pagado: 2664.00, porcentaje: 40 },
        ],
      },
      {
        fecha: '2026-07-19',
        categoriaNombre: 'Nómina en Mina',
        descripcion: 'Nómina Semanal Mina (Día 19)',
        monto: 7027.84,
        proveedor: 'Nómina Operativa',
        pagos: [
          { pagador: 'riasco', monto_pagado: 4216.70, porcentaje: 60 },
          { pagador: 'fe', monto_pagado: 2811.14, porcentaje: 40 },
        ],
      },
      {
        fecha: '2026-07-26',
        categoriaNombre: 'Nómina en Mina',
        descripcion: 'Nómina Semanal Mina (Día 26)',
        monto: 7128.57,
        proveedor: 'Nómina Operativa',
        pagos: [
          { pagador: 'riasco', monto_pagado: 4277.14, porcentaje: 60 },
          { pagador: 'fe', monto_pagado: 2851.43, porcentaje: 40 },
        ],
      },

      // --- Operaciones de Mina ---
      {
        fecha: '2026-07-02',
        categoriaNombre: 'Operaciones de Mina',
        descripcion: '1500 Litros de Diesel',
        monto: 1800.00,
        proveedor: 'La Fe',
        pagos: [{ pagador: 'fe', monto_pagado: 1800.00, porcentaje: 100 }],
      },
      {
        fecha: '2026-07-02',
        categoriaNombre: 'Operaciones de Mina',
        descripcion: '500 Litros de Gasolina',
        monto: 700.00,
        proveedor: 'La Fe',
        pagos: [{ pagador: 'fe', monto_pagado: 700.00, porcentaje: 100 }],
      },
      {
        fecha: '2026-07-05',
        categoriaNombre: 'Operaciones de Mina',
        descripcion: '2 Pares de Radios',
        monto: 120.00,
        proveedor: 'La Fe',
        pagos: [{ pagador: 'fe', monto_pagado: 120.00, porcentaje: 100 }],
      },
      {
        fecha: '2026-07-07',
        categoriaNombre: 'Operaciones de Mina',
        descripcion: '2 Brocas',
        monto: 100.00,
        proveedor: 'La Fe',
        pagos: [{ pagador: 'fe', monto_pagado: 100.00, porcentaje: 100 }],
      },
      {
        fecha: '2026-07-09',
        categoriaNombre: 'Operaciones de Mina',
        descripcion: '11 Brocas',
        monto: 660.00,
        proveedor: 'La Fe',
        pagos: [{ pagador: 'fe', monto_pagado: 660.00, porcentaje: 100 }],
      },
      {
        fecha: '2026-07-16',
        categoriaNombre: 'Operaciones de Mina',
        descripcion: '500 Litros de Gasolina',
        monto: 700.00,
        proveedor: 'La Fe',
        pagos: [{ pagador: 'fe', monto_pagado: 700.00, porcentaje: 100 }],
      },
      {
        fecha: '2026-07-17',
        categoriaNombre: 'Operaciones de Mina',
        descripcion: 'Contactor, Sacos',
        monto: 600.00,
        proveedor: 'La Fe',
        pagos: [{ pagador: 'fe', monto_pagado: 600.00, porcentaje: 100 }],
      },
      {
        fecha: '2026-07-21',
        categoriaNombre: 'Operaciones de Mina',
        descripcion: 'Materiales de Mina',
        monto: 3000.00,
        proveedor: 'La Fe',
        pagos: [{ pagador: 'fe', monto_pagado: 3000.00, porcentaje: 100 }],
      },
      {
        fecha: '2026-07-25',
        categoriaNombre: 'Operaciones de Mina',
        descripcion: 'Información y Planos',
        monto: 650.00,
        proveedor: 'La Fe',
        pagos: [{ pagador: 'fe', monto_pagado: 650.00, porcentaje: 100 }],
      },
      {
        fecha: '2026-07-30',
        categoriaNombre: 'Operaciones de Mina',
        descripcion: 'Tubos Elec 1", Sacos',
        monto: 700.00,
        proveedor: 'La Fe',
        pagos: [{ pagador: 'fe', monto_pagado: 700.00, porcentaje: 100 }],
      },
      {
        fecha: '2026-07-30',
        categoriaNombre: 'Operaciones de Mina',
        descripcion: 'Transformadores y Accesorios',
        monto: 4454.01,
        proveedor: 'La Fe',
        pagos: [{ pagador: 'fe', monto_pagado: 4454.01, porcentaje: 100 }],
      },
      {
        fecha: '2026-07-11',
        categoriaNombre: 'Operaciones de Mina',
        descripcion: 'Acometida V4 - Cuota La Fe',
        monto: 6546.00,
        proveedor: 'Oxifast / Ferremateriales',
        pagos: [{ pagador: 'fe', monto_pagado: 6546.00, porcentaje: 100 }],
      },
      {
        fecha: '2026-07-11',
        categoriaNombre: 'Operaciones de Mina',
        descripcion: 'Acometida V4 - Cuota Los Riascos',
        monto: 10559.00,
        proveedor: 'Oxifast / Ferremateriales',
        pagos: [{ pagador: 'riasco', monto_pagado: 10559.00, porcentaje: 100 }],
      },
      {
        fecha: '2026-07-15',
        categoriaNombre: 'Operaciones de Mina',
        descripcion: 'Equipos, Repuestos e Insumos Operaciones Mina',
        monto: 14112.86,
        proveedor: 'Los Riasco',
        pagos: [{ pagador: 'riasco', monto_pagado: 14112.86, porcentaje: 100 }],
      },
    ];

    

/**
 * Obtiene los gastos de Julio 2026 formateados para el cálculo de compensación.
 */
export function getJulio2026GastosParaCompensacion(empresas: CompensacionEmpresa[]): GastoParaCompensacion[] {
  const riasco = empresas.find(
    (e) =>
      (e.nombre_corto ?? '').toLowerCase().includes('riasco') ||
      e.nombre.toLowerCase().includes('riasco'),
  ) ?? empresas[0];

  const fe = empresas.find(
    (e) =>
      (e.nombre_corto ?? '').toLowerCase().includes('fe') ||
      e.nombre.toLowerCase().includes('fe'),
  ) ?? empresas[1];

  return RAW_JULIO_2026_ITEMS.map((item, idx) => ({
    id: `julio-2026-${idx + 1}`,
    fecha: item.fecha,
    monto: item.monto,
    categoria: item.categoriaNombre,
    descripcion: item.descripcion,
    pagos: item.pagos.map((p: any) => ({
      empresa_id: p.pagador === 'fe' ? fe.id : riasco.id,
      monto_pagado: p.monto_pagado,
    })),
  }));
}

/**
 * Obtiene los gastos de una empresa específica para su reporte individual en PDF.
 */
export function getJulio2026GastosParaEmpresa(
  empresaId: string,
  empresas: CompensacionEmpresa[],
): GastosEmpresaResumen {
  const targetEmpresa = empresas.find((e) => e.id === empresaId) ?? empresas[0];

  const todosGastos = getJulio2026GastosParaCompensacion(empresas);

  const gastosEmpresa: GastoEmpresa[] = [];
  const compartidosDetalle: GastoCompartidoDetalle[] = [];
  let totalGastado = 0;

  for (const g of todosGastos) {
    const miPago = g.pagos.find((p) => p.empresa_id === targetEmpresa.id)?.monto_pagado ?? 0;
    if (miPago > 0) {
      gastosEmpresa.push({
        id: g.id,
        fecha: g.fecha,
        descripcion: g.descripcion,
        categoria: g.categoria,
        montoTotal: g.monto,
        montoPagado: miPago,
      });
      totalGastado += miPago;
    }

    const cuota = Math.round(g.monto * (targetEmpresa.porcentaje / 100) * 100) / 100;
    const diferencia = Math.round((miPago - cuota) * 100) / 100;
    compartidosDetalle.push({
      fecha: g.fecha,
      descripcion: g.descripcion,
      montoTotal: g.monto,
      cuota,
      pagado: miPago,
      diferencia,
    });
  }

  const totalCompartido = Math.round(todosGastos.reduce((s, g) => s + g.monto, 0) * 100) / 100;
  const teorico = Math.round(totalCompartido * (targetEmpresa.porcentaje / 100) * 100) / 100;
  const saldo = Math.round((totalGastado - teorico) * 100) / 100;
  const estado = Math.abs(saldo) < 0.01 ? 'equilibrado' : saldo > 0 ? 'debe_cobrar' : 'debe_pagar';

  return {
    empresa: targetEmpresa,
    mes: '2026-07',
    desde: '2026-07-01',
    hasta: '2026-07-31',
    gastos: gastosEmpresa,
    totalGastado: Math.round(totalGastado * 100) / 100,
    gastosCompartidosDetalle: compartidosDetalle,
    compensacion: {
      totalCompartido,
      gastadoEmpresa: Math.round(totalGastado * 100) / 100,
      teorico,
      saldo,
      estado,
    },
  };
}

/**
 * Obtiene los gastos de Julio 2026 formateados para la tabla de Gastos Operativos (/admin/gastos).
 */
export function getJulio2026GastosParaTable(): Gasto[] {
  const fe = DEFAULT_EMPRESAS_INVERSORAS.find(e => e.nombre_corto.includes('fe')) ?? DEFAULT_EMPRESAS_INVERSORAS[0];
  const riasco = DEFAULT_EMPRESAS_INVERSORAS.find(e => e.nombre_corto.includes('riasco')) ?? DEFAULT_EMPRESAS_INVERSORAS[1];

  return RAW_JULIO_2026_ITEMS.map((item, idx) => ({
    id: `julio-2026-${idx + 1}`,
    fecha: item.fecha,
    categoria_id: `cat-${item.categoriaNombre.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
    descripcion: item.descripcion,
    monto: item.monto,
    proveedor: item.proveedor,
    registrado_por: 'Administración',
    created_at: `${item.fecha}T12:00:00Z`,
    updated_at: `${item.fecha}T12:00:00Z`,
    categorias_gasto: {
      id: `cat-${item.categoriaNombre.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      nombre: item.categoriaNombre,
      tipo: 'general',
      activo: true,
    },
    gastos_empresas: item.pagos.map((p: any) => ({
      empresa_id: p.pagador === 'fe' ? fe.id : riasco.id,
      monto_pagado: p.monto_pagado,
      porcentaje: p.porcentaje,
      empresas_inversoras: p.pagador === 'fe' ? fe : riasco,
    })),
  }));
}

