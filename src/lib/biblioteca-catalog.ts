import { loadBibliotecaCompleta } from '@/lib/actions/biblioteca-variables';
import { variableDisplayLabel } from '@/lib/biblioteca-metadata';
import { FALLBACK_BIBLIOTECA_CATALOGO } from '@/lib/biblioteca-fallbacks';
import type { BibliotecaCategoriaCompleta, BibliotecaVariable } from '@/lib/types';

export type BibliotecaSelectOption = { value: string; label: string };

export type BibliotecaAppSnapshot = {
  /** true cuando viene de Supabase con al menos una categoría */
  fromDatabase: boolean;
  options: Record<string, BibliotecaSelectOption[]>;
  /** Mapa etiqueta por valor (p. ej. categorías inventario) */
  labelsBySlug: Record<string, Record<string, string>>;
  valuesBySlug: Record<string, string[]>;
  areaNominaLabels: Record<string, string>;
  ubicacionDefaultPorArea: Record<string, string>;
  ubicacionSugerenciasPorArea: Record<string, string[]>;
  esquemaDefaultPorArea: Record<string, string>;
  esquemasPorArea: Record<string, string[]>;
  esquemaLabels: Record<string, string>;
  cargoSuggestions: string[];
  asignacionSuggestions: string[];
  minaSuggestions: string[];
  molinoSuggestions: string[];
};

const AREA_KEYS = ['mina', 'planta', 'administracion', 'seguridad', 'transporte'] as const;

const ESQUEMA_DEFAULT_FALLBACK: Record<string, string> = {
  mina: 'MINA_2X1',
  planta: 'MOLINO_ROTATIVO',
  administracion: 'FIJO_SEMANAL',
  seguridad: 'FIJO_SEMANAL',
  transporte: 'FIJO_SEMANAL',
};

const UBICACION_DEFAULT_FALLBACK: Record<string, string> = {
  mina: 'Mina Belén',
  planta: 'Molino La Fé',
  administracion: 'Administración',
  seguridad: 'Seguridad',
  transporte: 'Transporte',
};

function metaAreas(v: BibliotecaVariable): string[] {
  const raw = v.metadata?.areas;
  if (Array.isArray(raw)) return raw.map(String);
  return [];
}

function metaDefaultFor(v: BibliotecaVariable): string | null {
  const d = v.metadata?.default_for_area;
  return typeof d === 'string' ? d : null;
}

function varValue(v: BibliotecaVariable): string {
  return (v.valor || v.etiqueta).trim();
}

function findCategory(catalog: BibliotecaCategoriaCompleta[], slug: string) {
  return catalog.find((c) => c.slug === slug);
}

