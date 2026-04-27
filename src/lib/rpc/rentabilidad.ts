/**
 * Callers tipados para los RPCs de rentabilidad.
 * Solo para uso en Server Components / Server Actions.
 */
import { createServerClient } from '@/lib/supabase-server';

// ── Tipos ──────────────────────────────────────────────────
export interface RentabilidadResult {
  periodo_dias:        number;
  fecha_inicio:        string;
  fecha_fin:           string;
  dias_con_produccion: number;
  // Producción
  oro_planta_g:        number;
  oro_quemado_g:       number;
  amalgama_total_g:    number;
  sacos_total:         number;
  ton_procesadas:      number;
  ley_cabeza_gpt:      number;
  prom_diario_g:       number;
  // Financiero
  precio_usd_gramo:    number;
  ingreso_bruto_usd:   number;
  gastos_total_usd:    number;
  ganancia_usd:        number;
  margen_pct:          number;
  es_rentable:         boolean;
  costo_por_gramo:     number;
}

export interface ProduccionDiariaRow {
  fecha:  string;
  oro_g:  number;
  sacos:  number;
  ton:    number;
  turnos: number;
}

export interface GastoCategoriaRow {
  categoria: string;
  total_usd: number;
  pct:       number;
}

// ── Helpers ─────────────────────────────────────────────────
export type PeriodoDias = 7 | 15 | 30 | 90;

const FALLBACK_RENTABILIDAD: RentabilidadResult = {
  periodo_dias: 30, fecha_inicio: '', fecha_fin: '', dias_con_produccion: 0,
  oro_planta_g: 0, oro_quemado_g: 0, amalgama_total_g: 0,
  sacos_total: 0, ton_procesadas: 0, ley_cabeza_gpt: 0, prom_diario_g: 0,
  precio_usd_gramo: 99.68, ingreso_bruto_usd: 0, gastos_total_usd: 0,
  ganancia_usd: 0, margen_pct: 0, es_rentable: false, costo_por_gramo: 0,
};

// ── Funciones públicas ───────────────────────────────────────

export async function getRentabilidad(
  dias: PeriodoDias = 30,
): Promise<RentabilidadResult> {
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc('get_rentabilidad', {
    periodo_dias: dias,
  });
  if (error) {
    console.error('[RPC] get_rentabilidad:', error.message);
    return FALLBACK_RENTABILIDAD;
  }
  return (data as RentabilidadResult) ?? FALLBACK_RENTABILIDAD;
}

export async function getProduccionDiaria(
  dias: PeriodoDias = 30,
): Promise<ProduccionDiariaRow[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc('get_produccion_diaria', {
    periodo_dias: dias,
  });
  if (error) {
    console.error('[RPC] get_produccion_diaria:', error.message);
    return [];
  }
  return (data as ProduccionDiariaRow[]) ?? [];
}

export async function getGastosPorCategoria(
  dias: PeriodoDias = 30,
): Promise<GastoCategoriaRow[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc('get_gastos_por_categoria', {
    periodo_dias: dias,
  });
  if (error) {
    console.error('[RPC] get_gastos_por_categoria:', error.message);
    return [];
  }
  return (data as GastoCategoriaRow[]) ?? [];
}
