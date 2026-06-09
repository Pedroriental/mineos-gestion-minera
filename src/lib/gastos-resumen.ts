export const GASTOS_RESUMEN_CATEGORIAS = {
  MINA: 'Gastos de Mina',
  MOLINO: 'Gastos Molino',
} as const;

export type GastosResumenPeriod = {
  mes: string;
  desde: string;
  hasta: string;
  dia: string | null;
  label: string;
};

export type GastosResumenGastoRow = {
  id: string;
  fecha: string;
  monto: number | string;
  categoria_id: string;
  categorias_gasto?: { nombre: string } | null;
};

export type GastosResumenNominaRow = {
  id: string;
  semana_inicio: string;
  semana_fin: string;
  area: string | null;
  total_pagado: number | string;
  total_trabajadores?: number | null;
};

export type GastosResumenCategoriaTotal = {
  nombre: string;
  total: number;
  count: number;
};

export type GastosResumenDiaRow = {
  fecha: string;
  mina: number;
  molino: number;
  total: number;
  count: number;
};

export type GastosResumenNominaSemana = {
  id: string;
  semana_inicio: string;
  semana_fin: string;
  area: string;
  total_pagado: number;
  total_trabajadores: number;
};

export type GastosResumenSummary = {
  period: GastosResumenPeriod;
  mina: GastosResumenCategoriaTotal;
  molino: GastosResumenCategoriaTotal;
  nomina: { total: number; semanas: number; trabajadores: number };
  combined: { total: number; count: number };
  daily: GastosResumenDiaRow[];
  nominaSemanas: GastosResumenNominaSemana[];
};

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function monthBounds(mes: string): { desde: string; hasta: string } {
  const [y, m] = mes.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return {
    desde: `${mes}-01`,
    hasta: `${mes}-${pad2(lastDay)}`,
  };
}

function formatMonthLabel(mes: string) {
  return new Date(`${mes}-02T12:00:00`).toLocaleDateString('es-ES', {
    month: 'long',
    year: 'numeric',
  });
}

function formatDayLabel(dia: string) {
  return new Date(`${dia}T12:00:00`).toLocaleDateString('es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function resolveGastosResumenPeriod(mes?: string, dia?: string): GastosResumenPeriod {
  const now = new Date();
  const defaultMes = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
  const month = mes && /^\d{4}-\d{2}$/.test(mes) ? mes : defaultMes;

  if (dia && /^\d{4}-\d{2}-\d{2}$/.test(dia) && dia.startsWith(month)) {
    return {
      mes: month,
      desde: dia,
      hasta: dia,
      dia,
      label: formatDayLabel(dia),
    };
  }

  const bounds = monthBounds(month);
  return {
    mes: month,
    ...bounds,
    dia: null,
    label: formatMonthLabel(month),
  };
}

export function gastoCategoriaNombre(gasto: GastosResumenGastoRow): string {
  return gasto.categorias_gasto?.nombre ?? '';
}

export function buildGastosResumenSummary(
  gastos: GastosResumenGastoRow[],
  nominaSemanas: GastosResumenNominaRow[],
  period: GastosResumenPeriod,
): GastosResumenSummary {
  const mina: GastosResumenCategoriaTotal = {
    nombre: GASTOS_RESUMEN_CATEGORIAS.MINA,
    total: 0,
    count: 0,
  };
  const molino: GastosResumenCategoriaTotal = {
    nombre: GASTOS_RESUMEN_CATEGORIAS.MOLINO,
    total: 0,
    count: 0,
  };
  const dailyMap = new Map<string, GastosResumenDiaRow>();

  for (const g of gastos) {
    const monto = Number(g.monto) || 0;
    const cat = gastoCategoriaNombre(g);
    if (cat === GASTOS_RESUMEN_CATEGORIAS.MINA) {
      mina.total += monto;
      mina.count += 1;
    } else if (cat === GASTOS_RESUMEN_CATEGORIAS.MOLINO) {
      molino.total += monto;
      molino.count += 1;
    }

    const day = dailyMap.get(g.fecha) ?? {
      fecha: g.fecha,
      mina: 0,
      molino: 0,
      total: 0,
      count: 0,
    };
    if (cat === GASTOS_RESUMEN_CATEGORIAS.MINA) day.mina += monto;
    if (cat === GASTOS_RESUMEN_CATEGORIAS.MOLINO) day.molino += monto;
    day.total += monto;
    day.count += 1;
    dailyMap.set(g.fecha, day);
  }

  const nominaRows: GastosResumenNominaSemana[] = nominaSemanas.map((s) => ({
    id: s.id,
    semana_inicio: s.semana_inicio,
    semana_fin: s.semana_fin,
    area: s.area || 'planta',
    total_pagado: Number(s.total_pagado) || 0,
    total_trabajadores: Number(s.total_trabajadores) || 0,
  }));

  const nominaTotal = nominaRows.reduce((acc, s) => acc + s.total_pagado, 0);
  const nominaTrabajadores = nominaRows.reduce((acc, s) => acc + s.total_trabajadores, 0);

  const gastosTotal = mina.total + molino.total;
  const gastosCount = mina.count + molino.count;

  return {
    period,
    mina,
    molino,
    nomina: {
      total: nominaTotal,
      semanas: nominaRows.length,
      trabajadores: nominaTrabajadores,
    },
    combined: {
      total: gastosTotal + nominaTotal,
      count: gastosCount,
    },
    daily: Array.from(dailyMap.values()).sort((a, b) => a.fecha.localeCompare(b.fecha)),
    nominaSemanas: nominaRows.sort((a, b) => a.semana_inicio.localeCompare(b.semana_inicio)),
  };
}
