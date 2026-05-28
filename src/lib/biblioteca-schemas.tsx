import type { ReactNode } from 'react';
import type { BibliotecaVariable } from '@/lib/types';
import {
  formatMetadataResumen,
  parseVariableMetadata,
  type BibliotecaVariableMetadata,
} from '@/lib/biblioteca-metadata';

/** Naturaleza del catálogo: define columnas de tabla y campos del formulario. */
export type BibliotecaSchemaKind =
  | 'labor_role'
  | 'explosive_supply'
  | 'rotation_scheme'
  | 'work_location'
  | 'geo_site'
  | 'labeled_option'
  | 'priority_level'
  | 'process_state'
  | 'inventory_catalog'
  | 'equipment_type'
  | 'process_type'
  | 'generic';

export type BibliotecaColumnDef = {
  id: string;
  label: string;
  className?: string;
  render: (v: BibliotecaVariable, slug: string) => ReactNode;
};

export type BibliotecaCategorySchema = {
  kind: BibliotecaSchemaKind;
  label: string;
  purpose: string;
  badgeClass: string;
  columns: BibliotecaColumnDef[];
};

function meta(v: BibliotecaVariable) {
  return parseVariableMetadata(v);
}

function cell(text: ReactNode, mono = false) {
  return (
    <span
      className={
        mono
          ? 'font-mono text-xs text-violet-300/85'
          : 'text-white/70'
      }
    >
      {text ?? '—'}
    </span>
  );
}

function badge(text: string, tone: 'violet' | 'amber' | 'red' | 'emerald' | 'sky' | 'zinc' = 'zinc') {
  const tones: Record<string, string> = {
    violet: 'border-violet-500/30 bg-violet-500/15 text-violet-200',
    amber: 'border-amber-500/30 bg-amber-500/15 text-amber-200',
    red: 'border-red-500/30 bg-red-500/15 text-red-200',
    emerald: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-200',
    sky: 'border-sky-500/30 bg-sky-500/15 text-sky-200',
    zinc: 'border-white/15 bg-white/[0.06] text-white/60',
  };
  return (
    <span className={`inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${tones[tone]}`}>
      {text}
    </span>
  );
}

const NIVEL_LABEL: Record<string, string> = {
  operativo: 'Operativo',
  supervision: 'Supervisión',
  jefatura: 'Jefatura',
  administrativo: 'Administrativo',
};

const TIPO_INSUMO_LABEL: Record<string, string> = {
  detonante: 'Detonante',
  carga: 'Carga / explosivo',
  accesorio: 'Accesorio',
  reforzante: 'Reforzante',
};

const SEVERIDAD_LABEL: Record<string, string> = {
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
  critica: 'Crítica',
};

function moneyRef(n?: number) {
  if (n == null || Number.isNaN(n)) return '—';
  return `$${n.toFixed(2)}`;
}

