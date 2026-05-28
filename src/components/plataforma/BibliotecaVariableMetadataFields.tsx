'use client';

import {
  BIBLIOTECA_AREA_KEYS,
  BIBLIOTECA_AREA_OPERATIVA_KEYS,
  type BibliotecaVariableMetadata,
} from '@/lib/biblioteca-metadata';

type Props = {
  categoriaSlug: string;
  metadataAreas: string[];
  metadataDefaultForArea: string;
  displayLabel: string;
  onChange: (patch: {
    metadataAreas?: string[];
    metadataDefaultForArea?: string;
    displayLabel?: string;
  }) => void;
};

export function BibliotecaVariableMetadataFields({
  categoriaSlug,
  metadataAreas,
  metadataDefaultForArea,
  displayLabel,
  onChange,
}: Props) {
  const areaKeys =
    categoriaSlug === 'ubicaciones_laborales' ? BIBLIOTECA_AREA_KEYS : BIBLIOTECA_AREA_KEYS;

  const areaLabels: Record<string, string> = {
    mina: 'Mina',
    planta: 'Planta / Molino',
    administracion: 'Administración',
    seguridad: 'Seguridad',
    transporte: 'Transporte',
    general: 'General',
  };

  const toggleArea = (area: string) => {
    const next = metadataAreas.includes(area)
      ? metadataAreas.filter((a) => a !== area)
      : [...metadataAreas, area];
    onChange({
      metadataAreas: next,
      metadataDefaultForArea: next.includes(metadataDefaultForArea) ? metadataDefaultForArea : '',
    });
  };

  if (categoriaSlug === 'esquemas_rotacion' || categoriaSlug === 'ubicaciones_laborales') {
    return (
      <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3 sm:col-span-2">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-violet-300/90">
          Ámbito de uso
        </p>
        <p className="mb-3 text-[10px] text-white/45">
          Define en qué áreas de nómina aplica esta variable. Si no marcas ninguna, aplica a todas.
        </p>
        <div className="flex flex-wrap gap-2">
          {areaKeys.map((area) => (
            <label
              key={area}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-white/10 px-2 py-1 text-xs text-white/70"
            >
              <input
                type="checkbox"
                checked={metadataAreas.includes(area)}
                onChange={() => toggleArea(area)}
              />
              {areaLabels[area] || area}
            </label>
          ))}
        </div>
        <label className="mt-3 block text-[11px] font-semibold text-white/50">
          Área por defecto (opcional)
          <select
            className="input-field mt-1 w-full"
            value={metadataDefaultForArea}
            onChange={(e) => onChange({ metadataDefaultForArea: e.target.value })}
          >
            <option value="">— Ninguna —</option>
            {(metadataAreas.length ? metadataAreas : [...areaKeys]).map((a) => (
              <option key={a} value={a}>
                {areaLabels[a] || a}
              </option>
            ))}
          </select>
        </label>
      </div>
    );
  }

  if (
    categoriaSlug === 'clima_guardia' ||
    categoriaSlug === 'inventario_movimiento' ||
    categoriaSlug === 'turnos'
  ) {
    return (
      <label className="sm:col-span-2">
        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-white/50">
          Etiqueta en formularios (opcional)
        </span>
        <input
          className="input-field w-full"
          value={displayLabel}
          onChange={(e) => onChange({ displayLabel: e.target.value })}
          placeholder="Ej: ☀️ Despejado, ⬆ Entrada"
        />
        <p className="mt-1 text-[10px] text-white/40">
          Si se deja vacío, se usa la etiqueta principal. Útil para emojis en selects.
        </p>
      </label>
    );
  }

  return null;
}

export function metadataFromFormFields(
  categoriaSlug: string,
  fields: {
    metadataAreas: string[];
    metadataDefaultForArea: string;
    displayLabel: string;
  },
): BibliotecaVariableMetadata {
  const meta: BibliotecaVariableMetadata = {};
  if (categoriaSlug === 'esquemas_rotacion' || categoriaSlug === 'ubicaciones_laborales') {
    if (fields.metadataAreas.length) meta.areas = fields.metadataAreas;
    if (fields.metadataDefaultForArea) meta.default_for_area = fields.metadataDefaultForArea;
  }
  if (fields.displayLabel.trim()) meta.display_label = fields.displayLabel.trim();
  return meta;
}

export function formFieldsFromMetadata(
  categoriaSlug: string,
  metadata: Record<string, unknown> | undefined,
): {
  metadataAreas: string[];
  metadataDefaultForArea: string;
  displayLabel: string;
} {
  const m = metadata as BibliotecaVariableMetadata | undefined;
  return {
    metadataAreas: Array.isArray(m?.areas) ? m!.areas!.map(String) : [],
    metadataDefaultForArea: typeof m?.default_for_area === 'string' ? m.default_for_area : '',
    displayLabel: typeof m?.display_label === 'string' ? m.display_label : '',
  };
}
