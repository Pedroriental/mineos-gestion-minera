// ============================================================
// MineOS - Normalización de cuadrilla de trabajador
// Texto libre agrupado (A, B, C, Mañana, Noche) para listados.
// ============================================================

export const CUADRILLA_MAX_LEN = 40;

/** Normaliza texto de cuadrilla: trim + colapla espacios + trunca. */
export function normalizeCuadrilla(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().replace(/\s+/g, ' ');
  if (!trimmed) return null;
  if (trimmed.length > CUADRILLA_MAX_LEN) {
    return trimmed.slice(0, CUADRILLA_MAX_LEN);
  }
  return trimmed;
}

/** Sugerencias por defecto según el area del trabajador. */
export const CUADRILLA_SUGGESTIONS_DEFAULT: Record<string, string[]> = {
  mina: [
    'A',
    'B',
    'C',
    'D',
    'Cuadrilla A',
    'Cuadrilla B',
    'Cuadrilla C',
    'Mañana',
    'Noche',
  ],
  planta: [
    'Cuadrilla A',
    'Cuadrilla B',
    'Cuadrilla C',
    'Cuadrilla D',
    'Mañana',
    'Noche',
    'Tarde',
  ],
  administracion: ['Oficina', 'Cocina', 'Limpieza', 'Vigilancia'],
  seguridad: ['Turno Día', 'Turno Noche', 'Portón'],
  transporte: ['Camión 1', 'Camión 2', 'Camión 3'],
};

/** Devuelve las sugerencias para un area determinada. */
export function sugerenciasPorArea(area: string): string[] {
  return CUADRILLA_SUGGESTIONS_DEFAULT[area] || [];
}
