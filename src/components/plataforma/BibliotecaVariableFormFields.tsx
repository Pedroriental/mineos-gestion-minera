'use client';

import {
  BIBLIOTECA_AREA_KEYS,
  type BibliotecaVariableMetadata,
} from '@/lib/biblioteca-metadata';
import type { BibliotecaCategorySchema } from '@/lib/biblioteca-schemas';

type FieldProps = {
  label: string;
  children: React.ReactNode;
  className?: string;
  hint?: string;
};

function Field({ label, children, className, hint }: FieldProps) {
  return (
    <label className={className}>
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-white/50">
        {label}
      </span>
      {children}
      {hint ? <p className="mt-1 text-[10px] text-white/40">{hint}</p> : null}
    </label>
  );
}

type Props = {
  schema: BibliotecaCategorySchema;
  metadata: BibliotecaVariableMetadata;
  valor: string;
  unidad: string;
  onMetadataChange: (patch: Partial<BibliotecaVariableMetadata>) => void;
  onValorChange: (valor: string) => void;
  onUnidadChange: (unidad: string) => void;
};

const AREA_LABELS: Record<string, string> = {
  mina: 'Mina',
  planta: 'Planta',
  administracion: 'Administración',
  seguridad: 'Seguridad',
  transporte: 'Transporte',
};

