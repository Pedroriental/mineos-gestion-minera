import type { BibliotecaAppSnapshot } from '@/lib/biblioteca-catalog';
import { getBibliotecaValues } from '@/lib/biblioteca-catalog';
import { resolveBibliotecaLabel } from '@/lib/biblioteca-display';
import { ASIGNACION_NOMINA_OPCIONES } from '@/lib/personal-master';
import { normalizeString } from '@/lib/reports/report-engine';

function norm(value: string): string {
  return normalizeString(value);
}

/** Valores permitidos de asignación (biblioteca + lista legacy). */
export function asignacionNominaAllowedValues(snapshot?: BibliotecaAppSnapshot): string[] {
  const legacy = [...ASIGNACION_NOMINA_OPCIONES];
  if (!snapshot) return legacy;
  const fromBib = getBibliotecaValues(snapshot, 'asignacion_nomina');
  const labels = (snapshot.options['asignacion_nomina'] ?? []).map((o) => o.label).filter(Boolean);
  return [...new Set([...legacy, ...fromBib, ...labels])];
}

export function isAsignacionNominaValueValid(value: string, snapshot?: BibliotecaAppSnapshot): boolean {
  const t = value.trim();
  if (!t) return false;
  const n = norm(t);
  for (const allowed of asignacionNominaAllowedValues(snapshot)) {
    if (norm(allowed) === n) return true;
    if (snapshot && norm(resolveBibliotecaLabel(snapshot, 'asignacion_nomina', allowed)) === n) {
      return true;
    }
  }
  return false;
}

/** Valor canónico para guardar en `personal.area_detalle`. */
export function resolveAsignacionNominaValue(
  value: string,
  snapshot?: BibliotecaAppSnapshot,
): string | null {
  const t = value.trim();
  if (!t) return null;
  const n = norm(t);
  if ((ASIGNACION_NOMINA_OPCIONES as readonly string[]).includes(t)) return t;

  if (snapshot) {
    const bibValues = getBibliotecaValues(snapshot, 'asignacion_nomina');
    for (const raw of bibValues) {
      if (norm(raw) === n) return resolveBibliotecaLabel(snapshot, 'asignacion_nomina', raw) || raw;
    }
    for (const opt of snapshot.options['asignacion_nomina'] ?? []) {
      if (norm(opt.value) === n || norm(opt.label) === n) {
        return opt.label || opt.value;
      }
    }
  }

  for (const legacy of ASIGNACION_NOMINA_OPCIONES) {
    if (norm(legacy) === n) return legacy;
  }
  return null;
}
