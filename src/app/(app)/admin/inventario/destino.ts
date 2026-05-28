const DEFAULT_DESTINO_LABELS: Record<string, string> = {
  '': 'Sin Ubicación',
  mina: 'Mina',
  planta: 'Planta',
  general: 'General',
};

const DEFAULT_VALID = new Set(['mina', 'planta', 'general']);

export function buildDestinoLabelsFromOptions(
  options: { value: string; label: string }[],
): Record<string, string> {
  const map: Record<string, string> = { ...DEFAULT_DESTINO_LABELS };
  options.forEach((o) => {
    map[o.value] = o.label;
  });
  return map;
}

export function getValidDestinos(labels?: Record<string, string>): Set<string> {
  if (!labels) return DEFAULT_VALID;
  return new Set(
    Object.keys(labels).filter((k) => k !== ''),
  );
}

export function normalizeDestino(value?: string | null, validDestinos?: Set<string>): string {
  const v = (value || '').trim().toLowerCase();
  const allowed = validDestinos || DEFAULT_VALID;
  return allowed.has(v) ? v : '';
}

export function destinoLabel(value?: string | null, labels: Record<string, string> = DEFAULT_DESTINO_LABELS) {
  const key = normalizeDestino(value, getValidDestinos(labels));
  return labels[key] ?? labels[''] ?? 'Sin Ubicación';
}

/** Texto libre antiguo en `ubicacion` (p. ej. "mi casa") — debe mostrarse y guardarse como sin destino. */
export function needsUbicacionReset(value?: string | null, validDestinos?: Set<string>): boolean {
  if (!value?.trim()) return false;
  return normalizeDestino(value, validDestinos) === '';
}

/** @deprecated Usar useBibliotecaOptions('inventario_destino') en cliente */
export const DESTINO_OPTIONS = Object.entries(DEFAULT_DESTINO_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export const DESTINO_LABELS = DEFAULT_DESTINO_LABELS;
