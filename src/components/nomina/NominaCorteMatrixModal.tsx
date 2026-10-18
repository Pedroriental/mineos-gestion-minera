'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Loader2,
  Plus,
  Trash2,
  Truck,
  Wallet,
  ArrowLeftRight,
  ClipboardPaste,
  Camera,
  ChevronLeft,
  ChevronRight,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageFormModal, PageFormModalFooter } from '@/components/ui/PageFormModal';
import { AppSelect } from '@/components/ui/AppSelect';
import { AppDatePicker } from '@/components/ui/AppDatePicker';
import {
  MINEOS_BTN_NOMINA_PRIMARY,
  mineosBtnSubtleClass,
  mineosKpiValue,
  mineosPanel,
} from '@/lib/mineos-visual';
import {
  applyDiasGuardiaToFilaCorte,
  buildColumnasCorte,
  buildFilaCorteTrabajador,
  DEFAULT_BONO_TRANSPORTE_MOLINO,
  isWorkerNewForCut,
  recomputeFilaCorteTotals,
  type CeldaCorteSemana,
  type ColumnaCorteDef,
  type FilaCorteTrabajador,
  type ModoCortePreset,
} from '@/lib/nomina/corte-grupo-engine';
import { consolidarPeriodoClient } from '@/lib/nomina/consolidar-client';
import { resolveCuadrillaForPersonal } from '@/lib/rotacion-plantillas/manual-plantilla-projection';
import type { RotacionPlantillaRecord } from '@/lib/rotacion-plantillas/types';
import type { NominaSemana, Personal } from '@/lib/types';
import type { SupervisorListAppliedItem } from './NominaSupervisorListModal';
import { cn } from '@/lib/utils';

type DistribucionParte = {
  id: string;
  nombre: string;
  porcentaje: number;
  pagoDirecto?: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  area: 'mina' | 'planta' | 'administracion' | 'seguridad' | 'transporte';
  anchorWeekStart: string;
  catalog: Personal[];
  currentWeekWorkers: Personal[];
  semanasCerradas: NominaSemana[];
  plantillas: RotacionPlantillaRecord[];
  defaultPlantillaId?: string;
  valesByPersonalId: Record<string, number>;
  distribucionPartes: DistribucionParte[];
  importedSupervisorItems?: SupervisorListAppliedItem[] | null;
  onConsumeSupervisorItems?: () => void;
  onOpenSupervisorPaste: () => void;
  onCorteCerrado: () => void;
};

