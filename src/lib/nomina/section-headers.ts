/**
 * Detección unificada de encabezados de sección en Excel/PDF de nómina.
 * Soporta planillas combinadas Mina Belén + Molinos La Fé.
 */

/** Patrones que marcan inicio de bloque (no fila de trabajador). */
export const NOMINA_SECTION_HEADER_PATTERNS: RegExp[] = [
  /n[oó]mina\s+administrativ/i,
  /administrativ[ao]s?\s+molinos/i,
  /administrativ[ao]s?\s+mina/i,
  /semanas?\s+molinos/i,
  /semanas?\s+mina/i,
  /n[oó]mina\s+molinos/i,
  /n[oó]mina\s+mina\s+bel[eé]n/i,
  /molinos?\s+la\s+f[eé]/i,
  /mina\s+bel[eé]n\s*[-–]/i,
  /molinos?\s*[-–]\s*grupo/i,
  /grupo\s*\(?\s*mixto\s*\)?/i,
  /cocinera/i,
  /t[eé]cnico\s+operador/i,
  /t[eé]cnico\s+compresor/i,
  /vertical\s+\d/i,
  /transporte/i,
  /seguridad/i,
  /operador\s+de\s+molino/i,
  /molino\s+rotativo/i,
];

/** Divisores de documento (solo cambian contexto, sin filas propias). */
export const NOMINA_AREA_BANNER_PATTERNS: { re: RegExp; area: 'mina' | 'planta' | 'administracion' }[] = [
  { re: /n[oó]mina\s+(de\s+)?molinos?\s+la\s+f[eé]/i, area: 'planta' },
  { re: /^molinos?\s+la\s+f[eé]\b/i, area: 'planta' },
  { re: /n[oó]mina\s+(de\s+)?molinos?\b(?!.*mina\s+bel)/i, area: 'planta' },
  { re: /n[oó]mina\s+(de\s+)?mina\s+bel[eé]n/i, area: 'mina' },
  { re: /^mina\s+bel[eé]n\b/i, area: 'mina' },
  { re: /n[oó]mina\s+(de\s+)?mina\b(?!.*molino)/i, area: 'mina' },
];

export function isNominaSectionHeader(text: string): boolean {
  const t = text.trim();
  if (!t || t.length < 4) return false;
  if (/\d{1,2}\.\d{3}\.\d{3}/.test(t)) return false;
  if (/\d{2}\/\d{2}\/\d{4}/.test(t) && !NOMINA_SECTION_HEADER_PATTERNS.some((p) => p.test(t))) {
    return false;
  }
  if (NOMINA_AREA_BANNER_PATTERNS.some(({ re }) => re.test(t))) return true;
  return NOMINA_SECTION_HEADER_PATTERNS.some((p) => p.test(t));
}

/** Área explícita en banners de documento combinado (PDF multi-sección). */
export function inferAreaFromBanner(text: string): 'mina' | 'planta' | 'administracion' | null {
  const t = text.trim();
  for (const { re, area } of NOMINA_AREA_BANNER_PATTERNS) {
    if (re.test(t)) return area;
  }
  return null;
}

/** Palabras clave legacy (includes) para Excel cuando la fila es corta. */
export const NOMINA_SECTION_KEYWORDS = [
  'administrativos molinos',
  'administrativos mina',
  'administrativo molinos',
  'administrativo mina',
  'nómina administrativo',
  'nomina administrativo',
  'nómina molinos',
  'nomina molinos',
  'molinos la fé',
  'molinos la fe',
  'molinos-grupo',
  'molinos grupo',
  'semanas mina',
  'semanas molinos',
  'mina belén',
  'mina belen',
  'grupo mixto',
  'grupo (mixto)',
  'vertical',
  'cocinera',
  'tecnico',
  'técnico',
  'compresor',
  'operador',
  'transporte',
  'seguridad',
] as const;

export function isNominaSectionHeaderLoose(firstCell: string, rowText?: string): boolean {
  const candidates = [firstCell, rowText].filter(Boolean) as string[];
  for (const text of candidates) {
    if (isNominaSectionHeader(text)) return true;
    const lower = text.toLowerCase();
    if (NOMINA_SECTION_KEYWORDS.some((kw) => lower.includes(kw))) return true;
  }
  return false;
}
