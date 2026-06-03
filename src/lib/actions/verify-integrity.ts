'use server';

import { createServerClient } from '@/lib/supabase-server';
import { VerificationResultSchema } from '@/lib/validations/integrity';
import type { VerificationResult } from '@/lib/validations/integrity';
import { format } from 'date-fns';

export type VerifyActionResult =
  | { ok: true; data: VerificationResult }
  | { ok: false; message: string };

export async function verifyFinancialIntegrityAction(
  desde?: string,
  hasta?: string,
): Promise<VerifyActionResult> {
  try {
    const supabase = await createServerClient();
    const fechaDesde = desde || format(new Date(Date.now() - 90 * 86400000), 'yyyy-MM-dd');
    const fechaHasta = hasta || format(new Date(), 'yyyy-MM-dd');

    const { data: discrepancias, error } = await supabase.rpc(
      'fn_financial_integrity_check',
      {
        p_fecha_desde: fechaDesde,
        p_fecha_hasta: fechaHasta,
      },
    );

    if (error) {
      console.error('[Integrity] RPC error:', error.message);
      return { ok: false, message: `Error de verificación: ${error.message}` };
    }

    const raw = (discrepancias ?? []) as Array<{
      modulo: string;
      severidad: string;
      mensaje: string;
      fecha_ref: string | null;
      valor_esper: number | null;
      valor_real: number | null;
      diferencia: number;
    }>;

    const total = raw.length;
    const criticas = raw.filter((d) => d.severidad === 'CRITICO').length;
    const advertencias = raw.filter((d) => d.severidad === 'ADVERTENCIA').length;

    const result = {
      ok: criticas === 0,
      totalDiscrepancias: total,
      criticas,
      advertencias,
      discrepancias: raw.map((d) => ({
        modulo: d.modulo as 'nomina' | 'gastos' | 'produccion' | 'balance',
        severidad: d.severidad as 'CRITICO' | 'ADVERTENCIA',
        mensaje: d.mensaje,
        fecha_ref: d.fecha_ref,
        valor_esper: d.valor_esper,
        valor_real: d.valor_real,
        diferencia: d.diferencia,
      })),
      verificadoEn: new Date().toISOString(),
    };

    const parsed = VerificationResultSchema.safeParse(result);
    if (!parsed.success) {
      console.error('[Integrity] Schema validation error:', parsed.error.flatten());
      return { ok: false, message: 'Error interno: formato de verificación inválido' };
    }

    return { ok: true, data: parsed.data };
  } catch (err) {
    console.error('[Integrity] Unexpected error:', err);
    return { ok: false, message: 'Error interno del servidor al verificar integridad' };
  }
}
