import {
  DEFAULT_COLUMNAS_VISTA,
  normalizeColumnasVista,
  mergeSandboxColumnasVista,
  type PlantillaColumnaKey,
} from '@/lib/rotacion-plantillas/columnas-vista';
import { getGrupoNominaKey } from '@/lib/personal-master';
import type { Personal } from '@/lib/types';
import type {
  EstatusRotacionPlantilla,
  RotacionCuadrilla,
  RotacionPlantillaSandbox,
  RotacionSemanaColumn,
  RotacionTrabajadorFila,
} from '@/lib/rotacion-plantillas/types';

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `rp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export type SandboxAction =
  | { type: 'SET_META'; payload: Partial<Pick<RotacionPlantillaSandbox, 'nombre' | 'descripcion'>> }
  | { type: 'SET_COLUMNAS_VISTA'; payload: RotacionPlantillaSandbox['columnasVista'] }
  | { type: 'ADD_CUADRILLA'; payload?: { nombre?: string; asignacionKey?: string } }
  | { type: 'REMOVE_CUADRILLA'; payload: { id: string } }
  | { type: 'UPDATE_CUADRILLA'; payload: { id: string; nombre?: string; asignacionKey?: string } }
  | { type: 'SET_CUADRILLA_COLUMNAS'; payload: { id: string; columnasVista: PlantillaColumnaKey[] } }
  | { type: 'REORDER_CUADRILLA'; payload: { id: string; direction: 'up' | 'down' } }
  | { type: 'ADD_SEMANA'; payload: { cuadrillaId: string; nombre?: string; estatusDefault?: EstatusRotacionPlantilla } }
  | { type: 'REMOVE_SEMANA'; payload: { cuadrillaId: string; id: string } }
  | {
      type: 'UPDATE_SEMANA';
      payload: { cuadrillaId: string; id: string; nombre?: string; estatusDefault?: EstatusRotacionPlantilla };
    }
  | { type: 'REORDER_SEMANA'; payload: { cuadrillaId: string; id: string; direction: 'up' | 'down' } }
  | { type: 'ADD_TRABAJADOR'; payload: { cuadrillaId: string; personalId: string } }
  | { type: 'REMOVE_TRABAJADOR'; payload: { cuadrillaId: string; filaId: string } }
  | {
      type: 'SET_CELDA';
      payload: {
        cuadrillaId: string;
        filaId: string;
        semanaId: string;
        estatus: EstatusRotacionPlantilla | null;
      };
    }
  | { type: 'LOAD'; payload: RotacionPlantillaSandbox }
  | { type: 'COPY_MODEL'; payload: RotacionPlantillaSandbox }
  | { type: 'RESET'; payload: { area: string } };

function reindexSemanas(semanas: RotacionSemanaColumn[]): RotacionSemanaColumn[] {
  return semanas.map((s, i) => ({ ...s, orden: i }));
}

function reindexCuadrillas(cuadrillas: RotacionCuadrilla[]): RotacionCuadrilla[] {
  return cuadrillas.map((c, i) => ({ ...c, orden: i }));
}

function defaultSemanaName(orden: number): string {
  return `Semana ${orden + 1}`;
}

function defaultCuadrillaName(orden: number): string {
  return `Cuadrilla ${orden + 1}`;
}

export function cuadrillaPermiteSinSemanas(
  cuadrilla: Pick<RotacionCuadrilla, 'columnasVista'>,
  plantillaFallback?: PlantillaColumnaKey[],
): boolean {
  const columnas = cuadrilla.columnasVista?.length ? cuadrilla.columnasVista : plantillaFallback;
  return normalizeColumnasVista(columnas).includes('bono_transporte');
}

function createDefaultSemana(): RotacionSemanaColumn {
  return {
    id: newId(),
    nombre: 'Semana 1',
    orden: 0,
    estatusDefault: 'trabajada_paga',
  };
}

export function createEmptyCuadrilla(orden = 0, nombre?: string): RotacionCuadrilla {
  return {
    id: newId(),
    nombre: nombre ?? defaultCuadrillaName(orden),
    asignacionKey: '',
    orden,
    semanas: [createDefaultSemana()],
    filas: [],
    columnasVista: [...DEFAULT_COLUMNAS_VISTA],
  };
}

export function createEmptySandbox(area: string): RotacionPlantillaSandbox {
  return {
    nombre: '',
    descripcion: '',
    area,
    cuadrillas: [createEmptyCuadrilla(0, 'General')],
    columnasVista: [...DEFAULT_COLUMNAS_VISTA],
  };
}

/** Compatibilidad con plantillas guardadas antes de cuadrillas */
export function normalizeSandbox(
  raw: Partial<RotacionPlantillaSandbox> & {
    semanas?: RotacionSemanaColumn[];
    filas?: RotacionTrabajadorFila[];
  },
  area = 'mina',
): RotacionPlantillaSandbox {
  if (raw.cuadrillas?.length) {
    const fallbackColumnas = raw.columnasVista?.length ? raw.columnasVista : [...DEFAULT_COLUMNAS_VISTA];
    return {
      nombre: raw.nombre ?? '',
      descripcion: raw.descripcion ?? '',
      area: raw.area ?? area,
      columnasVista: fallbackColumnas,
      cuadrillas: raw.cuadrillas.map((c, i) => ({
        ...c,
        orden: c.orden ?? i,
        semanas: reindexSemanas(c.semanas ?? []),
        filas: c.filas ?? [],
        columnasVista: c.columnasVista?.length ? c.columnasVista : fallbackColumnas,
      })),
    };
  }

  const fallbackColumnas = raw.columnasVista?.length ? raw.columnasVista : [...DEFAULT_COLUMNAS_VISTA];
  return {
    nombre: raw.nombre ?? '',
    descripcion: raw.descripcion ?? '',
    area: raw.area ?? area,
    columnasVista: fallbackColumnas,
    cuadrillas: [
      {
        id: newId(),
        nombre: 'General',
        asignacionKey: '',
        orden: 0,
        semanas: reindexSemanas(raw.semanas?.length ? raw.semanas : [createDefaultSemana()]),
        filas: raw.filas ?? [],
        columnasVista: fallbackColumnas,
      },
    ],
  };
}

function mapCuadrilla(
  cuadrillas: RotacionCuadrilla[],
  cuadrillaId: string,
  fn: (c: RotacionCuadrilla) => RotacionCuadrilla,
): RotacionCuadrilla[] {
  return cuadrillas.map((c) => (c.id === cuadrillaId ? fn(c) : c));
}

function semanas14x14(): RotacionSemanaColumn[] {
  return [
    { id: newId(), nombre: 'Libre pagada', orden: 0, estatusDefault: 'libre_paga' },
    { id: newId(), nombre: 'Libre sin pago', orden: 1, estatusDefault: 'libre_sin_pago' },
    { id: newId(), nombre: 'Trabajo 1', orden: 2, estatusDefault: 'trabajada_paga' },
    { id: newId(), nombre: 'Trabajo 2', orden: 3, estatusDefault: 'trabajada_paga' },
  ];
}

function semanas2x1(): RotacionSemanaColumn[] {
  return [
    { id: newId(), nombre: 'Semana libre', orden: 0, estatusDefault: 'libre_paga' },
    { id: newId(), nombre: 'Trabajo 1', orden: 1, estatusDefault: 'trabajada_paga' },
    { id: newId(), nombre: 'Trabajo 2', orden: 2, estatusDefault: 'trabajada_paga' },
  ];
}

function semanasMolino2x2(): RotacionSemanaColumn[] {
  return [
    { id: newId(), nombre: 'Trabajo 1', orden: 0, estatusDefault: 'trabajada_paga' },
    { id: newId(), nombre: 'Trabajo 2', orden: 1, estatusDefault: 'trabajada_paga' },
    { id: newId(), nombre: 'Libre pagada', orden: 2, estatusDefault: 'libre_paga' },
    { id: newId(), nombre: 'Libre sin pago', orden: 3, estatusDefault: 'libre_sin_pago' },
  ];
}

/** Estilo Excel: bono transporte en semana propia, sueldo en otra. */
function semanasMolinoBonoSueldo(): RotacionSemanaColumn[] {
  return [
    { id: newId(), nombre: 'Bono transporte', orden: 0, estatusDefault: 'bono_transporte_paga' },
    { id: newId(), nombre: 'Semana trabajada', orden: 1, estatusDefault: 'trabajada_paga' },
  ];
}

function semanasFijoContinuo(): RotacionSemanaColumn[] {
  return [{ id: newId(), nombre: 'Semana continua', orden: 0, estatusDefault: 'trabajada_paga' }];
}

function cuadrilla(nombre: string, asignacionKey: string, semanas: RotacionSemanaColumn[], orden: number): RotacionCuadrilla {
  return { id: newId(), nombre, asignacionKey, orden, semanas, filas: [] };
}

export function sandboxReducer(
  state: RotacionPlantillaSandbox,
  action: SandboxAction,
): RotacionPlantillaSandbox {
  switch (action.type) {
    case 'SET_META':
      return { ...state, ...action.payload };

    case 'SET_COLUMNAS_VISTA':
      return { ...state, columnasVista: action.payload ?? [...DEFAULT_COLUMNAS_VISTA] };

    case 'ADD_CUADRILLA': {
      const orden = state.cuadrillas.length;
      const nueva = createEmptyCuadrilla(
        orden,
        action.payload?.nombre ?? defaultCuadrillaName(orden),
      );
      if (action.payload?.asignacionKey) nueva.asignacionKey = action.payload.asignacionKey;
      return { ...state, cuadrillas: [...state.cuadrillas, nueva] };
    }

    case 'REMOVE_CUADRILLA': {
      if (state.cuadrillas.length <= 1) return state;
      return { ...state, cuadrillas: reindexCuadrillas(state.cuadrillas.filter((c) => c.id !== action.payload.id)) };
    }

    case 'UPDATE_CUADRILLA':
      return {
        ...state,
        cuadrillas: mapCuadrilla(state.cuadrillas, action.payload.id, (c) => ({
          ...c,
          nombre: action.payload.nombre ?? c.nombre,
          asignacionKey: action.payload.asignacionKey ?? c.asignacionKey,
        })),
      };

    case 'SET_CUADRILLA_COLUMNAS': {
      const cuadrillas = mapCuadrilla(state.cuadrillas, action.payload.id, (c) => ({
        ...c,
        columnasVista: action.payload.columnasVista,
      }));
      return {
        ...state,
        cuadrillas,
        columnasVista: mergeSandboxColumnasVista(cuadrillas, state.columnasVista),
      };
    }

    case 'REORDER_CUADRILLA': {
      const idx = state.cuadrillas.findIndex((c) => c.id === action.payload.id);
      if (idx < 0) return state;
      const target = action.payload.direction === 'up' ? idx - 1 : idx + 1;
      if (target < 0 || target >= state.cuadrillas.length) return state;
      const copy = [...state.cuadrillas];
      [copy[idx], copy[target]] = [copy[target], copy[idx]];
      return { ...state, cuadrillas: reindexCuadrillas(copy) };
    }

    case 'ADD_SEMANA':
      return {
        ...state,
        cuadrillas: mapCuadrilla(state.cuadrillas, action.payload.cuadrillaId, (c) => {
          const orden = c.semanas.length;
          const nueva: RotacionSemanaColumn = {
            id: newId(),
            nombre: action.payload.nombre ?? defaultSemanaName(orden),
            orden,
            estatusDefault: action.payload.estatusDefault ?? 'trabajada_paga',
          };
          return { ...c, semanas: [...c.semanas, nueva] };
        }),
      };

    case 'REMOVE_SEMANA':
      return {
        ...state,
        cuadrillas: mapCuadrilla(state.cuadrillas, action.payload.cuadrillaId, (c) => {
          if (c.semanas.length <= 1 && !cuadrillaPermiteSinSemanas(c, state.columnasVista)) return c;
          const semanas = reindexSemanas(c.semanas.filter((s) => s.id !== action.payload.id));
          const filas = c.filas.map((f) => {
            const celdas = { ...f.celdas };
            delete celdas[action.payload.id];
            return { ...f, celdas };
          });
          return { ...c, semanas, filas };
        }),
      };

    case 'UPDATE_SEMANA':
      return {
        ...state,
        cuadrillas: mapCuadrilla(state.cuadrillas, action.payload.cuadrillaId, (c) => ({
          ...c,
          semanas: c.semanas.map((s) =>
            s.id === action.payload.id
              ? {
                  ...s,
                  nombre: action.payload.nombre ?? s.nombre,
                  estatusDefault: action.payload.estatusDefault ?? s.estatusDefault,
                }
              : s,
          ),
        })),
      };

    case 'REORDER_SEMANA':
      return {
        ...state,
        cuadrillas: mapCuadrilla(state.cuadrillas, action.payload.cuadrillaId, (c) => {
          const idx = c.semanas.findIndex((s) => s.id === action.payload.id);
          if (idx < 0) return c;
          const target = action.payload.direction === 'up' ? idx - 1 : idx + 1;
          if (target < 0 || target >= c.semanas.length) return c;
          const copy = [...c.semanas];
          [copy[idx], copy[target]] = [copy[target], copy[idx]];
          return { ...c, semanas: reindexSemanas(copy) };
        }),
      };

    case 'ADD_TRABAJADOR':
      return {
        ...state,
        cuadrillas: mapCuadrilla(state.cuadrillas, action.payload.cuadrillaId, (c) => {
          const yaEnCuadrilla = c.filas.some((f) => f.personalId === action.payload.personalId);
          const yaEnOtra = state.cuadrillas.some(
            (x) => x.id !== c.id && x.filas.some((f) => f.personalId === action.payload.personalId),
          );
          if (yaEnCuadrilla || yaEnOtra) return c;
          const fila: RotacionTrabajadorFila = {
            id: newId(),
            personalId: action.payload.personalId,
            celdas: {},
          };
          return { ...c, filas: [...c.filas, fila] };
        }),
      };

    case 'REMOVE_TRABAJADOR':
      return {
        ...state,
        cuadrillas: mapCuadrilla(state.cuadrillas, action.payload.cuadrillaId, (c) => ({
          ...c,
          filas: c.filas.filter((f) => f.id !== action.payload.filaId),
        })),
      };

    case 'SET_CELDA':
      return {
        ...state,
        cuadrillas: mapCuadrilla(state.cuadrillas, action.payload.cuadrillaId, (c) => ({
          ...c,
          filas: c.filas.map((f) =>
            f.id === action.payload.filaId
              ? {
                  ...f,
                  celdas: {
                    ...f.celdas,
                    [action.payload.semanaId]: action.payload.estatus,
                  },
                }
              : f,
          ),
        })),
      };

    case 'LOAD':
      return normalizeSandbox(action.payload, state.area);

    case 'COPY_MODEL':
      return copyModelStructure(state, normalizeSandbox(action.payload, state.area));

    case 'RESET':
      return createEmptySandbox(action.payload.area);

    default:
      return state;
  }
}

export function resolveCeldaEstatus(
  fila: RotacionTrabajadorFila,
  semana: RotacionSemanaColumn,
): EstatusRotacionPlantilla {
  const override = fila.celdas[semana.id];
  return override ?? semana.estatusDefault;
}

export function validateSandbox(state: RotacionPlantillaSandbox): string | null {
  if (!state.nombre.trim()) return 'El nombre de la plantilla es obligatorio.';
  if (!state.cuadrillas.length) return 'Agregue al menos una cuadrilla.';
  for (const c of state.cuadrillas) {
    if (!c.nombre.trim()) return 'Todas las cuadrillas deben tener nombre.';
    if (!c.semanas.length && !cuadrillaPermiteSinSemanas(c, state.columnasVista)) {
      return `La cuadrilla "${c.nombre}" necesita al menos una semana o la columna Bono transporte.`;
    }
    if (c.semanas.some((s) => !s.nombre.trim())) {
      return `Todas las semanas de "${c.nombre}" deben tener nombre.`;
    }
  }
  return null;
}

export function normalizeAsignacionKey(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim();
}

/** Puntaje de coincidencia (mayor = más específico). 0 = no coincide. */
export function cuadrillaMatchScore(
  asignacion: string,
  cuadrilla: Pick<RotacionCuadrilla, 'nombre' | 'asignacionKey'>,
): number {
  const grupo = normalizeAsignacionKey(asignacion);
  const targets = [cuadrilla.asignacionKey, cuadrilla.nombre].filter(Boolean).map(normalizeAsignacionKey);
  if (!targets.length) return asignacion ? 0 : 1;
  if (!grupo) return 0;

  let best = 0;
  for (const t of targets) {
    if (t === grupo) {
      best = Math.max(best, 1000 + t.length);
      continue;
    }
    if (t.startsWith(grupo) && (t.length === grupo.length || t[grupo.length] === ' ')) {
      best = Math.max(best, 500 + grupo.length);
      continue;
    }
    if (grupo.startsWith(t) && (grupo.length === t.length || grupo[t.length] === ' ')) {
      best = Math.max(best, 500 + t.length);
    }
  }
  return best;
}

/** ¿La asignación nómina corresponde a esta cuadrilla? (exacta o prefijo por segmento) */
export function asignacionMatchesCuadrilla(
  asignacion: string,
  cuadrilla: Pick<RotacionCuadrilla, 'nombre' | 'asignacionKey'>,
): boolean {
  return cuadrillaMatchScore(asignacion, cuadrilla) > 0;
}

export function personalMatchesCuadrilla(
  p: Personal,
  cuadrilla: Pick<RotacionCuadrilla, 'nombre' | 'asignacionKey'>,
): boolean {
  return asignacionMatchesCuadrilla(getGrupoNominaKey(p), cuadrilla);
}

export function allPersonalIdsInSandbox(state: RotacionPlantillaSandbox): Set<string> {
  const ids = new Set<string>();
  state.cuadrillas.forEach((c) => c.filas.forEach((f) => ids.add(f.personalId)));
  return ids;
}

export type PresetPlantillaTipo = 'mina_14x14' | 'mina_2x1' | 'molino_2x2' | 'molino_mixto' | 'admin_fijo';

export const PRESET_PLANTILLA_OPCIONES: ReadonlyArray<{ key: PresetPlantillaTipo; label: string }> = [
  { key: 'mina_14x14', label: 'Mina 14×14 — Completo' },
  { key: 'mina_2x1', label: 'Mina 2×1 — Completo' },
  { key: 'molino_2x2', label: 'Molino 2×2 — Completo' },
  { key: 'molino_mixto', label: 'Molino mixto — Bono + Sueldo' },
  { key: 'admin_fijo', label: 'Administrativo semanal' },
];

/** Copia estructura (cuadrillas, semanas, columnas) sin tocar nombre, descripción ni personal. */
export function copyModelStructure(
  current: RotacionPlantillaSandbox,
  source: RotacionPlantillaSandbox,
): RotacionPlantillaSandbox {
  const cuadrillas = source.cuadrillas.map((c, i) => ({
    id: newId(),
    nombre: c.nombre,
    asignacionKey: c.asignacionKey,
    orden: i,
    filas: [],
    semanas: c.semanas.map((s, j) => ({
      id: newId(),
      nombre: s.nombre,
      orden: j,
      estatusDefault: s.estatusDefault,
    })),
  }));

  return {
    ...current,
    cuadrillas,
    columnasVista: source.columnasVista?.length ? [...source.columnasVista] : current.columnasVista,
  };
}

/** Presets con cuadrillas operativas (verticales, cocina, admin, técnicos…) */
export function presetPlantilla(tipo: PresetPlantillaTipo, area: string): RotacionPlantillaSandbox {
  const base = createEmptySandbox(area);

  if (tipo === 'mina_14x14') {
    base.nombre = 'Mina 14×14 — Completo';
    base.descripcion = 'Rotación mina con verticales, cocina, administración y técnicos.';
    base.cuadrillas = [
      cuadrilla('Vertical 1', 'Vertical 1', semanas14x14(), 0),
      cuadrilla('Vertical 2', 'Vertical 2', semanas14x14(), 1),
      cuadrilla('Vertical 3', 'Vertical 3', semanas14x14(), 2),
      cuadrilla('Cocina', 'Cocina', semanasFijoContinuo(), 3),
      cuadrilla('Administración', 'Administración', semanasFijoContinuo(), 4),
      cuadrilla('Técnicos', 'Técnicos', semanas2x1(), 5),
    ];
  } else if (tipo === 'mina_2x1') {
    base.nombre = 'Mina 2×1 — Completo';
    base.cuadrillas = [
      cuadrilla('Vertical 1', 'Vertical 1', semanas2x1(), 0),
      cuadrilla('Vertical 2', 'Vertical 2', semanas2x1(), 1),
      cuadrilla('Cocina', 'Cocina', semanasFijoContinuo(), 2),
      cuadrilla('Administración', 'Administración', semanasFijoContinuo(), 3),
    ];
  } else if (tipo === 'molino_2x2') {
    base.nombre = 'Molino 2×2 — Completo';
    base.cuadrillas = [
      cuadrilla('Grupo Molino', 'Molino', semanasMolino2x2(), 0),
      cuadrilla('Cocina', 'Cocina', semanasFijoContinuo(), 1),
      cuadrilla('Administración', 'Administración', semanasFijoContinuo(), 2),
    ];
  } else if (tipo === 'molino_mixto') {
    base.nombre = 'Molino mixto — Bono + Sueldo';
    base.descripcion =
      'Como Excel: semana de bono transporte y semana trabajada en columnas separadas (totales se suman al cerrar el periodo).';
    base.cuadrillas = [
      cuadrilla('Grupo Molino', 'Molino', semanasMolinoBonoSueldo(), 0),
      cuadrilla('Cocina', 'Cocina', semanasFijoContinuo(), 1),
      cuadrilla('Administración', 'Administración', semanasFijoContinuo(), 2),
    ];
  } else {
    base.nombre = 'Administrativo semanal';
    base.cuadrillas = [cuadrilla('Administración', 'Administración', semanasFijoContinuo(), 0)];
  }

  return base;
}
