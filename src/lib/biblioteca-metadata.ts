import type { BibliotecaVariable } from '@/lib/types';

export const BIBLIOTECA_AREA_KEYS = [
  'mina',
  'planta',
  'administracion',
  'seguridad',
  'transporte',
] as const;

export const BIBLIOTECA_AREA_OPERATIVA_KEYS = ['mina', 'planta', 'general'] as const;

export type BibliotecaVariableMetadata = {
  areas?: string[];
  default_for_area?: string;
  display_label?: string;
};

export function parseVariableMetadata(v: BibliotecaVariable | { metadata?: unknown }): BibliotecaVariableMetadata {
  const m = v.metadata;
  if (!m || typeof m !== 'object') return {};
  const raw = m as BibliotecaVariableMetadata;
  return {
    areas: Array.isArray(raw.areas) ? raw.areas.map(String) : undefined,
    default_for_area: typeof raw.default_for_area === 'string' ? raw.default_for_area : undefined,
    display_label: typeof raw.display_label === 'string' ? raw.display_label : undefined,
  };
}

export function buildVariableMetadata(input: {
  areas?: string[];
  default_for_area?: string;
  display_label?: string;
}): BibliotecaVariableMetadata {
  const metadata: BibliotecaVariableMetadata = {};
  if (input.areas?.length) metadata.areas = input.areas;
  if (input.default_for_area) metadata.default_for_area = input.default_for_area;
  if (input.display_label?.trim()) metadata.display_label = input.display_label.trim();
  return metadata;
}

export function variableDisplayLabel(v: BibliotecaVariable): string {
  const meta = parseVariableMetadata(v);
  return meta.display_label || v.etiqueta;
}

export function formatMetadataResumen(v: BibliotecaVariable, categoriaSlug?: string): string | null {
  const meta = parseVariableMetadata(v);
  if (categoriaSlug === 'esquemas_rotacion' || categoriaSlug === 'ubicaciones_laborales') {
    const parts: string[] = [];
    if (meta.areas?.length) parts.push(`Áreas: ${meta.areas.join(', ')}`);
    if (meta.default_for_area) parts.push(`Default: ${meta.default_for_area}`);
    return parts.length ? parts.join(' · ') : null;
  }
  if (meta.display_label && meta.display_label !== v.etiqueta) {
    return `Etiqueta UI: ${meta.display_label}`;
  }
  return null;
}

export function categoriaUsaMetadataAreas(slug: string): boolean {
  return slug === 'esquemas_rotacion' || slug === 'ubicaciones_laborales';
}

export function categoriaUsaDisplayLabel(slug: string): boolean {
  return slug === 'clima_guardia' || slug === 'inventario_movimiento' || slug === 'turnos';
}
