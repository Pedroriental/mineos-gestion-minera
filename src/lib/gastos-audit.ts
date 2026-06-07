import type { Gasto } from '@/lib/types';

export type GastoDraftForAudit = {
  fecha: string;
  categoria_id: string;
  descripcion: string;
  monto: number;
  proveedor?: string | null;
  factura_referencia?: string | null;
};

export type GastoDuplicateMatch = {
  incomingIndex: number;
  existingId?: string;
  fecha: string;
  descripcion: string;
  monto: number;
  categoriaNombre?: string;
  reason: 'exact' | 'factura' | 'batch';
  message: string;
};

export type GastoAuditFinding = {
  id: string;
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  detail?: string;
  gastoIds?: string[];
  fecha?: string;
};

export function normalizeGastoText(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function roundMoney(value: number): string {
  return (Math.round(value * 100) / 100).toFixed(2);
}

export function gastoExactKey(g: GastoDraftForAudit): string {
  return [
    g.fecha,
    g.categoria_id,
    normalizeGastoText(g.descripcion),
    roundMoney(g.monto),
  ].join('|');
}

export function gastoFacturaKey(factura: string | null | undefined): string | null {
  const normalized = normalizeGastoText(factura).replace(/[^a-z0-9/-]/g, '');
  return normalized.length >= 3 ? normalized : null;
}

export function findGastoDuplicates(
  incoming: GastoDraftForAudit[],
  existing: Array<
    Pick<Gasto, 'id' | 'fecha' | 'categoria_id' | 'descripcion' | 'monto' | 'factura_referencia'> & {
      categorias_gasto?: { nombre?: string | null } | null;
    }
  >,
  excludeIds: Set<string> = new Set(),
): GastoDuplicateMatch[] {
  const matches: GastoDuplicateMatch[] = [];
  const seenIncoming = new Map<string, number>();

  incoming.forEach((draft, index) => {
    const exactKey = gastoExactKey(draft);
    const firstIndex = seenIncoming.get(exactKey);
    if (firstIndex !== undefined) {
      matches.push({
        incomingIndex: index,
        fecha: draft.fecha,
        descripcion: draft.descripcion,
        monto: draft.monto,
        reason: 'batch',
        message: `El ítem ${index + 1} repite el ítem ${firstIndex + 1} en este mismo registro.`,
      });
    } else {
      seenIncoming.set(exactKey, index);
    }

    const facturaKey = gastoFacturaKey(draft.factura_referencia);
    if (facturaKey) {
      const facturaHit = existing.find(
        (row) =>
          !excludeIds.has(row.id) &&
          gastoFacturaKey(row.factura_referencia) === facturaKey,
      );
      if (facturaHit) {
        matches.push({
          incomingIndex: index,
          existingId: facturaHit.id,
          fecha: draft.fecha,
          descripcion: draft.descripcion,
          monto: draft.monto,
          categoriaNombre: facturaHit.categorias_gasto?.nombre ?? undefined,
          reason: 'factura',
          message: `La factura/referencia "${draft.factura_referencia}" ya está en un gasto del ${facturaHit.fecha}.`,
        });
      }
    }

    const exactHit = existing.find(
      (row) => !excludeIds.has(row.id) && gastoExactKey(row) === exactKey,
    );
    if (exactHit) {
      matches.push({
        incomingIndex: index,
        existingId: exactHit.id,
        fecha: draft.fecha,
        descripcion: draft.descripcion,
        monto: draft.monto,
        categoriaNombre: exactHit.categorias_gasto?.nombre ?? undefined,
        reason: 'exact',
        message: `Ya existe un gasto el ${exactHit.fecha} con la misma categoría, descripción y monto ($${roundMoney(exactHit.monto)}).`,
      });
    }
  });

  const dedup = new Map<string, GastoDuplicateMatch>();
  for (const match of matches) {
    const key = `${match.incomingIndex}|${match.reason}|${match.existingId ?? 'batch'}`;
    if (!dedup.has(key)) dedup.set(key, match);
  }
  return Array.from(dedup.values());
}

export function auditGastosDataset(
  gastos: Array<
    Pick<Gasto, 'id' | 'fecha' | 'categoria_id' | 'descripcion' | 'monto' | 'proveedor' | 'factura_referencia' | 'created_at'> & {
      categorias_gasto?: { nombre?: string | null } | null;
    }
  >,
  nominaMismatches: Array<{ semanaId: string; gastoId: string; totalPagado: number; monto: number; semanaInicio: string }> = [],
): GastoAuditFinding[] {
  const findings: GastoAuditFinding[] = [];
  const today = new Date().toISOString().slice(0, 10);

  const exactGroups = new Map<string, string[]>();
  const facturaGroups = new Map<string, string[]>();

  gastos.forEach((gasto) => {
    if (gasto.fecha > today) {
      findings.push({
        id: `future-${gasto.id}`,
        severity: 'warning',
        code: 'fecha_futura',
        message: 'Gasto con fecha futura',
        detail: `${gasto.descripcion} · ${gasto.fecha}`,
        gastoIds: [gasto.id],
        fecha: gasto.fecha,
      });
    }

    const exactKey = gastoExactKey(gasto);
    const exactIds = exactGroups.get(exactKey) ?? [];
    exactIds.push(gasto.id);
    exactGroups.set(exactKey, exactIds);

    const facturaKey = gastoFacturaKey(gasto.factura_referencia);
    if (facturaKey) {
      const facturaIds = facturaGroups.get(facturaKey) ?? [];
      facturaIds.push(gasto.id);
      facturaGroups.set(facturaKey, facturaIds);
    }

    if (gasto.monto >= 5000 && !gasto.proveedor?.trim()) {
      findings.push({
        id: `no-proveedor-${gasto.id}`,
        severity: 'info',
        code: 'proveedor_faltante',
        message: 'Gasto alto sin proveedor',
        detail: `${gasto.descripcion} · $${roundMoney(gasto.monto)}`,
        gastoIds: [gasto.id],
        fecha: gasto.fecha,
      });
    }
  });

  exactGroups.forEach((ids, key) => {
    if (ids.length <= 1) return;
    const sample = gastos.find((g) => g.id === ids[0]);
    findings.push({
      id: `dup-exact-${key}`,
      severity: 'error',
      code: 'duplicado_exacto',
      message: `${ids.length} gastos idénticos (fecha, categoría, descripción y monto)`,
      detail: sample ? `${sample.descripcion} · ${sample.fecha} · $${roundMoney(sample.monto)}` : undefined,
      gastoIds: ids,
      fecha: sample?.fecha,
    });
  });

  facturaGroups.forEach((ids, facturaKey) => {
    if (ids.length <= 1) return;
    findings.push({
      id: `dup-factura-${facturaKey}`,
      severity: 'error',
      code: 'factura_duplicada',
      message: `${ids.length} gastos comparten la misma factura/referencia`,
      gastoIds: ids,
    });
  });

  nominaMismatches.forEach((row) => {
    findings.push({
      id: `nomina-${row.semanaId}`,
      severity: 'error',
      code: 'nomina_monto',
      message: 'Nómina vinculada con monto distinto al gasto',
      detail: `Semana ${row.semanaInicio}: nómina $${roundMoney(row.totalPagado)} vs gasto $${roundMoney(row.monto)}`,
      gastoIds: [row.gastoId],
    });
  });

  return findings.sort((a, b) => {
    const rank = { error: 0, warning: 1, info: 2 };
    return rank[a.severity] - rank[b.severity];
  });
}

export function formatDuplicateMatches(matches: GastoDuplicateMatch[]): string {
  if (matches.length === 0) return '';
  return matches
    .map((match) => `• Ítem ${match.incomingIndex + 1}: ${match.message}`)
    .join('\n');
}
