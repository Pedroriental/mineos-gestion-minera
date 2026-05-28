import { createServerClient } from '@/lib/supabase-server';
import type {
  FiscalCuentaBancaria,
  FiscalDocumentoBundle,
  FiscalEntidad,
  FiscalEntidadCompleta,
  FiscalParametro,
  FiscalRepresentante,
  FiscalTextoLegal,
} from '@/lib/types';

/** Paquete listo para alimentar facturas, balances y planillas legales. */
export async function getFiscalDocumentoBundle(): Promise<FiscalDocumentoBundle> {
  const supabase = await createServerClient();

  const [{ data: entidades }, { data: textos }, { data: parametros }] = await Promise.all([
    supabase.from('fiscal_entidades').select('*').eq('activo', true),
    supabase.from('fiscal_textos_legales').select('*').eq('activo', true).order('categoria'),
    supabase.from('fiscal_parametros').select('*').order('grupo'),
  ]);

  const emisorRow =
    ((entidades || []) as FiscalEntidad[]).find((e) => e.es_emisor_principal) ||
    ((entidades || []) as FiscalEntidad[])[0] ||
    null;

  let emisor: FiscalEntidadCompleta | null = null;
  if (emisorRow) {
    const [{ data: reps }, { data: cuentas }] = await Promise.all([
      supabase.from('fiscal_representantes').select('*').eq('entidad_id', emisorRow.id),
      supabase.from('fiscal_cuentas_bancarias').select('*').eq('entidad_id', emisorRow.id),
    ]);
    emisor = {
      ...emisorRow,
      representantes: (reps || []) as FiscalRepresentante[],
      cuentas: (cuentas || []) as FiscalCuentaBancaria[],
    };
  }

  const paramMap: Record<string, string> = {};
  ((parametros || []) as FiscalParametro[]).forEach((p) => {
    paramMap[p.clave] = p.valor;
  });

  return {
    emisor,
    textos: (textos || []) as FiscalTextoLegal[],
    parametros: paramMap,
  };
}

export function getTextoLegalPorSlug(textos: FiscalTextoLegal[], slug: string): string | null {
  const row = textos.find((t) => t.slug === slug);
  return row?.contenido?.trim() || null;
}