export function buildBibliotecaAppSnapshot(
  catalog: BibliotecaCategoriaCompleta[],
  fromDatabase = false,
): BibliotecaAppSnapshot {
  const options: Record<string, BibliotecaSelectOption[]> = {};
  const valuesBySlug: Record<string, string[]> = {};

  const labelsBySlug: Record<string, Record<string, string>> = {};

  for (const cat of catalog) {
    const vars = cat.variables
      .filter((v) => v.activo)
      .sort((a, b) => a.orden - b.orden || a.etiqueta.localeCompare(b.etiqueta));
    const opts = vars.map((v) => ({
      value: varValue(v),
      label: variableDisplayLabel(v),
    }));
    options[cat.slug] = opts;
    valuesBySlug[cat.slug] = opts.map((o) => o.value);
    const labelMap: Record<string, string> = {};
    opts.forEach((o) => {
      labelMap[o.value] = o.label;
    });
    labelsBySlug[cat.slug] = labelMap;
  }

  const areaCat = findCategory(catalog, 'areas_nomina');
  const areaNominaLabels: Record<string, string> = {};
  (areaCat?.variables || []).forEach((v) => {
    areaNominaLabels[varValue(v)] = v.etiqueta;
  });
  AREA_KEYS.forEach((a) => {
    if (!areaNominaLabels[a]) areaNominaLabels[a] = a.charAt(0).toUpperCase() + a.slice(1);
  });

  const ubicacionCat = findCategory(catalog, 'ubicaciones_laborales');
  const ubicacionDefaultPorArea: Record<string, string> = { ...UBICACION_DEFAULT_FALLBACK };
  const ubicacionSugerenciasPorArea: Record<string, string[]> = {};
  AREA_KEYS.forEach((a) => {
    ubicacionSugerenciasPorArea[a] = [];
  });

  (ubicacionCat?.variables || []).forEach((v) => {
    const label = v.etiqueta;
    const areas = metaAreas(v);
    const def = metaDefaultFor(v);
    if (def) ubicacionDefaultPorArea[def] = label;
    if (areas.length) {
      areas.forEach((a) => {
        if (!ubicacionSugerenciasPorArea[a]) ubicacionSugerenciasPorArea[a] = [];
        if (!ubicacionSugerenciasPorArea[a].includes(label)) ubicacionSugerenciasPorArea[a].push(label);
      });
    } else {
      AREA_KEYS.forEach((a) => {
        if (!ubicacionSugerenciasPorArea[a].includes(label)) ubicacionSugerenciasPorArea[a].push(label);
      });
    }
  });

  const esquemaCat = findCategory(catalog, 'esquemas_rotacion');
  const esquemaLabels: Record<string, string> = {};
  const allEsquemaCodes: string[] = [];
  (esquemaCat?.variables || []).forEach((v) => {
    const code = varValue(v);
    esquemaLabels[code] = v.etiqueta;
    allEsquemaCodes.push(code);
  });

  const esquemasPorArea: Record<string, string[]> = {};
  const esquemaDefaultPorArea: Record<string, string> = { ...ESQUEMA_DEFAULT_FALLBACK };
  AREA_KEYS.forEach((area) => {
    const allowed = (esquemaCat?.variables || [])
      .filter((v) => {
        const areas = metaAreas(v);
        return areas.length === 0 || areas.includes(area);
      })
      .map((v) => varValue(v));
    esquemasPorArea[area] = allowed.length ? allowed : allEsquemaCodes.length ? allEsquemaCodes : ['FIJO_SEMANAL'];
    const defVar = (esquemaCat?.variables || []).find((v) => metaDefaultFor(v) === area);
    if (defVar) esquemaDefaultPorArea[area] = varValue(defVar);
    else if (!esquemasPorArea[area].includes(esquemaDefaultPorArea[area])) {
      esquemaDefaultPorArea[area] = esquemasPorArea[area][0] || 'FIJO_SEMANAL';
    }
  });

  const cargoSuggestions = (findCategory(catalog, 'cargos')?.variables || []).map((v) => v.etiqueta);
  const asignacionSuggestions = (findCategory(catalog, 'asignacion_nomina')?.variables || []).map(
    (v) => v.etiqueta,
  );
  const minaSuggestions = (findCategory(catalog, 'minas')?.variables || []).map((v) => varValue(v));
  const molinoSuggestions = (findCategory(catalog, 'molinos')?.variables || []).map((v) => varValue(v));

  return {
    fromDatabase,
    options,
    labelsBySlug,
    valuesBySlug,
    areaNominaLabels,
    ubicacionDefaultPorArea,
    ubicacionSugerenciasPorArea,
    esquemaDefaultPorArea,
    esquemasPorArea,
    esquemaLabels,
    cargoSuggestions,
    asignacionSuggestions,
    minaSuggestions,
    molinoSuggestions,
  };
}

export const FALLBACK_SNAPSHOT = buildBibliotecaAppSnapshot(FALLBACK_BIBLIOTECA_CATALOGO, false);

export async function loadBibliotecaAppSnapshot(): Promise<BibliotecaAppSnapshot> {
  try {
    const catalog = await loadBibliotecaCompleta();
    if (!catalog.length) return FALLBACK_SNAPSHOT;
    return buildBibliotecaAppSnapshot(catalog, true);
  } catch {
    return FALLBACK_SNAPSHOT;
  }
}

export function getBibliotecaOptions(
  snapshot: BibliotecaAppSnapshot,
  slug: string,
  config?: { prependEmpty?: boolean; emptyLabel?: string; emptyValue?: string },
): BibliotecaSelectOption[] {
  const base = snapshot.options[slug] || [];
  if (!config?.prependEmpty) return base;
  return [
    { value: config.emptyValue ?? '', label: config.emptyLabel ?? '— Sin especificar —' },
    ...base,
  ];
}

export function getBibliotecaValues(snapshot: BibliotecaAppSnapshot, slug: string): string[] {
  return snapshot.valuesBySlug[slug] || [];
}

export function isBibliotecaValue(snapshot: BibliotecaAppSnapshot, slug: string, value: string): boolean {
  const allowed = getBibliotecaValues(snapshot, slug);
  if (!allowed.length) return true;
  return allowed.includes(value);
}

const TURNO_EMOJI: Record<string, string> = {
  dia: '☀ Día',
  noche: '🌙 Noche',
  completo: '🔄 Completo',
};

export function getTurnoOptions(snapshot: BibliotecaAppSnapshot, withEmoji = true): BibliotecaSelectOption[] {
  return getBibliotecaOptions(snapshot, 'turnos').map((o) => ({
    ...o,
    label: withEmoji ? TURNO_EMOJI[o.value] ?? o.label : o.label,
  }));
}

export function mergeSuggestions(base: string[], extra: string[]): string[] {
  return [...new Set([...base, ...extra].map((s) => s.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'es'),
  );
}
