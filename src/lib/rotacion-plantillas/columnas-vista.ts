export const PLANTILLA_COLUMNAS_CATALOGO = [
  { key: 'nombre', label: 'Nombres', grupo: 'estandar' as const, defaultOn: true },
  { key: 'cedula', label: 'C.I.', grupo: 'estandar' as const, defaultOn: true },
  { key: 'fecha_ingreso', label: 'Fecha de ingreso', grupo: 'estandar' as const, defaultOn: true },
  { key: 'subtotal_semanal', label: 'Fila subtotal por semana', grupo: 'estandar' as const, defaultOn: true },
  { key: 'total_periodo', label: 'Total Nómina (USD)', grupo: 'estandar' as const, defaultOn: true },
  { key: 'cargo', label: 'Cargo', grupo: 'opcional' as const, defaultOn: false },
  { key: 'estado', label: 'Estado / asistencia', grupo: 'opcional' as const, defaultOn: false },
  { key: 'area_detalle', label: 'Área detalle', grupo: 'opcional' as const, defaultOn: false },
  { key: 'esquema', label: 'Esquema rotación', grupo: 'opcional' as const, defaultOn: false },
  { key: 'bono_transporte', label: 'Bono transporte', grupo: 'opcional' as const, defaultOn: false },
] as const;

export type PlantillaColumnaKey = (typeof PLANTILLA_COLUMNAS_CATALOGO)[number]['key'];

const VALID_KEYS = new Set<string>(PLANTILLA_COLUMNAS_CATALOGO.map((c) => c.key));

export const DEFAULT_COLUMNAS_VISTA: PlantillaColumnaKey[] = PLANTILLA_COLUMNAS_CATALOGO.filter(
  (c) => c.defaultOn,
).map((c) => c.key);

export function normalizeColumnasVista(raw: unknown): PlantillaColumnaKey[] {
  if (!Array.isArray(raw)) return [...DEFAULT_COLUMNAS_VISTA];
  const keys = raw.filter((k): k is PlantillaColumnaKey => typeof k === 'string' && VALID_KEYS.has(k));
  return keys.length ? keys : [...DEFAULT_COLUMNAS_VISTA];
}

export function labelColumnaVista(key: PlantillaColumnaKey): string {
  return PLANTILLA_COLUMNAS_CATALOGO.find((c) => c.key === key)?.label ?? key;
}
