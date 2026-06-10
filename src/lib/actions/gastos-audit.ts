'use server';

import { createServerClient } from '@/lib/supabase-server';
import {
  auditGastosDataset,
  findGastoDuplicates,
  type GastoAuditFinding,
  type GastoDraftForAudit,
  type GastoDuplicateMatch,
} from '@/lib/gastos-audit';
import { GastoSchema } from '@/lib/validations/gastos';
import type { Gasto } from '@/lib/types';
import { z } from 'zod';

type GastoAuditRow = Pick<
  Gasto,
  'id' | 'fecha' | 'categoria_id' | 'descripcion' | 'monto' | 'proveedor' | 'factura_referencia'
> & {
  created_at?: string;
  categorias_gasto?: { nombre?: string | null } | null;
};

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function normalizeGastoAuditRow(row: {
  id: string;
  fecha: string;
  categoria_id: string;
  descripcion: string;
  monto: number;
  proveedor?: string | null;
  factura_referencia?: string | null;
  created_at?: string;
  categorias_gasto?: { nombre?: string | null } | { nombre?: string | null }[] | null;
}): GastoAuditRow {
  return {
    id: row.id,
    fecha: row.fecha,
    categoria_id: row.categoria_id,
    descripcion: row.descripcion,
    monto: row.monto,
    proveedor: row.proveedor ?? undefined,
    factura_referencia: row.factura_referencia ?? undefined,
    created_at: row.created_at,
    categorias_gasto: firstRelation(row.categorias_gasto),
  };
}

const VerifyInputSchema = z.object({
  gastos: z.array(GastoSchema),
  excludeIds: z.array(z.string().uuid()).optional(),
});

export type VerifyGastosResult =
  | { ok: true; duplicates: GastoDuplicateMatch[]; warnings: GastoAuditFinding[] }
  | { ok: false; message: string };

export type AuditGastosResult =
  | {
      ok: true;
      findings: GastoAuditFinding[];
      summary: { errors: number; warnings: number; info: number; total: number };
    }
  | { ok: false; message: string };

async function loadExistingForVerification(
  gastos: GastoDraftForAudit[],
  excludeIds: Set<string>,
) {
  if (gastos.length === 0) return [];

  const supabase = await createServerClient();
  const dates = gastos.map((g) => g.fecha);
  const minDate = dates.reduce((a, b) => (a < b ? a : b));
  const maxDate = dates.reduce((a, b) => (a > b ? a : b));

  let query = supabase
    .from('gastos')
    .select('id, fecha, categoria_id, descripcion, monto, proveedor, factura_referencia, categorias_gasto(nombre)')
    .gte('fecha', minDate)
    .lte('fecha', maxDate);

  const { data, error } = await query;
  if (error) {
    console.error('[gastos-audit] loadExistingForVerification:', error.message);
    return [];
  }
  return (data ?? [])
    .filter((row) => !excludeIds.has(row.id))
    .map((row) => normalizeGastoAuditRow(row));
}

export async function verifyGastosBeforeSave(raw: unknown): Promise<VerifyGastosResult> {
  try {
    const parsed = VerifyInputSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, message: 'Datos inválidos para verificación.' };
    }

    const excludeIds = new Set(parsed.data.excludeIds ?? []);
    const existing = await loadExistingForVerification(parsed.data.gastos, excludeIds);
    const duplicates = findGastoDuplicates(parsed.data.gastos, existing, excludeIds);

    const warnings: GastoAuditFinding[] = [];
    const today = new Date().toISOString().slice(0, 10);
    parsed.data.gastos.forEach((gasto, index) => {
      if (gasto.fecha > today) {
        warnings.push({
          id: `future-incoming-${index}`,
          severity: 'warning',
          code: 'fecha_futura',
          message: `Ítem ${index + 1} tiene fecha futura (${gasto.fecha}).`,
          fecha: gasto.fecha,
        });
      }
      if (gasto.monto >= 5000 && !gasto.proveedor?.trim()) {
        warnings.push({
          id: `no-proveedor-incoming-${index}`,
          severity: 'info',
          code: 'proveedor_faltante',
          message: `Ítem ${index + 1}: monto alto sin proveedor registrado.`,
        });
      }
    });

    return { ok: true, duplicates, warnings };
  } catch (err) {
    console.error('[gastos-audit] verifyGastosBeforeSave:', err);
    return { ok: false, message: 'No se pudo verificar el gasto.' };
  }
}

export async function auditGastosRegistros(): Promise<AuditGastosResult> {
  try {
    const supabase = await createServerClient();

    const [{ data: gastos, error: gastosError }, { data: nominaRows, error: nominaError }] =
      await Promise.all([
        supabase
          .from('gastos')
          .select('id, fecha, categoria_id, descripcion, monto, proveedor, factura_referencia, created_at, categorias_gasto(nombre)')
          .order('fecha', { ascending: false })
          .limit(1000),
        supabase
          .from('nomina_semanas')
          .select('id, semana_inicio, total_pagado, gasto_id, gastos(monto)')
          .not('gasto_id', 'is', null)
          .limit(500),
      ]);

    if (gastosError) {
      return { ok: false, message: gastosError.message };
    }

    const nominaMismatches =
      nominaError || !nominaRows
        ? []
        : nominaRows
            .map((row) => {
              const gasto = firstRelation(row.gastos);
              const monto = Number(gasto?.monto ?? NaN);
              const totalPagado = Number(row.total_pagado ?? NaN);
              if (!row.gasto_id || Number.isNaN(monto) || Number.isNaN(totalPagado)) return null;
              if (Math.abs(monto - totalPagado) <= 0.01) return null;
              return {
                semanaId: row.id,
                gastoId: row.gasto_id,
                totalPagado,
                monto,
                semanaInicio: row.semana_inicio,
              };
            })
            .filter(Boolean) as Array<{
            semanaId: string;
            gastoId: string;
            totalPagado: number;
            monto: number;
            semanaInicio: string;
          }>;

    const findings = auditGastosDataset(
      (gastos ?? []).map((row) => normalizeGastoAuditRow(row)),
      nominaMismatches,
    );
    const summary = {
      errors: findings.filter((f) => f.severity === 'error').length,
      warnings: findings.filter((f) => f.severity === 'warning').length,
      info: findings.filter((f) => f.severity === 'info').length,
      total: findings.length,
    };

    return { ok: true, findings, summary };
  } catch (err) {
    console.error('[gastos-audit] auditGastosRegistros:', err);
    return { ok: false, message: 'No se pudo ejecutar la auditoría de gastos.' };
  }
}

export async function checkGastoDuplicatesForSave(
  gastos: GastoDraftForAudit[],
  excludeIds: string[] = [],
): Promise<GastoDuplicateMatch[]> {
  const exclude = new Set(excludeIds);
  const existing = await loadExistingForVerification(gastos, exclude);
  return findGastoDuplicates(gastos, existing, exclude);
}
