'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  computeDistribucion,
  createDistribucionParte,
  DEFAULT_DISTRIBUCION_PARTES,
  loadDistribucionFromStorage,
  rebalancePorcentajesIgual,
  saveDistribucionToStorage,
  sumPorcentajes,
  validateDistribucion,
  type DistribucionLinea,
  type DistribucionParte,
} from '@/lib/nomina-distribucion';

export function useNominaDistribucion(totalNomina: number) {
  const [partes, setPartes] = useState<DistribucionParte[]>(DEFAULT_DISTRIBUCION_PARTES);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setPartes(loadDistribucionFromStorage());
    setHydrated(true);
  }, []);

  const validation = useMemo(() => validateDistribucion(partes), [partes]);
  const lineas: DistribucionLinea[] = useMemo(
    () => computeDistribucion(totalNomina, partes),
    [totalNomina, partes],
  );
  const sumPct = useMemo(() => sumPorcentajes(partes), [partes]);

  const updateParte = useCallback((id: string, patch: Partial<DistribucionParte>) => {
    setPartes((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }, []);

  const addParte = useCallback(() => {
    setPartes((prev) => [...prev, createDistribucionParte()]);
  }, []);

  const removeParte = useCallback((id: string) => {
    setPartes((prev) => (prev.length <= 1 ? prev : prev.filter((p) => p.id !== id)));
  }, []);

  const rebalanceIgual = useCallback(() => {
    setPartes((prev) => rebalancePorcentajesIgual(prev));
  }, []);

  const saveAsDefault = useCallback(() => {
    saveDistribucionToStorage(partes);
  }, [partes]);

  const applyPlantilla = useCallback((plantilla: DistribucionParte[]) => {
    if (!plantilla.length) return;
    setPartes(
      plantilla.map((p) => ({
        id: p.id,
        nombre: p.nombre,
        porcentaje: p.porcentaje,
        pagoDirecto: p.pagoDirecto,
      })),
    );
  }, []);

  return {
    partes,
    setPartes,
    lineas,
    validation,
    sumPct,
    hydrated,
    updateParte,
    addParte,
    removeParte,
    rebalanceIgual,
    saveAsDefault,
    applyPlantilla,
  };
}
