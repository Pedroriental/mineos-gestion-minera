import { FALLBACK_SNAPSHOT, type BibliotecaAppSnapshot } from '@/lib/biblioteca-catalog';
import { isPersonalVisibleInNomina } from '@/lib/personal-master';
import type { Personal } from '@/lib/types';

export const AUTO_ROTACION_OBS = '[auto-rotación]';

export function getEsquemaDefaultPorArea(snapshot: BibliotecaAppSnapshot = FALLBACK_SNAPSHOT) {
  return snapshot.esquemaDefaultPorArea as Record<string, Personal['esquema_rotacion']>;
}

export function getEsquemasPorArea(snapshot: BibliotecaAppSnapshot = FALLBACK_SNAPSHOT) {
  return snapshot.esquemasPorArea as Record<string, Personal['esquema_rotacion'][]>;
}

export function getEsquemaLabels(snapshot: BibliotecaAppSnapshot = FALLBACK_SNAPSHOT) {
  return snapshot.esquemaLabels;
}

/** @deprecated Preferir getEsquemaDefaultPorArea(useBiblioteca()) en cliente */
export const ESQUEMA_DEFAULT_POR_AREA = FALLBACK_SNAPSHOT.esquemaDefaultPorArea as Record<
  string,
  Personal['esquema_rotacion']
>;

/** @deprecated Preferir getEsquemasPorArea(useBiblioteca()) */
export const ESQUEMAS_POR_AREA = FALLBACK_SNAPSHOT.esquemasPorArea as Record<
  string,
  Personal['esquema_rotacion'][]
>;

/** @deprecated Preferir getEsquemaLabels(useBiblioteca()) */
export const ESQUEMA_LABELS = FALLBACK_SNAPSHOT.esquemaLabels;

const AREAS_NOMINA_OPERATIVA = ['mina', 'planta'] as const;

export function calculateExpectedAttendance(
  esquema: string,
  rotacionInicio: string | undefined | null,
  weekStartStr: string,
): 'trabajada' | 'libre' | 'no_laborado' {
  if (!rotacionInicio || esquema === 'FIJO_SEMANAL' || esquema === 'MOLINO_FIJO') {
    return 'trabajada';
  }
  const startDate = new Date(rotacionInicio);
  const weekStart = new Date(weekStartStr);
  const diffMs = weekStart.getTime() - startDate.getTime();
  const diffWeeks = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));

  if (esquema === 'MINA_2X1') {
    const position = ((diffWeeks % 3) + 3) % 3;
    return position === 2 ? 'libre' : 'trabajada';
  }
  if (esquema === 'MOLINO_ROTATIVO') {
    const position = ((diffWeeks % 2) + 2) % 2;
    return position === 1 ? 'libre' : 'trabajada';
  }
  if (esquema === 'MINA_ROTATIVA_3G') {
    const position = ((diffWeeks % 3) + 3) % 3;
    return position === 2 ? 'libre' : 'trabajada';
  }
  if (esquema === 'MOLINO_15X15') {
    const position = ((diffWeeks % 4) + 4) % 4;
    if (position === 2) return 'libre';
    if (position === 3) return 'no_laborado';
    return 'trabajada';
  }
  return 'trabajada';
}

export function tieneEsquemaConRotacion(esquema: string): boolean {
  return esquema !== 'FIJO_SEMANAL' && esquema !== 'MOLINO_FIJO';
}

/** En nómina activa de Mina o Molino (no solo en base maestra). */
export function estaEnNominaMinaOMolino(p: Pick<Personal, 'area' | 'estado_laboral' | 'activo'>): boolean {
  if (p.area !== 'mina' && p.area !== 'planta') return false;
  return isPersonalVisibleInNomina(p, p.area);
}

export function esSemanaRotacionLibre(
  p: Pick<Personal, 'esquema_rotacion' | 'rotacion_inicio_fecha'>,
  weekStart: string,
): boolean {
  if (!tieneEsquemaConRotacion(p.esquema_rotacion)) return false;
  const asistencia = calculateExpectedAttendance(
    p.esquema_rotacion,
    p.rotacion_inicio_fecha,
    weekStart,
  );
  return asistencia === 'libre' || asistencia === 'no_laborado';
}

/** Fuera de nómina mina/molino y en semana libre de rotación → vacaciones automáticas. */
export function debeMarcarVacacionesPorRotacion(
  p: Pick<Personal, 'area' | 'estado_laboral' | 'activo' | 'esquema_rotacion' | 'rotacion_inicio_fecha' | 'observacion_estado'>,
  weekStart: string,
): boolean {
  if (p.estado_laboral === 'DESPEDIDO' || p.estado_laboral === 'REPOSO') return false;
  if (
    p.estado_laboral === 'VACACIONES' &&
    p.observacion_estado &&
    !p.observacion_estado.startsWith(AUTO_ROTACION_OBS)
  ) {
    return false;
  }
  if (estaEnNominaMinaOMolino(p)) return false;
  return esSemanaRotacionLibre(p, weekStart);
}

export function getWeekStart(d = new Date()): string {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  return date.toISOString().split('T')[0];
}

export function debeQuitarVacacionesAuto(
  p: Pick<Personal, 'area' | 'estado_laboral' | 'activo' | 'esquema_rotacion' | 'rotacion_inicio_fecha' | 'observacion_estado'>,
  weekStart: string,
): boolean {
  if (p.estado_laboral !== 'VACACIONES') return false;
  if (!p.observacion_estado?.startsWith(AUTO_ROTACION_OBS)) return false;
  if (estaEnNominaMinaOMolino(p)) return true;
  return !esSemanaRotacionLibre(p, weekStart);
}
