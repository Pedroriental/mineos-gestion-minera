'use server';

import { createServerClient } from '@/lib/supabase-server';
import { loadBibliotecaCompleta } from '@/lib/actions/biblioteca-variables';
import { loadReconciliationParamsFromCatalog } from '@/lib/reconciliation/load-params';
import {
  PRECIO_ORO_FALLBACK_USD,
  convertGramosToUsd,
  type PrecioOroGasto,
} from '@/lib/gastos-oro';
import type { GastoInput } from '@/lib/validations/gastos';

export async function resolvePrecioOroParaFecha(fecha: string): Promise<PrecioOroGasto> {
  const supabase = await createServerClient();

  const { data: exact } = await supabase
    .from('precio_oro_cache')
    .select('precio_usd_por_gramo, fecha, fuente')
    .eq('fecha', fecha)
    .order('consultado_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (exact?.precio_usd_por_gramo != null) {
    return {
      usdPorGramo: Number(exact.precio_usd_por_gramo),
      fechaReferencia: exact.fecha,
      fuente: exact.fuente ?? 'cache',
    };
  }

  const { data: prior } = await supabase
    .from('precio_oro_cache')
    .select('precio_usd_por_gramo, fecha, fuente')
    .lte('fecha', fecha)
    .order('fecha', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (prior?.precio_usd_por_gramo != null) {
    return {
      usdPorGramo: Number(prior.precio_usd_por_gramo),
      fechaReferencia: prior.fecha,
      fuente: prior.fuente ?? 'cache',
    };
  }

  const { data: latest } = await supabase
    .from('precio_oro_cache')
    .select('precio_usd_por_gramo, fecha, fuente')
    .order('fecha', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latest?.precio_usd_por_gramo != null) {
    return {
      usdPorGramo: Number(latest.precio_usd_por_gramo),
      fechaReferencia: latest.fecha,
      fuente: latest.fuente ?? 'cache',
    };
  }

  try {
    const catalogo = await loadBibliotecaCompleta();
    const params = loadReconciliationParamsFromCatalog(catalogo);
    if (params.precioOroFuente === 'manual' && params.precioOroManualUsd > 0) {
      return {
        usdPorGramo: params.precioOroManualUsd,
        fechaReferencia: null,
        fuente: 'manual',
      };
    }
  } catch {
    // biblioteca opcional
  }

  return {
    usdPorGramo: PRECIO_ORO_FALLBACK_USD,
    fechaReferencia: null,
    fuente: 'fallback',
  };
}

export async function getPrecioOroParaFecha(fecha: string): Promise<PrecioOroGasto> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return resolvePrecioOroParaFecha(new Date().toISOString().slice(0, 10));
  }
  return resolvePrecioOroParaFecha(fecha);
}

/** Convierte gramos a USD en servidor antes de persistir. */
export async function applyGastoOroConversion(data: GastoInput): Promise<GastoInput> {
  if (data.monto_gramos_oro == null || data.monto_gramos_oro <= 0) {
    return { ...data, monto_gramos_oro: null, precio_oro_usd_gramo: null };
  }

  const precio =
    data.precio_oro_usd_gramo && data.precio_oro_usd_gramo > 0
      ? data.precio_oro_usd_gramo
      : (await resolvePrecioOroParaFecha(data.fecha)).usdPorGramo;

  return {
    ...data,
    precio_oro_usd_gramo: precio,
    monto: convertGramosToUsd(data.monto_gramos_oro, precio),
  };
}
