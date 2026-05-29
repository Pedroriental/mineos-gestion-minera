import { FALLBACK_SNAPSHOT, type BibliotecaAppSnapshot } from '@/lib/biblioteca-catalog';
import type { Personal } from '@/lib/types';

/** Rutas que deben refrescarse cuando cambia el maestro de personal. */
export const PERSONAL_SYNC_PATHS = [
  '/admin/trabajadores',
  '/admin/nomina',
  '/mina/nomina',
  '/planta/nomina',
  '/operaciones/resumen',
  '/dashboard',
] as const;

export type EstadoLaboral = NonNullable<Personal['estado_laboral']>;

export const ESTADO_LABORAL_LABEL: Record<string, string> = {
  ACTIVO: 'Activo',
  REPOSO: 'Reposo',
  VACACIONES: 'Vacaciones',
  DESPEDIDO: 'Retirado',
  REENGANCHADO: 'Reenganchado',
  INACTIVO: 'Inactivo',
};

export function getEstadoLaboral(p: Pick<Personal, 'estado_laboral' | 'activo'>): string {
  return (p.estado_laboral || (p.activo ? 'ACTIVO' : 'INACTIVO')) as string;
}

/** Visible en la tabla semanal de pago del área (excluye retirados del maestro). */
export function isPersonalVisibleInNomina(
  p: Pick<Personal, 'area' | 'estado_laboral' | 'activo' | 'estatus'>,
  area: string,
): boolean {
  if (p.area !== area) return false;
  const estado = getEstadoLaboral(p);
  if (estado === 'DESPEDIDO' || estado === 'INACTIVO') return false;
  if (p.estatus && p.estatus !== 'ACTIVO') return false;
  return true;
}

/** Asignación en nómina (vertical/sector). No confundir con cargo (puesto). */
export function getAsignacionNomina(p: Pick<Personal, 'area_detalle' | 'area'>): string | null {
  return normalizeAreaDetalle(p.area_detalle || '', p.area);
}

/**
 * Clave de agrupación en pantallas de nómina (Vertical 1, Vertical 2, etc.).
 * Prioriza area_detalle; si falta, usa cargo porque en registros antiguos de mina
 * la vertical/sección a menudo se guardó ahí. No usar esto para mostrar "asignación"
 * en Base de Trabajadores (ahí va getAsignacionNomina).
 */
export function getGrupoNominaKey(p: Pick<Personal, 'area_detalle' | 'area' | 'cargo'>): string {
  const fromDetalle = getAsignacionNomina(p);
  if (fromDetalle) return fromDetalle;
  const cargo = (p.cargo || '').trim();
  return cargo || 'Sin asignación';
}

/** Etiqueta del módulo de nómina (uso interno / menú). */
export function areaNominaLabel(
  area: string,
  snapshot: BibliotecaAppSnapshot = FALLBACK_SNAPSHOT,
): string {
  const base = snapshot.areaNominaLabels[area];
  if (base) return `Nómina ${base}`;
  return `Nómina ${area}`;
}

/** Valor por defecto del sitio según el área de nómina (desde biblioteca). */
export function getUbicacionDefaultPorArea(
  snapshot: BibliotecaAppSnapshot = FALLBACK_SNAPSHOT,
): Record<string, string> {
  return snapshot.ubicacionDefaultPorArea;
}

/** @deprecated Usar getUbicacionDefaultPorArea(snapshot) o useBiblioteca() en cliente */
export const UBICACION_DEFAULT_POR_AREA = FALLBACK_SNAPSHOT.ubicacionDefaultPorArea;

/** Sugerencias de sitio al editar trabajadores (desde biblioteca). */
export function getUbicacionSugerenciasPorArea(
  snapshot: BibliotecaAppSnapshot = FALLBACK_SNAPSHOT,
): Record<string, string[]> {
  return snapshot.ubicacionSugerenciasPorArea;
}

/** @deprecated Usar getUbicacionSugerenciasPorArea(snapshot) */
export const UBICACION_SUGERENCIAS_POR_AREA = FALLBACK_SNAPSHOT.ubicacionSugerenciasPorArea;

/** Sitio donde labora el trabajador (lo que se muestra bajo el nombre en la base). */
export function getUbicacionLaboralLabel(
  p: Pick<Personal, 'area' | 'ubicacion_laboral'>,
  snapshot: BibliotecaAppSnapshot = FALLBACK_SNAPSHOT,
): string {
  const custom = (p.ubicacion_laboral || '').trim();
  if (custom) return custom;
  return snapshot.ubicacionDefaultPorArea[p.area] ?? p.area;
}

export function normalizeAreaDetalle(value: string, area: string): string | null {
  const t = value.trim();
  if (!t) return null;
  const n = t.toLowerCase();
  if (n === 'general' || n === area.toLowerCase()) return null;
  return t;
}

export function normalizeCedula(value: string): string {
  return value.replace(/\D/g, '');
}

function normalizeNombreText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export type PersonalSearchHit = {
  person: Personal;
  score: number;
  reason: 'cedula-exact' | 'cedula-partial' | 'nombre';
};

/** Búsqueda rápida para asignar trabajadores desde la base maestra. */
export function searchPersonalMaster(query: string, catalog: Personal[], limit = 8): PersonalSearchHit[] {
  const q = query.trim();
  if (q.length < 2) return [];

  const qNorm = normalizeNombreText(q);
  const qCedula = normalizeCedula(q);
  const qTokens = qNorm.split(/\s+/).filter(Boolean);
  const hits: PersonalSearchHit[] = [];

  for (const person of catalog) {
    const cedulaNorm = normalizeCedula(person.cedula || '');
    const nombreNorm = normalizeNombreText(person.nombre_completo || '');
    const nombreTokens = nombreNorm.split(/\s+/).filter(Boolean);

    if (qCedula.length >= 3) {
      if (cedulaNorm === qCedula) {
        hits.push({ person, score: 100, reason: 'cedula-exact' });
        continue;
      }
      if (cedulaNorm.includes(qCedula) || (qCedula.length >= 5 && qCedula.includes(cedulaNorm) && cedulaNorm.length >= 4)) {
        hits.push({ person, score: 82 - Math.min(12, Math.abs(cedulaNorm.length - qCedula.length)), reason: 'cedula-partial' });
        continue;
      }
    }

    if (qTokens.length > 0) {
      const allTokensMatch = qTokens.every((t) => nombreNorm.includes(t));
      if (!allTokensMatch) continue;

      let score = 48 + qTokens.length * 8;
      if (qTokens.length >= 2) {
        const first = qTokens[0];
        const last = qTokens[qTokens.length - 1];
        if (nombreTokens[0]?.startsWith(first)) score += 14;
        if (nombreTokens[nombreTokens.length - 1]?.startsWith(last)) score += 14;
      }
      if (nombreNorm.startsWith(qNorm)) score += 12;
      hits.push({ person, score, reason: 'nombre' });
    }
  }

  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}
