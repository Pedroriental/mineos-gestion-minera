import { FALLBACK_SNAPSHOT, type BibliotecaAppSnapshot } from '@/lib/biblioteca-catalog';
import { isPersonalVisibleInNomina } from '@/lib/personal-master';
import { asistenciaPredichaPorEsquema } from '@/lib/nomina/perfil-ciclo-reglas';
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
  return asistenciaPredichaPorEsquema(esquema, rotacionInicio, weekStartStr);
}

export function tieneEsquemaConRotacion(esquema: string): boolean {
  return esquema !== 'FIJO_SEMANAL' && esquema !== 'MOLINO_FIJO';
}

export function estaEnNominaMinaOMolino(p: Pick<Personal, 'area' | 'estado_laboral' | 'activo' | 'estatus'>): boolean {
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
  p: Pick<Personal, 'area' | 'estado_laboral' | 'activo' | 'esquema_rotacion' | 'rotacion_inicio_fecha' | 'observacion_estado' | 'estatus'>,
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

export function getWeekStart(d: Date | string | number = new Date()): string {
  let date: Date;
  if (typeof d === 'string') {
    const parts = d.split('-');
    if (parts.length === 3) {
      const yyyy = parseInt(parts[0], 10);
      const mm = parseInt(parts[1], 10) - 1;
      const dd = parseInt(parts[2], 10);
      date = new Date(yyyy, mm, dd);
    } else {
      date = new Date(d);
    }
  } else {
    date = new Date(d);
  }

  const day = date.getDay(); // día local (0=Dom, 1=Lun…)
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const result = new Date(date);
  result.setDate(diff);

  // Usar componentes locales en vez de toISOString() para evitar el desfase UTC:
  const yyyy = result.getFullYear();
  const mm = String(result.getMonth() + 1).padStart(2, '0');
  const dd = String(result.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** Fuera de nómina mina/molino y en semana libre de rotación → vacaciones automáticas. */
export function debeQuitarVacacionesAuto(
  p: Pick<Personal, 'area' | 'estado_laboral' | 'activo' | 'esquema_rotacion' | 'rotacion_inicio_fecha' | 'observacion_estado' | 'estatus'>,
  weekStart: string,
): boolean {
  if (p.estado_laboral !== 'VACACIONES') return false;
  if (!p.observacion_estado?.startsWith(AUTO_ROTACION_OBS)) return false;
  if (estaEnNominaMinaOMolino(p)) return true;
  return !esSemanaRotacionLibre(p, weekStart);
}
