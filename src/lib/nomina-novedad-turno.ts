export type NominaNovedadTurno =
  | 'ACTIVO'
  | 'REPOSO'
  | 'VACACIONES'
  | 'AUSENCIA'
  | 'OTRO';

export const NOVEDAD_TURNO_OPTIONS: NominaNovedadTurno[] = [
  'ACTIVO',
  'REPOSO',
  'VACACIONES',
  'AUSENCIA',
  'OTRO',
];

export const NOVEDAD_TURNO_LABEL: Record<NominaNovedadTurno, string> = {
  ACTIVO: 'Activo',
  REPOSO: 'Reposo',
  VACACIONES: 'Vacaciones',
  AUSENCIA: 'Ausencia',
  OTRO: 'Otro',
};

export const NOVEDAD_TURNO_PREVIEW_LABEL: Record<NominaNovedadTurno, string> = {
  ACTIVO: 'Activo',
  REPOSO: 'Reposo / ausencia',
  VACACIONES: 'Vacaciones',
  AUSENCIA: 'Ausencia en turno',
  OTRO: 'Otra novedad',
};

export function parseNovedadTurno(value: unknown): NominaNovedadTurno {
  if (!value) return 'ACTIVO';
  const val = String(value).trim().toUpperCase();
  if (val === 'REPOSO' || val === 'VACACIONES' || val === 'AUSENCIA' || val === 'OTRO') {
    return val;
  }
  if (val === 'RETIRADO' || val === 'DESPEDIDO' || val === 'INACTIVO') return 'AUSENCIA';
  return 'ACTIVO';
}

export function novedadTurnoTone(estado: NominaNovedadTurno): string {
  if (estado === 'ACTIVO') return 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25';
  if (estado === 'REPOSO') return 'text-amber-300 bg-amber-500/10 border-amber-500/25';
  if (estado === 'VACACIONES') return 'text-cyan-300 bg-cyan-500/10 border-cyan-500/25';
  if (estado === 'AUSENCIA') return 'text-red-300 bg-red-500/10 border-red-500/25';
  return 'text-orange-300 bg-orange-500/10 border-orange-500/25';
}

export function hasNovedadTurno(
  novedad: NominaNovedadTurno | undefined,
  obs?: string | null,
): boolean {
  return (novedad && novedad !== 'ACTIVO') || !!obs?.trim();
}

export function nominaNovedadDraftKey(area: string, weekStart: string): string {
  return `mineos-nomina-novedad-turno-v1:${area}:${weekStart}`;
}

export type NominaNovedadDraft = Record<
  string,
  { novedadTurno: NominaNovedadTurno; novedadTurnoObs: string }
>;

export function readNominaNovedadDraft(key: string): NominaNovedadDraft {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as NominaNovedadDraft;
    if (!parsed || typeof parsed !== 'object') return {};
    const out: NominaNovedadDraft = {};
    for (const [id, row] of Object.entries(parsed)) {
      if (!row || typeof row !== 'object') continue;
      out[id] = {
        novedadTurno: parseNovedadTurno(row.novedadTurno),
        novedadTurnoObs: String(row.novedadTurnoObs || ''),
      };
    }
    return out;
  } catch {
    return {};
  }
}

export function writeNominaNovedadDraft(key: string, draft: NominaNovedadDraft): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(draft));
  } catch {
    /* quota / private mode */
  }
}
