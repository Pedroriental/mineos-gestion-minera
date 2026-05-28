/**
 * Alertas del Command Center — solo eventos que requieren acción.
 */

export type DashboardAlert = {
  id: string;
  title: string;
  href: string;
};

const MAX_ALERTS = 5;

const NOMINA_AREA_META: Record<string, { label: string; href: string }> = {
  planta: { label: 'Molinos', href: '/planta/nomina' },
  mina: { label: 'Mina Belén', href: '/mina/nomina' },
  administracion: { label: 'Administración', href: '/admin/nomina' },
};

type VoladuraRow = {
  id: string;
  mina?: string | null;
  sin_novedad?: boolean | null;
};

type InventarioRow = {
  id: string;
  nombre?: string | null;
  stock_actual?: number | null;
  stock_minimo?: number | null;
};

type NominaSemanaRow = {
  area?: string | null;
  semana_inicio?: string | null;
};

type ValeRow = {
  id: string;
  monto?: number | string | null;
  personal?: { area?: string | null } | null;
};

function currentWeekStartISO(): string {
  const date = new Date();
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  return date.toISOString().split('T')[0];
}

function fmtUsd(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
}

export function buildDashboardAlerts(input: {
  inventario: InventarioRow[];
  voladuras: VoladuraRow[];
  nominaSemanas: NominaSemanaRow[];
  personalCountByArea: Record<string, number>;
  valesPendientes: ValeRow[];
}): DashboardAlert[] {
  const alerts: DashboardAlert[] = [];
  const weekStart = currentWeekStartISO();

  const closedAreas = new Set(
    input.nominaSemanas
      .filter((s) => s.semana_inicio === weekStart && s.area)
      .map((s) => String(s.area)),
  );

  for (const item of input.inventario) {
    const stock = Number(item.stock_actual ?? 0);
    const min = Number(item.stock_minimo ?? 0);
    if (min <= 0 || stock > min) continue;
    alerts.push({
      id: `inv-${item.id}`,
      title: `Inventario bajo: ${item.nombre ?? 'Ítem'}`,
      href: '/admin/inventario',
    });
    if (alerts.length >= MAX_ALERTS) return alerts;
  }

  for (const [area, meta] of Object.entries(NOMINA_AREA_META)) {
    const activos = input.personalCountByArea[area] ?? 0;
    if (activos > 0 && !closedAreas.has(area)) {
      alerts.push({
        id: `nom-cierre-${area}`,
        title: `Nómina pendiente: ${meta.label} (${activos} activos)`,
        href: meta.href,
      });
      if (alerts.length >= MAX_ALERTS) return alerts;
    }
  }

  const valesByArea = new Map<string, { count: number; total: number }>();
  for (const v of input.valesPendientes) {
    const area = String(v.personal?.area ?? '');
    if (!NOMINA_AREA_META[area]) continue;
    const cur = valesByArea.get(area) ?? { count: 0, total: 0 };
    cur.count += 1;
    cur.total += Number(v.monto ?? 0);
    valesByArea.set(area, cur);
  }

  for (const [area, stats] of valesByArea) {
    const meta = NOMINA_AREA_META[area]!;
    alerts.push({
      id: `nom-vales-${area}`,
      title: `Vales pendientes (${meta.label}): ${stats.count} · ${fmtUsd(stats.total)}`,
      href: meta.href,
    });
    if (alerts.length >= MAX_ALERTS) return alerts;
  }

  for (const v of input.voladuras) {
    if (v.sin_novedad !== false) continue;
    const mina = (v.mina ?? 'sin mina').trim();
    alerts.push({
      id: `vol-${v.id}`,
      title: `Voladura con novedad: ${mina}`,
      href: '/mina/voladuras',
    });
    if (alerts.length >= MAX_ALERTS) return alerts;
  }

  return alerts;
}
