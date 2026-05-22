export const DESTINO_OPTIONS = [
  { value: '', label: 'Sin Ubicación' },
  { value: 'mina', label: 'Mina' },
  { value: 'planta', label: 'Planta' },
  { value: 'general', label: 'General' },
] as const;

export const DESTINO_LABELS: Record<string, string> = {
  '': 'Sin Ubicación',
  mina: 'Mina',
  planta: 'Planta',
  general: 'General',
};

const VALID_DESTINOS = new Set(['mina', 'planta', 'general']);

export function normalizeDestino(value?: string | null): string {
  const v = (value || '').trim().toLowerCase();
  return VALID_DESTINOS.has(v) ? v : '';
}

export function destinoLabel(value?: string | null) {
  const key = normalizeDestino(value);
  return DESTINO_LABELS[key] ?? 'Sin Ubicación';
}

/** Texto libre antiguo en `ubicacion` (p. ej. "mi casa") — debe mostrarse y guardarse como sin destino. */
export function needsUbicacionReset(value?: string | null): boolean {
  if (!value?.trim()) return false;
  return normalizeDestino(value) === '';
}