const SCHEMA_BY_KIND: Record<BibliotecaSchemaKind, Omit<BibliotecaCategorySchema, 'kind'>> = {
  labor_role: {
    label: 'Cargos laborales',
    purpose:
      'Puestos de la plantilla (operarios, capataces, jefes). El código se usa en personal y nómina; los sueldos de referencia alimentan cálculos masivos (con excepciones por trabajador).',
    badgeClass: 'text-amber-300/90',
    columns: [
      {
        id: 'cargo',
        label: 'Cargo',
        render: (v) => <span className="font-medium text-white/90">{v.etiqueta}</span>,
      },
      {
        id: 'clave',
        label: 'Clave',
        render: (v) => cell(v.clave, true),
      },
      {
        id: 'nivel',
        label: 'Nivel',
        render: (v) => {
          const m = meta(v);
          const key = m.nivel_jerarquico || 'operativo';
          return badge(NIVEL_LABEL[key] || key, key === 'jefatura' ? 'amber' : 'zinc');
        },
      },
      {
        id: 'salario_base',
        label: 'Sueldo base ref.',
        render: (v) => cell(moneyRef(meta(v).salario_base_default)),
      },
      {
        id: 'salario_libre',
        label: 'Sueldo libre ref.',
        render: (v) => cell(moneyRef(meta(v).salario_libre_default)),
      },
      {
        id: 'areas',
        label: 'Áreas típicas',
        render: (v) => cell(meta(v).areas_tipicas?.join(', ') || 'Todas'),
      },
    ],
  },
  explosive_supply: {
    label: 'Insumos de voladura',
    purpose:
      'Explosivos y accesorios del reporte de disparo. El campo en voladura enlaza la columna del formulario de voladuras; la unidad define cómo se contabiliza (unid., kg, m).',
    badgeClass: 'text-red-300/90',
    columns: [
      {
        id: 'insumo',
        label: 'Insumo',
        render: (v) => <span className="font-medium text-white/90">{v.etiqueta}</span>,
      },
      {
        id: 'tipo',
        label: 'Tipo',
        render: (v) => {
          const t = meta(v).tipo_insumo || 'accesorio';
          return badge(TIPO_INSUMO_LABEL[t] || t, t === 'detonante' || t === 'carga' ? 'red' : 'amber');
        },
      },
      {
        id: 'campo',
        label: 'Campo en voladura',
        render: (v) => cell(v.valor || meta(v).campo_voladura, true),
      },
      {
        id: 'unidad',
        label: 'Unidad',
        render: (v) => cell(v.unidad || '—'),
      },
      {
        id: 'clave',
        label: 'Clave catálogo',
        render: (v) => cell(v.clave, true),
      },
    ],
  },
  rotation_scheme: {
    label: 'Esquemas de rotación',
    purpose: 'Patrones de asistencia y turnos en nómina. Los días de ciclo y el ámbito por área definen defaults al asignar personal.',
    badgeClass: 'text-violet-300/90',
    columns: [
      {
        id: 'esquema',
        label: 'Esquema',
        render: (v) => <span className="font-medium text-white/90">{v.etiqueta}</span>,
      },
      {
        id: 'clave',
        label: 'Código',
        render: (v) => cell(v.valor || v.clave, true),
      },
      {
        id: 'dias',
        label: 'Días ciclo',
        render: (v) => cell(meta(v).dias_ciclo ?? '—'),
      },
      {
        id: 'unidad',
        label: 'Unidad',
        render: (v) => cell(v.unidad || 'días'),
      },
      {
        id: 'ambito',
        label: 'Ámbito',
        render: (v, slug) => cell(formatMetadataResumen(v, slug) || 'Todas las áreas'),
      },
    ],
  },
  work_location: {
    label: 'Ubicaciones laborales',
    purpose: 'Sitio físico donde labora el trabajador, filtrado por área de nómina (mina, planta, etc.).',
    badgeClass: 'text-sky-300/90',
    columns: [
      {
        id: 'sitio',
        label: 'Sitio',
        render: (v) => <span className="font-medium text-white/90">{v.etiqueta}</span>,
      },
      {
        id: 'clave',
        label: 'Clave',
        render: (v) => cell(v.clave, true),
      },
      {
        id: 'ambito',
        label: 'Áreas',
        render: (v, slug) => cell(formatMetadataResumen(v, slug) || 'Todas'),
      },
    ],
  },
  geo_site: {
    label: 'Sitios operativos',
    purpose: 'Unidades geográficas o funcionales (minas, verticales, molinos, verticales de nómina). El código se guarda en reportes y filtros.',
    badgeClass: 'text-emerald-300/90',
    columns: [
      {
        id: 'nombre',
        label: 'Nombre',
        render: (v) => <span className="font-medium text-white/90">{v.etiqueta}</span>,
      },
      {
        id: 'codigo',
        label: 'Código',
        render: (v) => cell(v.valor || v.clave, true),
      },
      {
        id: 'clave',
        label: 'Clave interna',
        render: (v) => cell(v.clave, true),
      },
      {
        id: 'notas',
        label: 'Notas',
        render: (v) => (
          <span className="line-clamp-2 text-xs text-white/45">{v.descripcion || '—'}</span>
        ),
      },
    ],
  },
  labeled_option: {
    label: 'Opciones con etiqueta',
    purpose: 'Valores de lista con presentación en formularios (turnos, clima, áreas). Opcional: emoji o texto corto en UI.',
    badgeClass: 'text-violet-300/90',
    columns: [
      {
        id: 'etiqueta',
        label: 'Etiqueta',
        render: (v) => <span className="font-medium text-white/90">{v.etiqueta}</span>,
      },
      {
        id: 'codigo',
        label: 'Código',
        render: (v) => cell(v.valor || v.clave, true),
      },
      {
        id: 'ui',
        label: 'Presentación UI',
        render: (v) => cell(meta(v).display_label || v.etiqueta),
      },
    ],
  },
  priority_level: {
    label: 'Niveles de prioridad',
    purpose: 'Urgencia o importancia (seguridad, compras). La severidad ordena alertas y filtros.',
    badgeClass: 'text-amber-300/90',
    columns: [
      {
        id: 'nivel',
        label: 'Nivel',
        render: (v) => <span className="font-medium text-white/90">{v.etiqueta}</span>,
      },
      {
        id: 'codigo',
        label: 'Código',
        render: (v) => cell(v.valor || v.clave, true),
      },
      {
        id: 'severidad',
        label: 'Severidad',
        render: (v) => {
          const s = meta(v).severidad || 'media';
          const tone = s === 'critica' || s === 'alta' ? 'red' : s === 'media' ? 'amber' : 'zinc';
          return badge(SEVERIDAD_LABEL[s] || s, tone);
        },
      },
    ],
  },
  process_state: {
    label: 'Estados de proceso',
    purpose: 'Ciclo de vida de registros (equipo, seguridad, procesamiento): si es estado final o activo en operación.',
    badgeClass: 'text-sky-300/90',
    columns: [
      {
        id: 'estado',
        label: 'Estado',
        render: (v) => <span className="font-medium text-white/90">{v.etiqueta}</span>,
      },
      {
        id: 'codigo',
        label: 'Código',
        render: (v) => cell(v.valor || v.clave, true),
      },
      {
        id: 'flags',
        label: 'Comportamiento',
        render: (v) => {
          const m = meta(v);
          const parts: string[] = [];
          if (m.es_activo) parts.push('Operativo');
          if (m.es_terminal) parts.push('Final');
          return cell(parts.length ? parts.join(' · ') : '—');
        },
      },
    ],
  },
  inventory_catalog: {
    label: 'Rubros de inventario',
    purpose: 'Clasificación de artículos, destinos o tipos de movimiento en almacén.',
    badgeClass: 'text-emerald-300/90',
    columns: [
      {
        id: 'rubro',
        label: 'Rubro',
        render: (v) => <span className="font-medium text-white/90">{v.etiqueta}</span>,
      },
      {
        id: 'codigo',
        label: 'Código',
        render: (v) => cell(v.valor || v.clave, true),
      },
      {
        id: 'ui',
        label: 'Etiqueta UI',
        render: (v) => cell(meta(v).display_label || '—'),
      },
    ],
  },
  equipment_type: {
    label: 'Tipos de equipo',
    purpose: 'Clasificación de maquinaria en mina; el código agrupa reportes y mantenimiento.',
    badgeClass: 'text-amber-300/90',
    columns: [
      {
        id: 'tipo',
        label: 'Tipo',
        render: (v) => <span className="font-medium text-white/90">{v.etiqueta}</span>,
      },
      {
        id: 'codigo',
        label: 'Código',
        render: (v) => cell(v.valor || v.clave, true),
      },
      {
        id: 'clase',
        label: 'Clase',
        render: (v) => cell(meta(v).clase_equipo || '—'),
      },
    ],
  },
  process_type: {
    label: 'Tipos de registro',
    purpose: 'Clasificación de procesos o hallazgos (planta, seguridad).',
    badgeClass: 'text-violet-300/90',
    columns: [
      {
        id: 'tipo',
        label: 'Tipo',
        render: (v) => <span className="font-medium text-white/90">{v.etiqueta}</span>,
      },
      {
        id: 'codigo',
        label: 'Código',
        render: (v) => cell(v.valor || v.clave, true),
      },
      {
        id: 'desc',
        label: 'Descripción',
        render: (v) => (
          <span className="line-clamp-2 text-xs text-white/45">{v.descripcion || '—'}</span>
        ),
      },
    ],
  },
  generic: {
    label: 'Catálogo general',
    purpose: 'Parámetros reutilizables con etiqueta, valor y unidad. Ajusta el slug de la categoría para un esquema más específico.',
    badgeClass: 'text-white/50',
    columns: [
      {
        id: 'etiqueta',
        label: 'Etiqueta',
        render: (v) => <span className="font-medium text-white/90">{v.etiqueta}</span>,
      },
      {
        id: 'clave',
        label: 'Clave',
        render: (v) => cell(v.clave, true),
      },
      {
        id: 'valor',
        label: 'Valor',
        render: (v) => cell(v.valor || '—'),
      },
      {
        id: 'unidad',
        label: 'Unidad',
        render: (v) => cell(v.unidad || '—'),
      },
      {
        id: 'extra',
        label: 'Detalle',
        render: (v, slug) => cell(formatMetadataResumen(v, slug) || v.descripcion || '—'),
      },
    ],
  },
};

