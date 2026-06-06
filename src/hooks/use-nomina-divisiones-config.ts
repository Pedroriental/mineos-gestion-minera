'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useBiblioteca } from '@/contexts/biblioteca-context';
import { saveNominaDivisionesConfigAction } from '@/lib/actions/nomina-actions';
import {
  computeDistribucion,
  DEFAULT_DISTRIBUCION_PARTES,
  loadDistribucionFromStorage,
  saveDistribucionToStorage,
  sumPorcentajes,
  validateDistribucion,
  type DistribucionLinea,
  type DistribucionParte,
} from '@/lib/nomina-distribucion';
import {
  applyNominaDivisionPorcentaje,
  createNominaDivision,
  divisionesToDistribucion,
  isAutoNominaDivisionNombre,
  rebalanceNominaDivisionesIgual,
  resolveNominaDivisionNombre,
  validateNominaDivisiones,
  type NominaDivisionParam,
} from '@/lib/nomina/divisiones';

const MAX_COLS = 8;

function mergePagoDirecto(
  base: NominaDivisionParam[],
  stored: DistribucionParte[],
): DistribucionParte[] {
  const storedMap = new Map(stored.map((p) => [p.id, p.pagoDirecto]));
  const byName = new Map(stored.map((p) => [p.nombre.trim().toLowerCase(), p.pagoDirecto]));
  return base.map((d) => ({
    id: d.id,
    nombre: d.nombre,
    porcentaje: d.porcentaje,
    pagoDirecto: storedMap.get(d.id) ?? byName.get(d.nombre.trim().toLowerCase()) ?? 0,
  }));
}

function resolveInitialPartes(bibliotecaDivisiones: NominaDivisionParam[]): DistribucionParte[] {
  const stored = loadDistribucionFromStorage();
  if (bibliotecaDivisiones.length) {
    return mergePagoDirecto(bibliotecaDivisiones, stored);
  }
  if (stored.length) return stored;
  return DEFAULT_DISTRIBUCION_PARTES.map((p) => ({ ...p }));
}

export function useNominaDivisionesConfig(totalNomina = 0) {
  const biblioteca = useBiblioteca();
  const [partes, setPartes] = useState<DistribucionParte[]>(DEFAULT_DISTRIBUCION_PARTES);
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPartes(resolveInitialPartes(biblioteca.nominaDivisiones));
    setHydrated(true);
  }, [biblioteca.nominaDivisiones]);

  const divisiones: NominaDivisionParam[] = useMemo(
    () =>
      partes.map((p) => ({
        id: p.id,
        nombre: resolveNominaDivisionNombre(p.porcentaje, p.nombre),
        porcentaje: p.porcentaje,
      })),
    [partes],
  );

  const validation = useMemo(() => validateDistribucion(partes), [partes]);
  const previewValidation = useMemo(() => validateNominaDivisiones(divisiones), [divisiones]);
  const lineas: DistribucionLinea[] = useMemo(
    () => computeDistribucion(totalNomina, partes),
    [totalNomina, partes],
  );
  const sumPct = useMemo(() => sumPorcentajes(partes), [partes]);
  const pctOk = divisiones.length === 0 || previewValidation.ok;

  const updateParte = useCallback((id: string, patch: Partial<DistribucionParte>) => {
    setPartes((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }, []);

  const updatePorcentaje = useCallback((id: string, porcentaje: number) => {
    setPartes((prev) => {
      const asParams = prev.map((p) => ({ id: p.id, nombre: p.nombre, porcentaje: p.porcentaje }));
      const next = applyNominaDivisionPorcentaje(asParams, id, porcentaje);
      return next.map((d) => {
        const old = prev.find((p) => p.id === d.id);
        return {
          id: d.id,
          nombre: old
            ? isAutoNominaDivisionNombre(old.nombre, old.porcentaje)
              ? resolveNominaDivisionNombre(d.porcentaje, d.nombre)
              : old.nombre
            : resolveNominaDivisionNombre(d.porcentaje, d.nombre),
          porcentaje: d.porcentaje,
          pagoDirecto: old?.pagoDirecto ?? 0,
        };
      });
    });
  }, []);

  const addParte = useCallback(() => {
    setPartes((prev) => {
      if (prev.length >= MAX_COLS) return prev;
      const extra = createNominaDivision(0);
      const merged = [...prev, { ...extra, pagoDirecto: 0 }];
      return divisionesToDistribucion(rebalanceNominaDivisionesIgual(merged)).map((d, i) => ({
        ...d,
        pagoDirecto: merged[i]?.pagoDirecto ?? 0,
      }));
    });
  }, []);

  const removeParte = useCallback((id?: string) => {
    setPartes((prev) => {
      if (prev.length <= 1) return [];
      if (id) return prev.filter((p) => p.id !== id);
      return prev.slice(0, -1);
    });
  }, []);

  const setColumnCount = useCallback((count: number) => {
    const n = Math.min(MAX_COLS, Math.max(0, Math.round(Number(count) || 0)));
    setPartes((prev) => {
      if (prev.length === n) return prev;
      if (n === 0) return [];
      if (n > prev.length) {
        const extra = Array.from({ length: n - prev.length }, () => ({
          ...createNominaDivision(0),
          pagoDirecto: 0,
        }));
        const merged = [...prev, ...extra];
        const balanced = rebalanceNominaDivisionesIgual(
          merged.map((p) => ({ id: p.id, nombre: p.nombre, porcentaje: p.porcentaje })),
        );
        return balanced.map((d) => ({
          ...d,
          pagoDirecto: merged.find((m) => m.id === d.id)?.pagoDirecto ?? 0,
        }));
      }
      const sliced = prev.slice(0, n);
      const balanced = rebalanceNominaDivisionesIgual(
        sliced.map((p) => ({ id: p.id, nombre: p.nombre, porcentaje: p.porcentaje })),
      );
      return balanced.map((d) => ({
        ...d,
        pagoDirecto: sliced.find((m) => m.id === d.id)?.pagoDirecto ?? 0,
      }));
    });
  }, []);

  const rebalanceIgual = useCallback(() => {
    setPartes((prev) =>
      divisionesToDistribucion(
        rebalanceNominaDivisionesIgual(
          prev.map((p) => ({ id: p.id, nombre: p.nombre, porcentaje: p.porcentaje })),
        ),
      ).map((d) => ({
        ...d,
        pagoDirecto: prev.find((p) => p.id === d.id)?.pagoDirecto ?? 0,
      })),
    );
  }, []);

  const applyPlantilla = useCallback((plantilla: DistribucionParte[]) => {
    if (!plantilla.length) return;
    setPartes(plantilla.map((p) => ({ ...p })));
  }, []);

  const saveAsDefault = useCallback(async () => {
    if (partes.length && !validation.ok) {
      return { ok: false as const, message: validation.message ?? 'Reparto inválido' };
    }
    saveDistribucionToStorage(partes);
    setSaving(true);
    const res = await saveNominaDivisionesConfigAction(divisiones);
    setSaving(false);
    return res;
  }, [partes, divisiones, validation]);

  return {
    partes,
    divisiones,
    lineas,
    validation,
    previewValidation,
    sumPct,
    pctOk,
    hydrated,
    saving,
    updateParte,
    updatePorcentaje,
    addParte,
    removeParte,
    setColumnCount,
    rebalanceIgual,
    applyPlantilla,
    saveAsDefault,
    canAdd: partes.length < MAX_COLS,
    canRemove: partes.length > 0,
  };
}
