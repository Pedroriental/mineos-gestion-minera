/**
 * Lógica de cálculo de compensación de gastos multi-empresa.
 *
 * Modelo:
 * - Cada gasto tiene una o más empresas pagadoras (gastos_empresas)
 * - Cada empresa tiene un % de participación (empresas_inversoras.porcentaje_participacion)
 * - Gasto Real: cuánto pagó realmente cada empresa
 * - Gasto Teórico: cuánto debería pagar cada empresa según su %
 * - Compensación: Gasto Real - Gasto Teórico
 *   - Positivo: la empresa pagó de más → le deben cobrar
 *   - Negativo: la empresa pagó de menos → debe pagar
 */

export type CompensacionEmpresa = {
  id: string;
  nombre: string;
  nombre_corto: string;
  porcentaje: number;
  color: string;
};

export type CompensacionCategoria = {
  nombre: string;
  total: number;
  gastoRealPorEmpresa: Record<string, number>;
  gastoTeoricoPorEmpresa: Record<string, number>;
  compensacionPorEmpresa: Record<string, number>;
};

export type CompensacionResumen = {
  period: {
    mes: string;
    desde: string;
    hasta: string;
    dia: string | null;
  };
  empresas: CompensacionEmpresa[];
  categorias: CompensacionCategoria[];
  totalGasto: number;
  totalRealPorEmpresa: Record<string, number>;
  totalTeoricoPorEmpresa: Record<string, number>;
  totalCompensacionPorEmpresa: Record<string, number>;
  resumenPorEmpresa: Record<
    string,
    { saldo: number; estado: 'debe_cobrar' | 'debe_pagar' | 'equilibrado' }
  >;
  gastos: GastoParaCompensacion[];
};

export type GastoParaCompensacion = {
  id: string;
  fecha: string;
  monto: number;
  categoria: string;
  pagos: Array<{ empresa_id: string; monto_pagado: number }>;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function resolverCompensacionGastos(input: {
  gastos: GastoParaCompensacion[];
  empresas: CompensacionEmpresa[];
  mes: string;
  desde: string;
  hasta: string;
  dia?: string | null;
}): CompensacionResumen {
  const {
    gastos,
    empresas,
    mes,
    desde,
    hasta,
    dia = null,
  } = input;

  // 1. Agrupar gastos por categoría
  const categoriasMap = new Map<string, CompensacionCategoria>();

  for (const g of gastos) {
    if (!categoriasMap.has(g.categoria)) {
      categoriasMap.set(g.categoria, {
        nombre: g.categoria,
        total: 0,
        gastoRealPorEmpresa: {},
        gastoTeoricoPorEmpresa: {},
        compensacionPorEmpresa: {},
      });
    }
    const cat = categoriasMap.get(g.categoria)!;
    cat.total = round2(cat.total + g.monto);
    for (const pago of g.pagos) {
      cat.gastoRealPorEmpresa[pago.empresa_id] = round2(
        (cat.gastoRealPorEmpresa[pago.empresa_id] ?? 0) + pago.monto_pagado,
      );
    }
  }

  // 2. Calcular Gasto Teórico y Compensación por categoría
  // El Gasto Teórico se redondea para mostrarlo correctamente en la UI.
  // La Compensación NO se redondea aquí para que la suma de los redondeos
  // finales coincida con el redondeo de la suma total.
  for (const cat of categoriasMap.values()) {
    for (const empresa of empresas) {
      const real = cat.gastoRealPorEmpresa[empresa.id] ?? 0;
      const teorico = round2(cat.total * (empresa.porcentaje / 100));
      cat.gastoTeoricoPorEmpresa[empresa.id] = teorico;
      cat.compensacionPorEmpresa[empresa.id] = real - teorico;
    }
  }

  // 3. Ordenar categorías alfabéticamente
  const categorias = Array.from(categoriasMap.values()).sort((a, b) =>
    a.nombre.localeCompare(b.nombre),
  );

  // 4. Calcular totales por empresa
  const totalGasto = round2(categorias.reduce((s, c) => s + c.total, 0));
  const totalRealPorEmpresa: Record<string, number> = {};
  const totalTeoricoPorEmpresa: Record<string, number> = {};
  const totalCompensacionPorEmpresa: Record<string, number> = {};

  for (const empresa of empresas) {
    totalRealPorEmpresa[empresa.id] = round2(
      categorias.reduce((s, c) => s + (c.gastoRealPorEmpresa[empresa.id] ?? 0), 0),
    );
    totalTeoricoPorEmpresa[empresa.id] = round2(
      categorias.reduce((s, c) => s + (c.gastoTeoricoPorEmpresa[empresa.id] ?? 0), 0),
    );
    totalCompensacionPorEmpresa[empresa.id] = round2(
      categorias.reduce((s, c) => s + (c.compensacionPorEmpresa[empresa.id] ?? 0), 0),
    );
  }

  // 5. Determinar estado de cada empresa
  const resumenPorEmpresa: Record<
    string,
    { saldo: number; estado: 'debe_cobrar' | 'debe_pagar' | 'equilibrado' }
  > = {};
  for (const empresa of empresas) {
    const saldo = totalCompensacionPorEmpresa[empresa.id] ?? 0;
    let estado: 'debe_cobrar' | 'debe_pagar' | 'equilibrado';
    if (Math.abs(saldo) < 0.01) {
      estado = 'equilibrado';
    } else if (saldo > 0) {
      estado = 'debe_cobrar';
    } else {
      estado = 'debe_pagar';
    }
    resumenPorEmpresa[empresa.id] = { saldo, estado };
  }

  return {
    period: { mes, desde, hasta, dia },
    empresas,
    categorias,
    totalGasto,
    totalRealPorEmpresa,
    totalTeoricoPorEmpresa,
    totalCompensacionPorEmpresa,
    resumenPorEmpresa,
    gastos,
  };
}

export function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(n);
}