const SLUG_TO_KIND: Record<string, BibliotecaSchemaKind> = {
  cargos: 'labor_role',
  condimentos_voladura: 'explosive_supply',
  esquemas_rotacion: 'rotation_scheme',
  ubicaciones_laborales: 'work_location',
  minas: 'geo_site',
  verticales_voladura: 'geo_site',
  molinos: 'geo_site',
  asignacion_nomina: 'geo_site',
  areas_nomina: 'labeled_option',
  turnos: 'labeled_option',
  clima_guardia: 'labeled_option',
  areas_operativas: 'labeled_option',
  inventario_movimiento: 'labeled_option',
  seguridad_prioridad: 'priority_level',
  compras_prioridad: 'priority_level',
  equipos_estado: 'process_state',
  seguridad_estado: 'process_state',
  procesamiento_estado: 'process_state',
  inventario_categoria: 'inventory_catalog',
  inventario_destino: 'inventory_catalog',
  equipos_tipo: 'equipment_type',
  procesamiento_tipo: 'process_type',
  seguridad_tipo: 'process_type',
};

export function getBibliotecaSchemaKind(slug: string): BibliotecaSchemaKind {
  return SLUG_TO_KIND[slug] ?? 'generic';
}

export function getBibliotecaCategorySchema(slug: string): BibliotecaCategorySchema {
  const kind = getBibliotecaSchemaKind(slug);
  return { kind, ...SCHEMA_BY_KIND[kind] };
}

export function getDefaultMetadataForKind(kind: BibliotecaSchemaKind): BibliotecaVariableMetadata {
  switch (kind) {
    case 'labor_role':
      return { nivel_jerarquico: 'operativo' };
    case 'explosive_supply':
      return { tipo_insumo: 'accesorio' };
    case 'priority_level':
      return { severidad: 'media' };
    default:
      return {};
  }
}