function fmtShortDate(iso: string): string {
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}`;
}

/**
 * Resuelve los trabajadores de cada cuadrilla de una plantilla combinando:
 * 1. Filas explícitas (`c.filas`)
 * 2. Emparejamiento por vertical/sector/cargo (`resolveCuadrillaForPersonal`) usado en MineOS
 */
function resolveWorkersByCuadrillaForPlantilla(
  plantilla: RotacionPlantillaRecord,
  catalog: Personal[],
  area: string,
): Record<string, Personal[]> {
  const byCuad: Record<string, Personal[]> = {};
  const seenInCuad: Record<string, Set<string>> = {};
  const allCuadIds = plantilla.cuadrillas.map((c) => c.id);

  for (const c of plantilla.cuadrillas) {
    byCuad[c.id] = [];
    seenInCuad[c.id] = new Set();
  }

  // 1. Filas explícitas guardadas en la cuadrilla
  const catalogById = new Map(catalog.map((p) => [p.id, p]));
  for (const c of plantilla.cuadrillas) {
    for (const f of c.filas) {
      const p = catalogById.get(f.personalId);
      if (p && !seenInCuad[c.id].has(p.id)) {
        seenInCuad[c.id].add(p.id);
        byCuad[c.id].push(p);
      }
    }
  }

  // 2. Trabajadores activos del área que coinciden con la cuadrilla por asignación/vertical/cargo
  const areaCatalog = catalog.filter(
    (p) => p.estatus === 'ACTIVO' && (p.area === area || !p.area),
  );
  for (const p of areaCatalog) {
    const alreadyInAnyFila = plantilla.cuadrillas.some((c) => seenInCuad[c.id].has(p.id));
    if (alreadyInAnyFila) continue;
    const matchedCuad = resolveCuadrillaForPersonal(plantilla, p, allCuadIds);
    if (matchedCuad && byCuad[matchedCuad.id] && !seenInCuad[matchedCuad.id].has(p.id)) {
      seenInCuad[matchedCuad.id].add(p.id);
      byCuad[matchedCuad.id].push(p);
    }
  }

  return byCuad;
}

export function NominaCorteMatrixModal({
  open,
  onClose,
  area,
  anchorWeekStart,
  catalog,
  currentWeekWorkers,
  semanasCerradas,
  plantillas,
  defaultPlantillaId,
  valesByPersonalId,
  distribucionPartes,
  importedSupervisorItems,
  onConsumeSupervisorItems,
  onOpenSupervisorPaste,
  onCorteCerrado,
}: Props) {
  const defaultPreset: ModoCortePreset =
    area === 'planta' ? 'molino_regreso_3sem' : 'mina_corte_3sem';

  const [preset, setPreset] = useState<ModoCortePreset>(defaultPreset);
  const [anchorWeek, setAnchorWeek] = useState<string>(anchorWeekStart);

  // Seleccionar por defecto la plantilla activa del periodo o la primera disponible
  const initialPlantillaId = useMemo(() => {
    if (defaultPlantillaId && plantillas.some((p) => p.id === defaultPlantillaId)) {
      return defaultPlantillaId;
    }
    const varianteIng = plantillas.find((p) =>
      p.nombre.toLowerCase().includes('ingeniero'),
    );
    return varianteIng?.id ?? plantillas[0]?.id ?? '__none__';
  }, [defaultPlantillaId, plantillas]);

  const [selectedPlantillaId, setSelectedPlantillaId] = useState<string>(initialPlantillaId);
  const [selectedCuadrillaId, setSelectedCuadrillaId] = useState<string>('__manual__');
  const [corteLabel, setCorteLabel] = useState<string>('');
  const [filas, setFilas] = useState<FilaCorteTrabajador[]>([]);
  const [veteranIds, setVeteranIds] = useState<Set<string>>(new Set());
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isClosingCorte, setIsClosingCorte] = useState(false);
  const [addWorkerId, setAddWorkerId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [relevoSourceId, setRelevoSourceId] = useState<string | null>(null);
  const [relevoTargetId, setRelevoTargetId] = useState<string>('');
  const [relevoWeekStart, setRelevoWeekStart] = useState<string>('');
  const [relevoDiasA, setRelevoDiasA] = useState<number>(3);

  const tableScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open) {
      setAnchorWeek(anchorWeekStart);
      setPreset(area === 'planta' ? 'molino_regreso_3sem' : 'mina_corte_3sem');
      if (
        selectedPlantillaId === '__none__' &&
        plantillas.length > 0 &&
        !importedSupervisorItems?.length
      ) {
        setSelectedPlantillaId(initialPlantillaId);
      }
    }
  }, [open, anchorWeekStart, area, initialPlantillaId, plantillas.length]);

  const columnas: ColumnaCorteDef[] = useMemo(
    () => buildColumnasCorte(preset, anchorWeek, undefined, area),
    [preset, anchorWeek, area],
  );

  // Cargar historial de semanas cerradas anteriores para saber automáticamente quién es antiguo vs nuevo
  useEffect(() => {
    if (!open || columnas.length === 0) return;
    let cancelled = false;
    const firstWorkedCol =
      columnas.find((c) => c.tipo === 'trabajada_1' || c.tipo === 'trabajada_2') ?? columnas[0];
    const cutoffDate = firstWorkedCol.weekStart;

    const priorSemanas = semanasCerradas
      .filter((s) => (s.area || area) === area && s.semana_inicio < cutoffDate && s.id)
      .slice(0, 6);

    if (priorSemanas.length === 0) {
      setVeteranIds(new Set());
      return;
    }

    setLoadingHistory(true);
    Promise.all(
      priorSemanas.map(async (s) => {
        try {
          const r = await fetch(`/api/nomina/semana-registros?semanaId=${encodeURIComponent(s.id)}`);
          if (!r.ok) return { ok: false, data: [] };
          return await r.json();
        } catch {
          return { ok: false, data: [] };
        }
      }),
    )
      .then((results) => {
        if (cancelled) return;
        const ids = new Set<string>();
        for (const res of results) {
          if (res?.ok && Array.isArray(res.data)) {
            for (const reg of res.data as Array<{ personal_id: string; monto_pagado?: number }>) {
              if (reg.personal_id && Number(reg.monto_pagado ?? 0) > 0) {
                ids.add(reg.personal_id);
              }
            }
          }
        }
        setVeteranIds(ids);
      })
      .catch(() => {
        if (!cancelled) setVeteranIds(new Set());
      })
      .finally(() => {
        if (!cancelled) setLoadingHistory(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, columnas, semanasCerradas, area]);

  const activePlantilla = useMemo(
    () =>
      selectedPlantillaId === '__none__'
        ? null
        : plantillas.find((p) => p.id === selectedPlantillaId) ?? null,
    [plantillas, selectedPlantillaId],
  );

  const workersByCuadrilla = useMemo(() => {
    if (!activePlantilla) return {};
    return resolveWorkersByCuadrillaForPlantilla(activePlantilla, catalog, area);
  }, [activePlantilla, catalog, area]);

  const allPlantillaWorkers = useMemo(() => {
    if (!activePlantilla) return [];
    const seen = new Set<string>();
    const list: Personal[] = [];
    for (const c of activePlantilla.cuadrillas) {
      for (const w of workersByCuadrilla[c.id] ?? []) {
        if (!seen.has(w.id)) {
          seen.add(w.id);
          list.push(w);
        }
      }
    }
    return list;
  }, [activePlantilla, workersByCuadrilla]);

  // Si vienen trabajadores importados desde Foto / Lista del Supervisor, aplicarlos directamente al corte
  useEffect(() => {
    if (!open || !importedSupervisorItems || importedSupervisorItems.length === 0) return;

    setSelectedPlantillaId('__none__');
    setSelectedCuadrillaId('__supervisor__');

    const builtRows: FilaCorteTrabajador[] = importedSupervisorItems
      .filter((i) => !i.esDespidoExplicito)
      .map((item) => {
        const effectiveSal = item.salarioOverride ?? Number(item.personal.salario_base) ?? 0;
        const workerForRow: Personal = {
          ...item.personal,
          salario_base: effectiveSal,
          salario_libre: effectiveSal,
        };
        const esNuevo =
          item.cobraSemanaLibre !== undefined
            ? !item.cobraSemanaLibre
            : item.esNuevoExplicito;

        let fila = buildFilaCorteTrabajador({
          personal: workerForRow,
          columnas,
          area,
          esNuevoEnCiclo: esNuevo,
          valesTotal: valesByPersonalId[workerForRow.id] ?? 0,
          cuadrillaNombre: item.frenteReportado || workerForRow.area_detalle || 'Lista Supervisor',
        });

        const totalGuardia =
          item.diasGuardiaTotal !== undefined
            ? item.diasGuardiaTotal
            : item.diasTrabajados === 7
              ? 14
              : item.diasTrabajados;

        fila = applyDiasGuardiaToFilaCorte(fila, totalGuardia, columnas);

        if (item.pagoExtra > 0 && columnas.length > 0) {
          const lastCol = columnas[columnas.length - 1];
          const lastCell = fila.semanas[lastCol.weekStart];
          if (lastCell) {
            fila = recomputeFilaCorteTotals({
              ...fila,
              semanas: {
                ...fila.semanas,
                [lastCol.weekStart]: {
                  ...lastCell,
                  pagoExtra: item.pagoExtra,
                  motivoExtra: item.motivoExtra || 'Incentivo / Extra supervisor',
                },
              },
            });
          }
        }
        return fila;
      });

    setFilas(builtRows);
    if (columnas.length > 0) {
      const rangeStart = columnas[0].weekStart;
      const rangeEnd = columnas[columnas.length - 1].weekEnd;
      setCorteLabel(
        `${area === 'planta' ? 'Molino' : 'Mina'} · Reporte Supervisor (${fmtShortDate(rangeStart)} al ${fmtShortDate(rangeEnd)})`,
      );
    }
    onConsumeSupervisorItems?.();
  }, [
    open,
    importedSupervisorItems,
    columnas,
    area,
    valesByPersonalId,
    onConsumeSupervisorItems,
  ]);

  // Inicializar o reconstruir las filas cuando cambia la plantilla/cuadrilla o las columnas
  useEffect(() => {
    if (!open) return;
    if (selectedCuadrillaId === '__supervisor__' || selectedCuadrillaId === '__manual__') {
      // Mantiene los trabajadores cargados por foto/lista de supervisor pero adapta columnas si cambian fechas
      setFilas((prev) =>
        prev.map((f) =>
          buildFilaCorteTrabajador({
            personal: f.personal,
            columnas,
            area,
            esNuevoEnCiclo: f.esNuevoEnCiclo,
            valesTotal: f.valesTotal,
            cuadrillaNombre: f.cuadrillaNombre,
            existingCells: f.semanas,
          }),
        ),
      );
      return;
    }

    let baseWorkers: Personal[] = [];
    let cuadrillaLabel = 'Grupo Actual';

    if (!activePlantilla || selectedCuadrillaId === '__current__') {
      baseWorkers = currentWeekWorkers;
      cuadrillaLabel = 'Lista en Pantalla';
    } else if (selectedCuadrillaId === '__all_plantilla__') {
      baseWorkers = allPlantillaWorkers;
      cuadrillaLabel = activePlantilla.nombre;
    } else {
      const cuad = activePlantilla.cuadrillas.find((c) => c.id === selectedCuadrillaId);
      if (cuad) {
        cuadrillaLabel = `${activePlantilla.nombre} · ${cuad.nombre}`;
        baseWorkers = workersByCuadrilla[cuad.id] ?? [];
      }
    }

    const firstWorkedCol =
      columnas.find((c) => c.tipo === 'trabajada_1' || c.tipo === 'trabajada_2') ?? columnas[0];

    setFilas((prev) => {
      const prevById = new Map(prev.map((f) => [f.personal.id, f]));
      return baseWorkers.map((p) => {
        const existing = prevById.get(p.id);
        const esNuevo =
          existing?.esNuevoEnCiclo !== undefined
            ? existing.esNuevoEnCiclo
            : isWorkerNewForCut(p, firstWorkedCol.weekStart, veteranIds);

        const workerCuad =
          activePlantilla && selectedCuadrillaId === '__all_plantilla__'
            ? activePlantilla.cuadrillas.find((c) =>
                (workersByCuadrilla[c.id] ?? []).some((w) => w.id === p.id),
              )?.nombre ?? cuadrillaLabel
            : cuadrillaLabel;

        return buildFilaCorteTrabajador({
          personal: existing?.personal ?? p,
          columnas,
          area,
          esNuevoEnCiclo: esNuevo,
          valesTotal: valesByPersonalId[p.id] ?? 0,
          cuadrillaNombre: workerCuad,
          existingCells: existing?.semanas,
        });
      });
    });

    if (columnas.length > 0) {
      const rangeStart = columnas[0].weekStart;
      const rangeEnd = columnas[columnas.length - 1].weekEnd;
      setCorteLabel(
        `${area === 'planta' ? 'Molino' : 'Mina'} · ${cuadrillaLabel} (${fmtShortDate(rangeStart)} al ${fmtShortDate(rangeEnd)})`,
      );
    }
  }, [
    open,
    selectedPlantillaId,
    selectedCuadrillaId,
    activePlantilla,
    allPlantillaWorkers,
    workersByCuadrilla,
    columnas,
    veteranIds,
    currentWeekWorkers,
    catalog,
    area,
    valesByPersonalId,
  ]);

  function updateCelda(
    personalId: string,
    weekStart: string,
    patch: Partial<CeldaCorteSemana>,
  ) {
    setFilas((prev) =>
      prev.map((f) => {
        if (f.personal.id !== personalId) return f;
        const currentCell = f.semanas[weekStart];
        if (!currentCell) return f;
        const nextCell: CeldaCorteSemana = {
          ...currentCell,
          ...patch,
        };
        if (patch.estadoAsistencia === 'libre' || patch.estadoAsistencia === 'no_laborado') {
          nextCell.diasTrabajados = 0;
        } else if (
          patch.estadoAsistencia === 'trabajada' &&
          currentCell.diasTrabajados === 0 &&
          patch.diasTrabajados === undefined
        ) {
          nextCell.diasTrabajados = 7;
        }
        return recomputeFilaCorteTotals({
          ...f,
          semanas: {
            ...f.semanas,
            [weekStart]: nextCell,
          },
        });
      }),
    );
  }

  function updateDiasGuardiaTotal(personalId: string, diasGuardia: number) {
    setFilas((prev) =>
      prev.map((f) => {
        if (f.personal.id !== personalId) return f;
        return applyDiasGuardiaToFilaCorte(f, diasGuardia, columnas);
      }),
    );
  }

  function toggleNuevoEnCiclo(personalId: string) {
    setFilas((prev) =>
      prev.map((f) => {
        if (f.personal.id !== personalId) return f;
        const nextNuevo = !f.esNuevoEnCiclo;
        const nextSemanas = { ...f.semanas };
        for (const col of columnas) {
          if (col.tipo === 'libre_pagada' && nextSemanas[col.weekStart]) {
            nextSemanas[col.weekStart] = {
              ...nextSemanas[col.weekStart],
              estadoAsistencia: nextNuevo ? 'no_laborado' : 'libre',
              diasTrabajados: 0,
              bloqueadaPorNuevoIngreso: nextNuevo,
            };
          }
        }
        return recomputeFilaCorteTotals({
          ...f,
          esNuevoEnCiclo: nextNuevo,
          semanas: nextSemanas,
        });
      }),
    );
  }

  function updateSalarioFila(personalId: string, nuevoSalario: number) {
    setFilas((prev) =>
      prev.map((f) => {
        if (f.personal.id !== personalId) return f;
        const nextSemanas: Record<string, CeldaCorteSemana> = {};
        for (const [ws, cell] of Object.entries(f.semanas)) {
          nextSemanas[ws] = {
            ...cell,
            salarioBaseSemana: nuevoSalario,
            salarioLibreSemana: nuevoSalario,
          };
        }
        return recomputeFilaCorteTotals({
          ...f,
          personal: {
            ...f.personal,
            salario_base: nuevoSalario,
            salario_libre: nuevoSalario,
          },
          semanas: nextSemanas,
        });
      }),
    );
  }

  function handleAddWorker() {
    if (!addWorkerId) return;
    if (filas.some((f) => f.personal.id === addWorkerId)) {
      toast.info('Ese trabajador ya está en el corte.');
      return;
    }
    const p = catalog.find((w) => w.id === addWorkerId);
    if (!p) return;
    const firstWorkedCol =
      columnas.find((c) => c.tipo === 'trabajada_1' || c.tipo === 'trabajada_2') ?? columnas[0];
    const esNuevo = isWorkerNewForCut(p, firstWorkedCol.weekStart, veteranIds);
    const nuevaFila = buildFilaCorteTrabajador({
      personal: p,
      columnas,
      area,
      esNuevoEnCiclo: esNuevo,
      valesTotal: valesByPersonalId[p.id] ?? 0,
    });
    setFilas((prev) => [...prev, nuevaFila]);
    setAddWorkerId('');
    toast.success(`${p.nombre_completo} agregado al corte.`);
  }

  function handleApplyRelevo() {
    if (!relevoSourceId || !relevoTargetId || !relevoWeekStart) return;
    const targetWorker = catalog.find((w) => w.id === relevoTargetId);
    if (!targetWorker) return;

    const diasA = Math.max(0, Math.min(7, relevoDiasA));
    const diasB = Math.max(0, 7 - diasA);

    setFilas((prev) => {
      const sourceRow = prev.find((f) => f.personal.id === relevoSourceId);
      const updated = prev.map((f) => {
        if (f.personal.id !== relevoSourceId) return f;
        const cell = f.semanas[relevoWeekStart];
        if (!cell) return f;
        return recomputeFilaCorteTotals({
          ...f,
          relevoNota: `Relevado por ${targetWorker.nombre_completo} (${diasA}d / ${diasB}d)`,
          semanas: {
            ...f.semanas,
            [relevoWeekStart]: {
              ...cell,
              estadoAsistencia: diasA > 0 ? 'trabajada' : 'no_laborado',
              diasTrabajados: diasA,
            },
          },
        });
      });

      const alreadyInList = updated.some((f) => f.personal.id === relevoTargetId);
      if (alreadyInList) {
        return updated.map((f) => {
          if (f.personal.id !== relevoTargetId) return f;
          const cell = f.semanas[relevoWeekStart];
          if (!cell) return f;
          return recomputeFilaCorteTotals({
            ...f,
            relevoNota: `Relevo de ${sourceRow?.personal.nombre_completo ?? 'compañero'} (${diasB}d)`,
            semanas: {
              ...f.semanas,
              [relevoWeekStart]: {
                ...cell,
                estadoAsistencia: diasB > 0 ? 'trabajada' : 'no_laborado',
                diasTrabajados: diasB,
              },
            },
          });
        });
      }

      const emptyCells: Record<string, Partial<CeldaCorteSemana>> = {};
      for (const col of columnas) {
        emptyCells[col.weekStart] =
          col.weekStart === relevoWeekStart
            ? { estadoAsistencia: diasB > 0 ? 'trabajada' : 'no_laborado', diasTrabajados: diasB }
            : { estadoAsistencia: 'no_laborado', diasTrabajados: 0, bonoTransporte: 0 };
      }
      const newRow = buildFilaCorteTrabajador({
        personal: targetWorker,
        columnas,
        area,
        esNuevoEnCiclo: true,
        valesTotal: valesByPersonalId[targetWorker.id] ?? 0,
        existingCells: emptyCells,
      });
      newRow.relevoNota = `Relevo de ${sourceRow?.personal.nombre_completo ?? 'compañero'} (${diasB}d)`;
      return [...updated, newRow];
    });

    toast.success(`Relevo aplicado: ${diasA} días y ${diasB} días.`);
    setRelevoSourceId(null);
    setRelevoTargetId('');
  }

  const totalesPorColumna = useMemo(() => {
    const map: Record<string, number> = {};
    for (const col of columnas) {
      map[col.weekStart] = filas.reduce(
        (sum, f) => sum + (f.semanas[col.weekStart]?.totalSemana ?? 0),
        0,
      );
    }
    return map;
  }, [columnas, filas]);

  const granTotalCorte = useMemo(
    () => filas.reduce((sum, f) => sum + f.totalNetoCorte, 0),
    [filas],
  );

  const nuevosCount = useMemo(
    () => filas.filter((f) => f.esNuevoEnCiclo).length,
    [filas],
  );

  const filteredFilas = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return filas;
    return filas.filter(
      (f) =>
        f.personal.nombre_completo.toLowerCase().includes(q) ||
        (f.personal.cedula && f.personal.cedula.toLowerCase().includes(q)) ||
        (f.personal.cargo && f.personal.cargo.toLowerCase().includes(q)),
    );
  }, [filas, searchQuery]);

  async function handleCerrarCorteCompleto() {
    if (filas.length === 0 || columnas.length === 0) {
      toast.error('No hay trabajadores en el corte.');
      return;
    }

    setIsClosingCorte(true);
    try {
      const rangeStart = columnas[0].weekStart;
      const rangeEnd = columnas[columnas.length - 1].weekEnd;
      const labelFinal =
        corteLabel.trim() ||
        `Corte ${area === 'planta' ? 'Molinos' : 'Mina'} ${fmtShortDate(rangeStart)}–${fmtShortDate(rangeEnd)}`;

      const formattedDistribucion = (distribucionPartes || []).map((p) => ({
        id: p.id,
        nombre: p.nombre,
        porcentaje: Number(p.porcentaje) || 0,
        pagoDirecto: Math.max(0, Number(p.pagoDirecto) || 0),
      }));

      const closedSemanaIds: string[] = [];

      for (let idx = 0; idx < columnas.length; idx++) {
        const col = columnas[idx];
        const isLastCol = idx === columnas.length - 1;

        const rowsForWeek = filas.map((f) => {
          const cell = f.semanas[col.weekStart];
          const valesToApply = isLastCol ? f.valesTotal : 0;
          const totalFilaSemana = Math.max(
            0,
            parseFloat(((cell?.totalSemana ?? 0) - valesToApply).toFixed(2)),
          );
          const obsParts: string[] = [];
          if (f.esNuevoEnCiclo && col.tipo === 'libre_pagada') {
            obsParts.push('Nuevo ingreso (sin semana libre acumulada)');
          }
          if (cell?.motivoExtra) obsParts.push(cell.motivoExtra);
          if (f.relevoNota) obsParts.push(f.relevoNota);

          return {
            personalId: f.personal.id,
            estadoAsistencia: cell?.estadoAsistencia ?? 'no_laborado',
            diasTrabajados: cell?.diasTrabajados ?? 0,
            total: totalFilaSemana,
            bonoTransporte: cell?.bonoTransporte ?? 0,
            bonificaciones: cell?.pagoExtra ?? 0,
            totalVales: valesToApply,
            novedadTurno: 'ACTIVO',
            novedadTurnoObs: obsParts.join(' · '),
            esSemanaLibre: cell?.estadoAsistencia === 'libre',
            salarioBaseCalculado: cell?.sueldoCalculado ?? 0,
            ajusteMotivo: obsParts.join(' · ') || 'Cierre por Matriz de Corte de Grupo',
            cuadrillaNombre: f.cuadrillaNombre,
            posicionCiclo: idx,
          };
        });

        const response = await fetch('/api/nomina/cierre', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            area,
            inicio: col.weekStart,
            fin: col.weekEnd,
            rows: rowsForWeek,
            distribucion: formattedDistribucion,
            modoCierre: 'historico_manual',
            periodoManual: {
              label: labelFinal,
              rangeStart,
              rangeEnd,
              plantillaId: activePlantilla?.id || undefined,
            },
          }),
        });

        const res = await response.json();
        if (!response.ok || !res.ok) {
          throw new Error(
            `Error al cerrar la semana ${fmtShortDate(col.weekStart)}: ${res.message || response.statusText}`,
          );
        }
        if (res.data?.semanaId) {
          closedSemanaIds.push(res.data.semanaId);
        }
      }

      if (area === 'mina' || area === 'planta') {
        await consolidarPeriodoClient({
          label: labelFinal,
          rangeStart,
          rangeEnd,
          area,
          metadata: {
            plantilla_id: activePlantilla?.id,
            plantilla_nombre: activePlantilla?.nombre,
            semana_ids: closedSemanaIds,
            origen_corte: preset,
          },
        });
      }

      toast.success(
        `Corte «${labelFinal}» cerrado y consolidado exitosamente ($${granTotalCorte.toFixed(2)}).`,
      );
      onCorteCerrado();
      onClose();
    } catch (err: any) {
      console.error('[NominaCorteMatrixModal] Error cerrando corte:', err);
      toast.error(err?.message || 'Error al cerrar el corte.');
    } finally {
      setIsClosingCorte(false);
    }
  }

  const presetOptions = useMemo(() => {
    if (area === 'planta') {
      return [
        {
          value: 'molino_regreso_3sem',
          label: 'Molinos · Corte de Regreso (Libre Pagada + Libre $0 + 1ra Trabajada)',
        },
        {
          value: 'molino_salida_1sem',
          label: 'Molinos · Corte de Salida a Casa (2da Trabajada + $30 Bono Carro)',
        },
        {
          value: 'molino_completo_4sem',
          label: 'Molinos · Ciclo Completo (2 Libres + 2 Trabajadas + $30 Carro)',
        },
      ];
    }
    return [
      {
        value: 'mina_corte_3sem',
        label: 'Mina · Corte de Grupo que Sale Libre (Libre Previa + Trab. 1 + Trab. 2)',
      },
      {
        value: 'molino_salida_1sem',
        label: 'Corte de 1 Sola Semana',
      },
    ];
  }, [area]);

  const plantillaSelectOptions = useMemo(() => {
    return [
      ...plantillas.map((p) => ({
        value: p.id,
        label: p.nombre,
      })),
      {
        value: '__none__',
        label: 'Sin plantilla (Lista en pantalla / Foto Supervisor)',
      },
    ];
  }, [plantillas]);

  const groupSourceOptions = useMemo(() => {
    const opts: Array<{ value: string; label: string }> = [
      {
        value: '__manual__',
        label: `✍️ Lista manual (${selectedCuadrillaId === '__manual__' ? filas.length : 0} trab.) — tú eliges quién va`,
      },
    ];
    if (selectedCuadrillaId === '__supervisor__') {
      opts.push({
        value: '__supervisor__',
        label: `📷 Lista / Foto del Supervisor (${filas.length} trab.)`,
      });
    }
    if (activePlantilla) {
      opts.push({
        value: '__all_plantilla__',
        label: `⭐ Todas las cuadrillas de ${activePlantilla.nombre} (${allPlantillaWorkers.length} trab.)`,
      });
      for (const c of activePlantilla.cuadrillas) {
        const count = (workersByCuadrilla[c.id] ?? []).length;
        opts.push({
          value: c.id,
          label: `${c.nombre} (${count} trab.)`,
        });
      }
    }
    opts.push({
      value: '__current__',
      label: `Trabajadores actuales en pantalla (${currentWeekWorkers.length})`,
    });
    return opts;
  }, [
    selectedCuadrillaId,
    filas.length,
    activePlantilla,
    allPlantillaWorkers.length,
    workersByCuadrilla,
    currentWeekWorkers.length,
  ]);

  const availableToAddOptions = useMemo(() => {
    const inTable = new Set(filas.map((f) => f.personal.id));
    return [
      { value: '', label: '+ Agregar trabajador al corte...' },
      ...catalog
        .filter((p) => !inTable.has(p.id) && p.estatus === 'ACTIVO')
        .sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo, 'es'))
        .map((p) => ({
          value: p.id,
          label: `${p.nombre_completo} (C.I. ${p.cedula} · ${p.cargo} · $${p.salario_base})`,
        })),
    ];
  }, [catalog, filas]);

  const workedColsCount = useMemo(
    () =>
      columnas.filter(
        (c) => c.tipo === 'trabajada_1' || c.tipo === 'trabajada_2' || c.tipo === 'trabajada_unica',
      ).length,
    [columnas],
  );

  return (
    <PageFormModal
      open={open}
      onClose={onClose}
      panelClassName="sm:max-w-[96vw] xl:max-w-[1460px] !p-3 sm:!p-5"
    >
      <div className="space-y-3">
        <div className="border-b border-zinc-800 pb-2.5 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="page-form-modal-title text-base font-bold text-white">
              {area === 'planta'
                ? 'Matriz Rápida de Corte — Molinos (Plantilla + Bono Carro $30)'
                : 'Matriz Rápida de Corte — Mina (Acumulado 3 Semanas: $300 Antiguos / $200 Nuevos)'}
            </h3>
            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
              Elige tu plantilla (ej. <strong>Variante Nómina + Ingeniero</strong>) o sube la <strong>foto de la lista del supervisor</strong> para armar y cerrar el corte de un solo clic.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenSupervisorPaste();
            }}
            className={cn(
              MINEOS_BTN_NOMINA_PRIMARY,
              'h-8 px-3 text-xs font-bold inline-flex items-center gap-1.5',
            )}
          >
            <Camera className="h-3.5 w-3.5" />
            Subir Foto / Pegar Lista de Supervisor
          </button>
        </div>

        {/* Configuración Superior del Corte (5 columnas claras) */}
        <div className={cn(mineosPanel('general'), '!p-3 grid gap-2.5 lg:grid-cols-12')}>
          <div className="lg:col-span-3">
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              1. Esquema del Corte
            </label>
            <AppSelect
              value={preset}
              onChange={(v) => setPreset(v as ModoCortePreset)}
              options={presetOptions}
            />
          </div>

          <div className="lg:col-span-3">
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              2. Plantilla de Rotación
            </label>
            <AppSelect
              value={selectedPlantillaId}
              onChange={(val) => {
                setSelectedPlantillaId(val);
                // No autocargar: el usuario elige explícitamente la cuadrilla en el paso 3.
                if (selectedCuadrillaId !== '__supervisor__') {
                  setSelectedCuadrillaId('__manual__');
                }
              }}
              options={plantillaSelectOptions}
            />
          </div>

          <div className="lg:col-span-2">
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              3. Cuadrilla / Grupo
            </label>
            <AppSelect
              value={selectedCuadrillaId}
              onChange={setSelectedCuadrillaId}
              options={groupSourceOptions}
            />
          </div>

          <div className="lg:col-span-2">
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              4. Lunes Semana Salida
            </label>
            <AppDatePicker value={anchorWeek} onChange={setAnchorWeek} />
          </div>

          <div className="lg:col-span-2">
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              5. Nombre del Corte
            </label>
            <input
              type="text"
              value={corteLabel}
              onChange={(e) => setCorteLabel(e.target.value)}
              className="input-field w-full text-xs"
              placeholder="Ej: Corte Grupo 1 Mina"
            />
          </div>
        </div>

        {/* Barra de Herramientas Rápidas del Corte + Controles de Scroll Horizontal */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--card-border)] bg-[var(--surface-elevated)]/40 px-3 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-64">
              <AppSelect
                value={addWorkerId}
                onChange={setAddWorkerId}
                options={availableToAddOptions}
                placeholder="+ Agregar trabajador..."
              />
            </div>
            {addWorkerId && (
              <button
                type="button"
                onClick={handleAddWorker}
                className={cn(
                  MINEOS_BTN_NOMINA_PRIMARY,
                  'h-8 px-3 text-xs inline-flex items-center gap-1',
                )}
              >
                <Plus className="h-3.5 w-3.5" /> Agregar
              </button>
            )}

            <div className="relative w-52">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/35" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar trabajador..."
                className="input-field h-8 w-full pl-8 pr-2 text-xs"
              />
            </div>

            {filas.length > 0 && (
              <button
                type="button"
                onClick={() => setFilas([])}
                className="h-8 rounded-lg border border-red-500/25 bg-red-500/10 px-2.5 text-[11px] font-semibold text-red-300 hover:bg-red-500/20 inline-flex items-center gap-1"
              >
                <Trash2 className="h-3 w-3" /> Vaciar tabla
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {area === 'planta' && (
              <button
                type="button"
                onClick={() => {
                  const lastCol = columnas[columnas.length - 1];
                  if (!lastCol) return;
                  setFilas((prev) =>
                    prev.map((f) => {
                      const cell = f.semanas[lastCol.weekStart];
                      if (!cell || cell.estadoAsistencia !== 'trabajada') return f;
                      return recomputeFilaCorteTotals({
                        ...f,
                        semanas: {
                          ...f.semanas,
                          [lastCol.weekStart]: {
                            ...cell,
                            bonoTransporte:
                              cell.bonoTransporte > 0 ? 0 : DEFAULT_BONO_TRANSPORTE_MOLINO,
                          },
                        },
                      });
                    }),
                  );
                }}
                className={cn(
                  mineosBtnSubtleClass('benefit'),
                  'h-8 px-2.5 text-[11px] inline-flex items-center gap-1.5',
                )}
              >
                <Truck className="h-3.5 w-3.5" />
                Alternar Bono Carro ($30) al Grupo
              </button>
            )}

            {/* Botones explícitos para desplazar la tabla izquierda / derecha */}
            <div className="inline-flex items-center rounded-lg border border-zinc-700 bg-zinc-900 p-0.5">
              <button
                type="button"
                onClick={() =>
                  tableScrollRef.current?.scrollBy({ left: -320, behavior: 'smooth' })
                }
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-bold text-white/75 hover:bg-zinc-800 hover:text-white"
                title="Desplazar tabla hacia la izquierda"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Izq.
              </button>
              <button
                type="button"
                onClick={() =>
                  tableScrollRef.current?.scrollBy({ left: 320, behavior: 'smooth' })
                }
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-bold text-white/75 hover:bg-zinc-800 hover:text-white"
                title="Desplazar tabla hacia la derecha"
              >
                Der. <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Panel de Relevo Rápido */}
        {relevoSourceId && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <ArrowLeftRight className="h-4 w-4 text-amber-400" />
              <span className="font-bold text-amber-300">
                Relevo para{' '}
                {filas.find((f) => f.personal.id === relevoSourceId)?.personal.nombre_completo}:
              </span>
              <div className="w-44">
                <AppSelect
                  value={relevoWeekStart}
                  onChange={setRelevoWeekStart}
                  options={columnas.map((c) => ({
                    value: c.weekStart,
                    label: `${c.shortLabel} (${fmtShortDate(c.weekStart)})`,
                  }))}
                />
              </div>
              <span className="text-white/70">Días titular:</span>
              <input
                type="number"
                min={0}
                max={7}
                value={relevoDiasA}
                onChange={(e) => setRelevoDiasA(Number(e.target.value))}
                className="w-14 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-center text-xs font-bold text-white"
              />
              <span className="text-white/70">→ Suplente ({7 - relevoDiasA}d):</span>
              <div className="w-60">
                <AppSelect
                  value={relevoTargetId}
                  onChange={setRelevoTargetId}
                  options={[
                    { value: '', label: 'Seleccionar suplente...' },
                    ...catalog
                      .filter((p) => p.id !== relevoSourceId && p.estatus === 'ACTIVO')
                      .map((p) => ({
                        value: p.id,
                        label: `${p.nombre_completo} (${p.cargo})`,
                      })),
                  ]}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleApplyRelevo}
                disabled={!relevoTargetId}
                className={cn(MINEOS_BTN_NOMINA_PRIMARY, 'h-8 px-3 text-xs')}
              >
                Aplicar Relevo
              </button>
              <button
                type="button"
                onClick={() => setRelevoSourceId(null)}
                className="text-xs text-white/60 hover:text-white px-2"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Tabla Matriz Multi-Semana con Scroll Horizontal Libre */}
        <div
          ref={tableScrollRef}
          className="overflow-x-auto overflow-y-auto rounded-xl border border-[var(--card-border)] bg-zinc-950/60 max-h-[440px]"
        >
          <table className="w-full min-w-[980px] border-collapse text-left text-xs">
            <thead className="sticky top-0 z-20 bg-zinc-900 border-b border-zinc-800 text-[10px] font-bold uppercase tracking-wider text-white/65">
              <tr>
                <th className="sticky left-0 z-30 bg-zinc-900 px-3 py-2.5 min-w-[230px] border-r border-zinc-800">
                  Trabajador / Cargo / Sueldo Sem.
                </th>
                <th className="px-2.5 py-2.5 text-center min-w-[135px] border-r border-zinc-800">
                  Semana Libre / Guardia
                </th>
                {columnas.map((col) => (
                  <th
                    key={col.weekStart}
                    className="px-2.5 py-2 text-center min-w-[175px] border-r border-zinc-800 bg-zinc-900/80"
                  >
                    <div className="text-amber-400 font-extrabold">{col.shortLabel}</div>
                    <div className="text-[9px] font-normal text-white/45">
                      {fmtShortDate(col.weekStart)} al {fmtShortDate(col.weekEnd)}
                    </div>
                  </th>
                ))}
                <th className="px-3 py-2.5 text-right min-w-[125px] border-r border-zinc-800">
                  Total a Llevar
                </th>
                <th className="px-2 py-2.5 text-center w-16">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {filteredFilas.map((fila) => {
                const p = fila.personal;
                const totalDiasGuardia = columnas
                  .filter(
                    (c) =>
                      c.tipo === 'trabajada_1' ||
                      c.tipo === 'trabajada_2' ||
                      c.tipo === 'trabajada_unica',
                  )
                  .reduce((acc, c) => acc + (fila.semanas[c.weekStart]?.diasTrabajados ?? 0), 0);

                return (
                  <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                    {/* Columna Fija Izquierda: Trabajador + Cargo + Salario Semanal editable */}
                    <td className="sticky left-0 z-10 bg-zinc-950 px-3 py-2 border-r border-zinc-800/80 align-middle">
                      <div className="font-bold text-white/95 leading-snug">
                        {p.nombre_completo}
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] text-white/45">{p.cargo}</span>
                        <span className="text-[10px] text-white/30">·</span>
                        <label className="inline-flex items-center gap-1 text-[10px] text-amber-400/90">
                          <span>$</span>
                          <input
                            type="number"
                            min={0}
                            step="1"
                            value={p.salario_base}
                            onChange={(e) =>
                              updateSalarioFila(p.id, Math.max(0, Number(e.target.value) || 0))
                            }
                            title="Sueldo base semanal en este corte"
                            className="w-14 rounded border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 text-right text-[11px] font-bold text-amber-300 outline-none focus:border-amber-500"
                          />
                          <span className="text-[9px] text-white/40">/sem</span>
                        </label>
                      </div>
                      {fila.relevoNota && (
                        <p className="mt-1 text-[9px] text-amber-300/90">{fila.relevoNota}</p>
                      )}
                    </td>

                    {/* Antigüedad (Libre) + Días Totales de Guardia (0-14) */}
                    <td className="px-2 py-2 border-r border-zinc-800/60 text-center align-middle space-y-1.5">
                      <button
                        type="button"
                        onClick={() => toggleNuevoEnCiclo(p.id)}
                        title="Clic para alternar si cobra o no la semana libre previa"
                        className={cn(
                          'inline-flex flex-col items-center justify-center rounded-lg border px-2 py-1 text-[9px] font-bold uppercase tracking-wide transition-all w-full',
                          fila.esNuevoEnCiclo
                            ? 'border-purple-500/30 bg-purple-500/15 text-purple-300 hover:bg-purple-500/25'
                            : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20',
                        )}
                      >
                        <span>{fila.esNuevoEnCiclo ? 'SIN LIBRE ($0)' : 'CON LIBRE PAGA'}</span>
                      </button>

                      {workedColsCount >= 2 && (
                        <label
                          title="Días trabajados en la guardia de 2 semanas (ej. 14, 12 o 7). Se reparten automáticamente en Trabajada 1 y Trabajada 2."
                          className="flex items-center justify-between gap-1 rounded border border-zinc-800 bg-zinc-900/90 px-2 py-0.5 text-[10px]"
                        >
                          <span className="text-white/50">Guardia:</span>
                          <span className="inline-flex items-center gap-0.5">
                            <input
                              type="number"
                              min={0}
                              max={14}
                              value={totalDiasGuardia}
                              onChange={(e) =>
                                updateDiasGuardiaTotal(p.id, Number(e.target.value) || 0)
                              }
                              className="w-9 bg-transparent text-center font-extrabold text-amber-300 outline-none"
                            />
                            <span className="text-[9px] text-white/40">d</span>
                          </span>
                        </label>
                      )}
                    </td>

                    {/* Celdas por cada Semana del Corte */}
                    {columnas.map((col) => {
                      const cell = fila.semanas[col.weekStart];
                      if (!cell) return <td key={col.weekStart} />;
                      return (
                        <td
                          key={col.weekStart}
                          className="px-2.5 py-2 border-r border-zinc-800/60 align-top"
                        >
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between gap-1">
                              <div className="inline-flex rounded-md border border-zinc-800 bg-zinc-900 p-0.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateCelda(p.id, col.weekStart, {
                                      estadoAsistencia: 'trabajada',
                                      diasTrabajados: 7,
                                      bloqueadaPorNuevoIngreso: false,
                                    })
                                  }
                                  className={cn(
                                    'rounded px-1.5 py-0.5 text-[9px] font-bold uppercase',
                                    cell.estadoAsistencia === 'trabajada'
                                      ? 'bg-amber-500/20 text-amber-300'
                                      : 'text-white/40 hover:text-white/70',
                                  )}
                                >
                                  Trab
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateCelda(p.id, col.weekStart, {
                                      estadoAsistencia: 'libre',
                                      diasTrabajados: 0,
                                      bloqueadaPorNuevoIngreso: false,
                                    })
                                  }
                                  className={cn(
                                    'rounded px-1.5 py-0.5 text-[9px] font-bold uppercase',
                                    cell.estadoAsistencia === 'libre'
                                      ? 'bg-cyan-500/20 text-cyan-300'
                                      : 'text-white/40 hover:text-white/70',
                                  )}
                                >
                                  Libre
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateCelda(p.id, col.weekStart, {
                                      estadoAsistencia: 'no_laborado',
                                      diasTrabajados: 0,
                                    })
                                  }
                                  className={cn(
                                    'rounded px-1.5 py-0.5 text-[9px] font-bold uppercase',
                                    cell.estadoAsistencia === 'no_laborado'
                                      ? 'bg-red-500/20 text-red-300'
                                      : 'text-white/40 hover:text-white/70',
                                  )}
                                >
                                  $0
                                </button>
                              </div>

                              {cell.estadoAsistencia === 'trabajada' && (
                                <label className="inline-flex items-center gap-0.5 text-[10px]">
                                  <input
                                    type="number"
                                    min={0}
                                    max={14}
                                    value={cell.diasTrabajados}
                                    onChange={(e) =>
                                      updateCelda(p.id, col.weekStart, {
                                        diasTrabajados: Number(e.target.value) || 0,
                                      })
                                    }
                                    className="w-10 rounded border border-zinc-800 bg-zinc-900 px-1 py-0.5 text-center text-[10px] font-bold text-white"
                                  />
                                  <span className="text-[9px] text-white/40">d</span>
                                </label>
                              )}
                            </div>

                            <div className="flex items-center justify-between gap-1 text-[10px]">
                              <span className="text-white/50">Sueldo:</span>
                              <span className="font-bold tabular-nums text-white/90">
                                ${cell.sueldoCalculado.toFixed(2)}
                              </span>
                            </div>

                            <div className="flex items-center justify-between gap-1">
                              <label className="inline-flex items-center gap-1 text-[9px] text-white/45">
                                <span>+Extra:</span>
                                <input
                                  type="number"
                                  min={0}
                                  step="1"
                                  value={cell.pagoExtra || ''}
                                  placeholder="0"
                                  onChange={(e) =>
                                    updateCelda(p.id, col.weekStart, {
                                      pagoExtra: Math.max(0, Number(e.target.value) || 0),
                                    })
                                  }
                                  className="w-12 rounded border border-zinc-800 bg-zinc-900 px-1 py-0.5 text-right text-[10px] text-amber-300"
                                />
                              </label>

                              {area === 'planta' && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateCelda(p.id, col.weekStart, {
                                      bonoTransporte:
                                        cell.bonoTransporte > 0
                                          ? 0
                                          : DEFAULT_BONO_TRANSPORTE_MOLINO,
                                    })
                                  }
                                  title="Bono de transporte ($30) al salir libre a casa"
                                  className={cn(
                                    'rounded border px-1.5 py-0.5 text-[9px] font-bold transition-colors',
                                    cell.bonoTransporte > 0
                                      ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                                      : 'border-zinc-800 bg-zinc-900 text-white/35 hover:text-white/60',
                                  )}
                                >
                                  🚌 ${cell.bonoTransporte || 0}
                                </button>
                              )}
                            </div>
                          </div>
                        </td>
                      );
                    })}

                    {/* Total Acumulado del Trabajador en el Corte */}
                    <td className="px-3 py-2 text-right align-middle border-r border-zinc-800/60">
                      <div className="text-sm font-black tabular-nums text-amber-400">
                        ${fila.totalNetoCorte.toFixed(2)}
                      </div>
                      <div className="text-[9px] text-white/45 tabular-nums">
                        Sueldo ${fila.totalBrutoCorte.toFixed(2)}
                        {fila.totalBonoTransporteCorte > 0
                          ? ` + Carro $${fila.totalBonoTransporteCorte.toFixed(0)}`
                          : ''}
                        {fila.totalExtrasCorte > 0
                          ? ` + Extra $${fila.totalExtrasCorte.toFixed(0)}`
                          : ''}
                        {fila.valesTotal > 0 ? ` - Vale $${fila.valesTotal.toFixed(0)}` : ''}
                      </div>
                    </td>

                    {/* Acciones por fila */}
                    <td className="px-2 py-2 text-center align-middle">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setRelevoSourceId(p.id);
                            setRelevoWeekStart(columnas[columnas.length - 1]?.weekStart ?? '');
                            setRelevoDiasA(3);
                          }}
                          title="Registrar relevo (dividir semana con suplente)"
                          className="p-1.5 rounded hover:bg-amber-500/15 text-white/50 hover:text-amber-300 transition-colors"
                        >
                          <ArrowLeftRight className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setFilas((prev) => prev.filter((f) => f.personal.id !== p.id))
                          }
                          title="Quitar trabajador de este corte"
                          className="p-1.5 rounded hover:bg-red-500/15 text-white/45 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Barra de Totales por Semana FUERA del scroll para no tapar nunca la barra de desplazamiento */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/90 px-3.5 py-2.5 text-xs">
          <div className="font-bold uppercase tracking-wider text-white/70 text-[10px]">
            Totales por Semana ({filas.length} trabajadores)
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {columnas.map((col) => (
              <div key={col.weekStart} className="flex items-center gap-1.5">
                <span className="text-[10px] text-white/50">{col.shortLabel}:</span>
                <span className="font-bold tabular-nums text-amber-300">
                  ${(totalesPorColumna[col.weekStart] ?? 0).toFixed(2)}
                </span>
              </div>
            ))}
            <div className="border-l border-zinc-700 pl-3 flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase text-white/60">Gran Total:</span>
              <span className="text-sm font-black tabular-nums text-amber-400">
                ${granTotalCorte.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <PageFormModalFooter className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 pt-3">
        <div className="flex items-center gap-3">
          <span className="text-xs text-[var(--text-muted)]">
            {filas.length} trabajadores · {nuevosCount} sin semana libre previa
          </span>
          <span className={cn(mineosKpiValue('general'), 'text-sm font-black tabular-nums')}>
            Total Corte: ${granTotalCorte.toLocaleString('es', { minimumFractionDigits: 2 })}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isClosingCorte}
            className={cn(mineosBtnSubtleClass('neutral'), 'h-9 px-3 text-xs')}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleCerrarCorteCompleto}
            disabled={isClosingCorte || filas.length === 0}
            className={cn(
              MINEOS_BTN_NOMINA_PRIMARY,
              'h-9 px-4 text-xs font-bold inline-flex items-center gap-2 disabled:opacity-40',
            )}
          >
            {isClosingCorte ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wallet className="h-4 w-4" />
            )}
            {isClosingCorte
              ? 'Cerrando y consolidando...'
              : `Cerrar Corte Completo ($${granTotalCorte.toFixed(2)})`}
          </button>
        </div>
      </PageFormModalFooter>
    </PageFormModal>
  );
}