export function BibliotecaVariableFormFields({
  schema,
  metadata,
  valor,
  unidad,
  onMetadataChange,
  onValorChange,
  onUnidadChange,
}: Props) {
  const toggleArea = (key: 'areas' | 'areas_tipicas', area: string) => {
    const list = metadata[key] || [];
    const next = list.includes(area) ? list.filter((a) => a !== area) : [...list, area];
    onMetadataChange({ [key]: next });
  };

  switch (schema.kind) {
    case 'labor_role':
      return (
        <>
          <Field label="Nivel jerárquico" className="sm:col-span-2">
            <select
              className="input-field w-full"
              value={metadata.nivel_jerarquico || 'operativo'}
              onChange={(e) => onMetadataChange({ nivel_jerarquico: e.target.value })}
            >
              <option value="operativo">Operativo (palero, ayudante…)</option>
              <option value="supervision">Supervisión (capataz)</option>
              <option value="jefatura">Jefatura</option>
              <option value="administrativo">Administrativo</option>
            </select>
          </Field>
          <Field label="Sueldo base semanal ref. ($)">
            <input
              type="number"
              min={0}
              step="0.01"
              className="input-field w-full"
              value={metadata.salario_base_default ?? ''}
              onChange={(e) =>
                onMetadataChange({
                  salario_base_default: e.target.value === '' ? undefined : Number(e.target.value),
                })
              }
              placeholder="Ej: 150"
            />
          </Field>
          <Field label="Sueldo libre ref. ($)">
            <input
              type="number"
              min={0}
              step="0.01"
              className="input-field w-full"
              value={metadata.salario_libre_default ?? ''}
              onChange={(e) =>
                onMetadataChange({
                  salario_libre_default: e.target.value === '' ? undefined : Number(e.target.value),
                })
              }
              placeholder="Ej: 100"
            />
          </Field>
          <div className="sm:col-span-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-amber-300/90">
              Áreas típicas del cargo
            </p>
            <div className="flex flex-wrap gap-2">
              {BIBLIOTECA_AREA_KEYS.map((area) => (
                <label
                  key={area}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-white/10 px-2 py-1 text-xs text-white/70"
                >
                  <input
                    type="checkbox"
                    checked={(metadata.areas_tipicas || []).includes(area)}
                    onChange={() => toggleArea('areas_tipicas', area)}
                  />
                  {AREA_LABELS[area] || area}
                </label>
              ))}
            </div>
          </div>
        </>
      );

    case 'explosive_supply':
      return (
        <>
          <Field label="Tipo de insumo" className="sm:col-span-2">
            <select
              className="input-field w-full"
              value={metadata.tipo_insumo || 'accesorio'}
              onChange={(e) => onMetadataChange({ tipo_insumo: e.target.value })}
            >
              <option value="detonante">Detonante (fósforos, espaguetis…)</option>
              <option value="carga">Carga / explosivo principal</option>
              <option value="accesorio">Accesorio</option>
              <option value="reforzante">Reforzante (arroz, vitamina E…)</option>
            </select>
          </Field>
          <Field
            label="Campo en reporte de voladura"
            className="sm:col-span-2"
            hint="Nombre de la columna en voladuras (ej: fosforos_lp, trenza_metros, arroz_kg). Debe coincidir con el sistema."
          >
            <input
              className="input-field w-full font-mono text-sm"
              value={valor}
              onChange={(e) => {
                onValorChange(e.target.value);
                onMetadataChange({ campo_voladura: e.target.value });
              }}
              placeholder="fosforos_lp"
              required
            />
          </Field>
          <Field label="Unidad de medida">
            <input
              className="input-field w-full"
              value={unidad}
              onChange={(e) => onUnidadChange(e.target.value)}
              placeholder="unid., kg, m"
            />
          </Field>
        </>
      );

    case 'rotation_scheme':
      return (
        <>
          <Field label="Código del esquema (valor guardado)">
            <input
              className="input-field w-full font-mono text-sm"
              value={valor}
              onChange={(e) => onValorChange(e.target.value)}
              placeholder="MINA_2X1"
            />
          </Field>
          <Field label="Días de ciclo">
            <input
              type="number"
              min={1}
              className="input-field w-full"
              value={metadata.dias_ciclo ?? ''}
              onChange={(e) =>
                onMetadataChange({
                  dias_ciclo: e.target.value === '' ? undefined : Number(e.target.value),
                })
              }
            />
          </Field>
          <Field label="Unidad">
            <input
              className="input-field w-full"
              value={unidad}
              onChange={(e) => onUnidadChange(e.target.value)}
              placeholder="días"
            />
          </Field>
          <div className="sm:col-span-2 rounded-lg border border-violet-500/20 bg-violet-500/5 p-3">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-violet-300/90">
              Ámbito en nómina
            </p>
            <div className="flex flex-wrap gap-2">
              {BIBLIOTECA_AREA_KEYS.map((area) => (
                <label
                  key={area}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-white/10 px-2 py-1 text-xs text-white/70"
                >
                  <input
                    type="checkbox"
                    checked={(metadata.areas || []).includes(area)}
                    onChange={() => toggleArea('areas', area)}
                  />
                  {AREA_LABELS[area] || area}
                </label>
              ))}
            </div>
            <Field label="Área por defecto" className="mt-3">
              <select
                className="input-field w-full"
                value={metadata.default_for_area || ''}
                onChange={(e) => onMetadataChange({ default_for_area: e.target.value || undefined })}
              >
                <option value="">— Ninguna —</option>
                {(metadata.areas?.length ? metadata.areas : [...BIBLIOTECA_AREA_KEYS]).map((a) => (
                  <option key={a} value={a}>
                    {AREA_LABELS[a] || a}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </>
      );

    case 'work_location':
      return (
        <div className="sm:col-span-2 rounded-lg border border-violet-500/20 bg-violet-500/5 p-3">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-violet-300/90">
            Ámbito en nómina
          </p>
          <div className="flex flex-wrap gap-2">
            {BIBLIOTECA_AREA_KEYS.map((area) => (
              <label
                key={area}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-white/10 px-2 py-1 text-xs text-white/70"
              >
                <input
                  type="checkbox"
                  checked={(metadata.areas || []).includes(area)}
                  onChange={() => toggleArea('areas', area)}
                />
                {AREA_LABELS[area] || area}
              </label>
            ))}
          </div>
          <Field label="Área por defecto" className="mt-3">
            <select
              className="input-field w-full"
              value={metadata.default_for_area || ''}
              onChange={(e) => onMetadataChange({ default_for_area: e.target.value || undefined })}
            >
              <option value="">— Ninguna —</option>
              {(metadata.areas?.length ? metadata.areas : [...BIBLIOTECA_AREA_KEYS]).map((a) => (
                <option key={a} value={a}>
                  {AREA_LABELS[a] || a}
                </option>
              ))}
            </select>
          </Field>
        </div>
      );

    case 'geo_site':
      return (
        <Field
          label="Código operativo (valor en reportes)"
          className="sm:col-span-2"
          hint="Se guarda en filtros y formularios de mina/planta/nómina."
        >
          <input
            className="input-field w-full font-mono text-sm"
            value={valor}
            onChange={(e) => onValorChange(e.target.value)}
            placeholder="mina_belen"
          />
        </Field>
      );

    case 'labeled_option':
    case 'inventory_catalog':
      return (
        <Field label="Presentación en formularios (opcional)" className="sm:col-span-2">
          <input
            className="input-field w-full"
            value={metadata.display_label || ''}
            onChange={(e) => onMetadataChange({ display_label: e.target.value })}
            placeholder="Ej: ☀️ Despejado"
          />
        </Field>
      );

    case 'priority_level':
      return (
        <Field label="Severidad" className="sm:col-span-2">
          <select
            className="input-field w-full"
            value={metadata.severidad || 'media'}
            onChange={(e) => onMetadataChange({ severidad: e.target.value })}
          >
            <option value="baja">Baja</option>
            <option value="media">Media</option>
            <option value="alta">Alta</option>
            <option value="critica">Crítica</option>
          </select>
        </Field>
      );

    case 'process_state':
      return (
        <div className="flex flex-wrap gap-4 sm:col-span-2">
          <label className="inline-flex items-center gap-2 text-sm text-white/70">
            <input
              type="checkbox"
              checked={!!metadata.es_activo}
              onChange={(e) => onMetadataChange({ es_activo: e.target.checked })}
            />
            Estado operativo / en curso
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-white/70">
            <input
              type="checkbox"
              checked={!!metadata.es_terminal}
              onChange={(e) => onMetadataChange({ es_terminal: e.target.checked })}
            />
            Estado final (cerrado)
          </label>
        </div>
      );

    case 'equipment_type':
      return (
        <Field label="Clase de equipo" className="sm:col-span-2">
          <input
            className="input-field w-full"
            value={metadata.clase_equipo || ''}
            onChange={(e) => onMetadataChange({ clase_equipo: e.target.value })}
            placeholder="Camión, perforadora, compresor…"
          />
        </Field>
      );

    case 'process_type':
    case 'generic':
    default:
      return (
        <>
          <Field label="Valor / código">
            <input
              className="input-field w-full"
              value={valor}
              onChange={(e) => onValorChange(e.target.value)}
            />
          </Field>
          <Field label="Unidad">
            <input
              className="input-field w-full"
              value={unidad}
              onChange={(e) => onUnidadChange(e.target.value)}
            />
          </Field>
        </>
      );
  }
}
