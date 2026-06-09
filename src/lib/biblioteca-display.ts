import type { BibliotecaAppSnapshot } from '@/lib/biblioteca-catalog';
import { normalizeString } from '@/lib/reports/report-engine';

const GEO_SITE_SLUGS = new Set([
  'minas',
  'molinos',
  'ubicaciones_laborales',
  'verticales_voladura',
  'asignacion_nomina',
]);

/** Códigos internos (mina_belen) vs etiqueta legible (Mina Belén). */
export function isBibliotecaInternalCode(code: string, label: string): boolean {
  const c = code.trim();
  const l = label.trim();
  if (!c || c === l) return false;
  return /^[a-z0-9_-]+$/.test(c);
}

export function shouldStoreBibliotecaLabel(slug: string, code: string, label: string): boolean {
  return GEO_SITE_SLUGS.has(slug) && isBibliotecaInternalCode(code, label);
}

/** Convierte un valor guardado (código o etiqueta) a texto legible para UI y reportes. */
export function resolveBibliotecaLabel(
  snapshot: BibliotecaAppSnapshot,
  slug: string,
  raw: string | null | undefined,
): string {
  const t = raw?.trim();
  if (!t) return '';

  const map = snapshot.labelsBySlug[slug];
  if (map?.[t]) return map[t];

  const norm = normalizeString(t);
  for (const [key, label] of Object.entries(map || {})) {
    if (normalizeString(key) === norm || normalizeString(label) === norm) {
      return label;
    }
  }

  if (/^mina[-_]belen$/i.test(t)) return 'Mina Belén';
  if (/^molino[-_]la[-_]fe$/i.test(t)) return 'Molino La Fé';

  return t;
}
