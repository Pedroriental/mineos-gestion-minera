'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CalendarRange,
  CheckCircle2,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Truck,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
  ArrowLeftRight,
  ClipboardPaste,
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
import type { RotacionPlantillaRecord } from '@/lib/rotacion-plantillas/types';
import type { NominaSemana, Personal } from '@/lib/types';
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
  valesByPersonalId: Record<string, number>;
  distribucionPartes: DistribucionParte[];
  onOpenSupervisorPaste: () => void;
  onCorteCerrado: () => void;
};

function fmtShortDate(iso: string): string {
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}`;
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
  valesByPersonalId,
  distribucionPartes,
  onOpenSupervisorPaste,
  onCorteCerrado,
}: Props) {
  const defaultPreset: ModoCortePreset =
    area === 'planta' ? 'molino_regreso_3sem' : 'mina_corte_3sem';

  const [preset, setPreset] = useState<ModoCortePreset>(defaultPreset);
  const [anchorWeek, setAnchorWeek] = useState<string>(anchorWeekStart);
  const [selectedPlantillaId, setSelectedPlantillaId] = useState<string>(
    plantillas[0]?.id ?? '',
  );
  const [selectedCuadrillaId, setSelectedCuadrillaId] = useState<string>('__current__');
  const [corteLabel, setCorteLabel] = useState<string>('');
  const [filas, setFilas] = useState<FilaCorteTrabajador[]>([]);
  const [veteranIds, setVeteranIds] = useState<Set<string>>(new Set());
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isClosingCorte, setIsClosingCorte] = useState(false);
  const [addWorkerId, setAddWorkerId] = useState<string>('');
  const [relevoSourceId, setRelevoSourceId] = useState<string | null>(null);
  const [relevoTargetId, setRelevoTargetId] = useState<string>('');
  const [relevoWeekStart, setRelevoWeekStart] = useState<string>('');
  const [relevoDiasA, setRelevoDiasA] = useState<number>(3);

  useEffect(() => {
    if (open) {
      setAnchorWeek(anchorWeekStart);
      setPreset(area === 'planta' ? 'molino_regreso_3sem' : 'mina_corte_3sem');
    }
  }, [open, anchorWeekStart, area]);

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
    () => plantillas.find((p) => p.id === selectedPlantillaId) ?? plantillas[0] ?? null,
    [plantillas, selectedPlantillaId],
  );

  // Inicializar o reconstruir las filas cuando cambia el grupo/plantilla o las columnas
  useEffect(() => {
    if (!open) return;

    let baseWorkers: Personal[] = [];
    let cuadrillaLabel = 'Grupo Actual';

    if (selectedCuadrillaId === '__current__') {
      baseWorkers = currentWeekWorkers.length > 0
        ? currentWeekWorkers
        : catalog.filter((p) => p.area === area && p.estatus === 'ACTIVO');
      cuadrillaLabel = 'Lista en Pantalla';
    } else if (activePlantilla) {
      const cuad = activePlantilla.cuadrillas.find((c) => c.id === selectedCuadrillaId);
      if (cuad) {
        cuadrillaLabel = cuad.nombre;
        const ids = new Set(cuad.filas.map((f) => f.personalId));
        baseWorkers = catalog.filter((p) => ids.has(p.id));
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

        return buildFilaCorteTrabajador({
          personal: p,
          columnas,
          area,
          esNuevoEnCiclo: esNuevo,
          valesTotal: valesByPersonalId[p.id] ?? 0,
          cuadrillaNombre: cuadrillaLabel,
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
    selectedCuadrillaId,
    activePlantilla,
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

      // Si el suplente no estaba en la tabla, agregarlo solo con los días trabajados en esa semana
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

      // Cerrar cada semana del corte secuencialmente en modo historico_manual vinculado al mismo periodo
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

      // Consolidar automáticamente el periodo si es mina o planta
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

  const groupSourceOptions = useMemo(() => {
    const opts = [
      { value: '__current__', label: `Trabajadores actuales en pantalla (${currentWeekWorkers.length})` },
    ];
    if (activePlantilla) {
      for (const c of activePlantilla.cuadrillas) {
        opts.push({
          value: c.id,
          label: `Plantilla ${activePlantilla.nombre} → ${c.nombre} (${c.filas.length} trab.)`,
        });
      }
    }
    return opts;
  }, [currentWeekWorkers.length, activePlantilla]);

  const availableToAddOptions = useMemo(() => {
    const inTable = new Set(filas.map((f) => f.personal.id));
    return [
      { value: '', label: '+ Agregar trabajador al corte...' },
      ...catalog
        .filter((p) => !inTable.has(p.id) && p.estatus === 'ACTIVO')
        .sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo, 'es'))
        .map((p) => ({
          value: p.id,
          label: `${p.nombre_completo} (${p.cargo} · $${p.salario_base})`,
        })),
    ];
  }, [catalog, filas]);

  return (
    <PageFormModal
      open={open}
      onClose={onClose}
      panelClassName="max-w-7xl"
    >
      <div className="space-y-3">
        <div className="border-b border-zinc-800 pb-2.5">
          <h3 className="page-form-modal-title text-base font-bold text-white">
            {area === 'planta'
              ? 'Matriz Rápida de Corte — Molinos (Plantilla + Bono Carro $30)'
              : 'Matriz Rápida de Corte — Mina (Acumulado 3 Semanas: $300 Antiguos / $200 Nuevos)'}
          </h3>
          <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
            Edita todas las semanas del grupo en una sola tabla, verifica quién cobra semana libre previa y cierra todo el corte de un solo clic.
          </p>
        </div>
        {/* Configuración Superior del Corte */}
        <div className={cn(mineosPanel('general'), '!p-3 grid gap-3 lg:grid-cols-12')}>
          <div className="lg:col-span-4">
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
              2. Grupo / Cuadrilla
            </label>
            <AppSelect
              value={selectedCuadrillaId}
              onChange={setSelectedCuadrillaId}
              options={groupSourceOptions}
            />
          </div>

          <div className="lg:col-span-2">
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              3. Lunes Semana Actual
            </label>
            <AppDatePicker value={anchorWeek} onChange={setAnchorWeek} />
          </div>

          <div className="lg:col-span-3">
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              4. Nombre del Corte
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

        {/* Barra de Herramientas Rápidas del Corte */}
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
                className={cn(MINEOS_BTN_NOMINA_PRIMARY, 'h-8 px-3 text-xs inline-flex items-center gap-1')}
              >
                <Plus className="h-3.5 w-3.5" /> Agregar
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenSupervisorPaste();
              }}
              className={cn(mineosBtnSubtleClass('general'), 'h-8 px-2.5 text-[11px] inline-flex items-center gap-1.5')}
            >
              <ClipboardPaste className="h-3.5 w-3.5" />
              Pegar Lista de Supervisor
            </button>
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
                className={cn(mineosBtnSubtleClass('benefit'), 'h-8 px-2.5 text-[11px] inline-flex items-center gap-1.5')}
              >
                <Truck className="h-3.5 w-3.5" />
                Alternar Bono Carro ($30) al Grupo
              </button>
            )}
            {loadingHistory && (
              <span className="text-[10px] text-[var(--text-muted)] inline-flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Verificando antigüedad en cortes previos...
              </span>
            )}
          </div>
        </div>

        {/* Panel de Relevo Rápido (cuando se activa en un trabajador) */}
        {relevoSourceId && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <ArrowLeftRight className="h-4 w-4 text-amber-400" />
              <span className="font-bold text-amber-300">
                Relevo para {filas.find((f) => f.personal.id === relevoSourceId)?.personal.nombre_completo}:
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

        {/* Tabla Matriz Multi-Semana */}
        <div className="overflow-x-auto rounded-xl border border-[var(--card-border)] bg-zinc-950/50 max-h-[430px]">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="sticky top-0 z-10 bg-zinc-900/95 border-b border-zinc-800 text-[10px] font-bold uppercase tracking-wider text-white/60">
              <tr>
                <th className="px-3 py-2.5 min-w-[210px] border-r border-zinc-800">
                  Trabajador / Cargo / Sueldo Sem.
                </th>
                <th className="px-2 py-2.5 text-center min-w-[110px] border-r border-zinc-800">
                  Antigüedad (Libre)
                </th>
                {columnas.map((col) => (
                  <th
                    key={col.weekStart}
                    className="px-2.5 py-2 text-center min-w-[165px] border-r border-zinc-800 bg-zinc-900/60"
                  >
                    <div className="text-amber-400 font-extrabold">{col.shortLabel}</div>
                    <div className="text-[9px] font-normal text-white/45">
                      {fmtShortDate(col.weekStart)} al {fmtShortDate(col.weekEnd)}
                    </div>
                  </th>
                ))}
                <th className="px-3 py-2.5 text-right min-w-[115px]">Total a Llevar</th>
                <th className="px-2 py-2.5 text-center w-16">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {filas.map((fila) => {
                const p = fila.personal;
                return (
                  <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                    {/* Trabajador + Cargo + Salario Semanal editable */}
                    <td className="px-3 py-2 border-r border-zinc-800/60 align-middle">
                      <div className="font-bold text-white/90 leading-snug">{p.nombre_completo}</div>
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

                    {/* Botón 1-Clic: Antiguo (Cobra Libre) vs Nuevo (Sin Libre Previa) */}
                    <td className="px-2 py-2 border-r border-zinc-800/60 text-center align-middle">
                      <button
                        type="button"
                        onClick={() => toggleNuevoEnCiclo(p.id)}
                        title="Clic para cambiar entre Antiguo (cobra semana libre previa) y Nuevo (solo cobra semanas trabajadas)"
                        className={cn(
                          'inline-flex flex-col items-center justify-center rounded-lg border px-2 py-1 text-[9px] font-bold uppercase tracking-wide transition-all w-full',
                          fila.esNuevoEnCiclo
                            ? 'border-purple-500/30 bg-purple-500/15 text-purple-300 hover:bg-purple-500/25'
                            : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20',
                        )}
                      >
                        <span>{fila.esNuevoEnCiclo ? 'NUEVO' : 'ANTIGUO'}</span>
                        <span className="text-[8px] font-normal opacity-80">
                          {fila.esNuevoEnCiclo ? 'Sin libre ($0)' : 'Con libre paga'}
                        </span>
                      </button>
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
                            {/* Selector rápido de Estado en esa semana */}
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

                              {/* Días trabajados si es trabajada */}
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

                            {/* Sueldo + Extras + Bono Carro en esa semana */}
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
                    <td className="px-3 py-2 text-right align-middle">
                      <div className="text-sm font-black tabular-nums text-amber-400">
                        ${fila.totalNetoCorte.toFixed(2)}
                      </div>
                      <div className="text-[9px] text-white/45 tabular-nums">
                        Sueldo ${fila.totalBrutoCorte.toFixed(0)}
                        {fila.totalBonoTransporteCorte > 0
                          ? ` + Carro $${fila.totalBonoTransporteCorte.toFixed(0)}`
                          : ''}
                        {fila.totalExtrasCorte > 0
                          ? ` + Extra $${fila.totalExtrasCorte.toFixed(0)}`
                          : ''}
                        {fila.valesTotal > 0 ? ` - Vale $${fila.valesTotal.toFixed(0)}` : ''}
                      </div>
                    </td>

                    {/* Acciones por fila: Relevo o Quitar */}
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
            <tfoot className="sticky bottom-0 bg-zinc-900/95 border-t border-zinc-800 text-xs font-bold">
              <tr>
                <td colSpan={2} className="px-3 py-2.5 text-white/70 uppercase text-[10px]">
                  Totales por Semana ({filas.length} trabajadores)
                </td>
                {columnas.map((col) => (
                  <td
                    key={col.weekStart}
                    className="px-2.5 py-2.5 text-center tabular-nums text-amber-300"
                  >
                    ${(totalesPorColumna[col.weekStart] ?? 0).toFixed(2)}
                  </td>
                ))}
                <td className="px-3 py-2.5 text-right text-sm font-black tabular-nums text-amber-400">
                  ${granTotalCorte.toFixed(2)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      <PageFormModalFooter className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 pt-3">
        <div className="flex items-center gap-3">
          <span className="text-xs text-[var(--text-muted)]">
            {filas.length} trabajadores · {nuevosCount} nuevo{nuevosCount === 1 ? '' : 's'} sin libre previa
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
