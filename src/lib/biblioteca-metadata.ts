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
  /** Cargos laborales */
  nivel_jerarquico?: 'operativo' | 'supervision' | 'jefatura' | 'administrativo' | string;
  salario_base_default?: number;
  salario_libre_default?: number;
  areas_tipicas?: string[];
  /** Condimentos / voladuras */
  tipo_insumo?: 'detonante' | 'carga' | 'accesorio' | 'reforzante' | string;
  campo_voladura?: string;
  /** Rotación */
  dias_ciclo?: number;
  /** Prioridad */
  severidad?: 'baja' | 'media' | 'alta' | 'critica' | string;
  /** Estados */
  es_activo?: boolean;
  es_terminal?: boolean;
  /** Equipos */
  clase_equipo?: string;
};

function numOrUndef(v: unknown): number | undefined {
  if (v == null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export function parseVariableMetadata(v: BibliotecaVariable | { metadata?: unknown }): BibliotecaVariableMetadata {
  const m = v.metadata;
  if (!m || typeof m !== 'object') return {};
  const raw = m as Record<string, unknown>;
  return {
    areas: Array.isArray(raw.areas) ? raw.areas.map(String) : undefined,
    default_for_area: typeof raw.default_for_area === 'string' ? raw.default_for_area : undefined,
    display_label: typeof raw.display_label === 'string' ? raw.display_label : undefined,
    nivel_jerarquico: typeof raw.nivel_jerarquico === 'string' ? raw.nivel_jerarquico : undefined,
    salario_base_default: numOrUndef(raw.salario_base_default),
    salario_libre_default: numOrUndef(raw.salario_libre_default),
    areas_tipicas: Array.isArray(raw.areas_tipicas) ? raw.areas_tipicas.map(String) : undefined,
    tipo_insumo: typeof raw.tipo_insumo === 'string' ? raw.tipo_insumo : undefined,
    campo_voladura: typeof raw.campo_voladura === 'string' ? raw.campo_voladura : undefined,
    dias_ciclo: numOrUndef(raw.dias_ciclo),
    severidad: typeof raw.severidad === 'string' ? raw.severidad : undefined,
    es_activo: raw.es_activo === true,
    es_terminal: raw.es_terminal === true,
    clase_equipo: typeof raw.clase_equipo === 'string' ? raw.clase_equipo : undefined,
  };
}

export function buildVariableMetadata(meta: BibliotecaVariableMetadata): BibliotecaVariableMetadata {
  const out: BibliotecaVariableMetadata = {};
  if (meta.areas?.length) out.areas = meta.areas;
  if (meta.default_for_area) out.default_for_area = meta.default_for_area;
  if (meta.display_label?.trim()) out.display_label = meta.display_label.trim();
  if (meta.nivel_jerarquico) out.nivel_jerarquico = meta.nivel_jerarquico;
  if (meta.salario_base_default != null) out.salario_base_default = meta.salario_base_default;
  if (meta.salario_libre_default != null) out.salario_libre_default = meta.salario_libre_default;
  if (meta.areas_tipicas?.length) out.areas_tipicas = meta.areas_tipicas;
  if (meta.tipo_insumo) out.tipo_insumo = meta.tipo_insumo;
  if (meta.campo_voladura?.trim()) out.campo_voladura = meta.campo_voladura.trim();
  if (meta.dias_ciclo != null) out.dias_ciclo = meta.dias_ciclo;
  if (meta.severidad) out.severidad = meta.severidad;
  if (meta.es_activo) out.es_activo = true;
  if (meta.es_terminal) out.es_terminal = true;
  if (meta.clase_equipo?.trim()) out.clase_equipo = meta.clase_equipo.trim();
  return out;
}

export function variableDisplayLabel(v: BibliotecaVariable): string {
  const meta = parseVariableMetadata(v);
  return meta.display_label || v.etiqueta;
}

function schemaKindFromSlug(slug: string): string {
  if (slug === 'cargos') return 'labor_role';
  if (slug === 'condimentos_voladura') return 'explosive_supply';
  if (slug === 'esquemas_rotacion') return 'rotation_scheme';
  if (slug === 'ubicaciones_laborales') return 'work_location';
  if (['minas', 'verticales_voladura', 'molinos', 'asignacion_nomina'].includes(slug)) return 'geo_site';
  if (['seguridad_prioridad', 'compras_prioridad'].includes(slug)) return 'priority_level';
  if (['equipos_estado', 'seguridad_estado', 'procesamiento_estado'].includes(slug)) return 'process_state';
  return 'generic';
}

export function formatMetadataResumen(v: BibliotecaVariable, categoriaSlug?: string): string | null {
  const meta = parseVariableMetadata(v);
  const kind = categoriaSlug ? schemaKindFromSlug(categoriaSlug) : 'generic';

  if (kind === 'labor_role') {
    const parts: string[] = [];
    if (meta.nivel_jerarquico) parts.push(`Nivel: ${meta.nivel_jerarquico}`);
    if (meta.salario_base_default != null) parts.push(`Base: $${meta.salario_base_default}`);
    if (meta.areas_tipicas?.length) parts.push(`Áreas: ${meta.areas_tipicas.join(', ')}`);
    return parts.length ? parts.join(' · ') : null;
  }

  if (kind === 'explosive_supply') {
    const parts: string[] = [];
    if (meta.tipo_insumo) parts.push(meta.tipo_insumo);
    if (v.valor) parts.push(`Campo: ${v.valor}`);
    return parts.length ? parts.join(' · ') : null;
  }

  if (kind === 'rotation_scheme' || kind === 'work_location') {
    const parts: string[] = [];
    if (meta.areas?.length) parts.push(`Áreas: ${meta.areas.join(', ')}`);
    if (meta.default_for_area) parts.push(`Default: ${meta.default_for_area}`);
    if (meta.dias_ciclo != null) parts.push(`${meta.dias_ciclo} días`);
    return parts.length ? parts.join(' · ') : null;
  }

  if (kind === 'priority_level' && meta.severidad) {
    return `Severidad: ${meta.severidad}`;
  }

  if (kind === 'process_state') {
    const parts: string[] = [];
    if (meta.es_activo) parts.push('Activo');
    if (meta.es_terminal) parts.push('Final');
    return parts.length ? parts.join(' · ') : null;
  }

  if (meta.display_label && meta.display_label !== v.etiqueta) {
    return `UI: ${meta.display_label}`;
  }
  return null;
}

/** @deprecated Usar varForm.metadata directamente */
export function formFieldsFromMetadata(
  _categoriaSlug: string,
  metadata: Record<string, unknown> | undefined,
): { metadata: BibliotecaVariableMetadata } {
  return { metadata: parseVariableMetadata({ metadata } as BibliotecaVariable) };
}

/** @deprecated Usar buildVariableMetadata */
export function metadataFromFormFields(
  _categoriaSlug: string,
  fields: {
    metadataAreas: string[];
    metadataDefaultForArea: string;
    displayLabel: string;
    metadata?: BibliotecaVariableMetadata;
  },
): BibliotecaVariableMetadata {
  if (fields.metadata) return buildVariableMetadata(fields.metadata);
  return buildVariableMetadata({
    areas: fields.metadataAreas.length ? fields.metadataAreas : undefined,
    default_for_area: fields.metadataDefaultForArea || undefined,
    display_label: fields.displayLabel,
  });
}

export function emptyMetadataForSlug(slug: string): BibliotecaVariableMetadata {
  const kind = schemaKindFromSlug(slug);
  const base: BibliotecaVariableMetadata = {};
  if (kind === 'labor_role') base.nivel_jerarquico = 'operativo';
  if (kind === 'explosive_supply') base.tipo_insumo = 'accesorio';
  if (kind === 'priority_level') base.severidad = 'media';
  return base;
}
