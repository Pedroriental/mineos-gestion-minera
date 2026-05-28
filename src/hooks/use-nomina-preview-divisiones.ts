'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  applyDivisionPorcentaje,
  createPreviewDivision,
  loadPreviewDivisionesFromStorage,
  rebalanceDivisionesIgual,
  savePreviewDivisionesToStorage,
  sumDivisionesPct,
  type PreviewDivision,
} from '@/lib/nomina-preview-divisiones';

const MAX_COLS = 8;

export function useNominaPreviewDivisiones() {
  const [divisiones, setDivisiones] = useState<PreviewDivision[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setDivisiones(loadPreviewDivisionesFromStorage());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    savePreviewDivisionesToStorage(divisiones);
  }, [divisiones, hydrated]);

  const sumPct = useMemo(() => sumDivisionesPct(divisiones), [divisiones]);
  const pctOk = divisiones.length === 0 || Math.abs(sumPct - 100) <= 0.05;

  const updatePorcentaje = useCallback((id: string, porcentaje: number) => {
    setDivisiones((prev) => applyDivisionPorcentaje(prev, id, porcentaje));
  }, []);

  const addColumna = useCallback(() => {
    setDivisiones((prev) => {
      if (prev.length >= MAX_COLS) return prev;
      if (prev.length === 0) return [createPreviewDivision(100)];
      return rebalanceDivisionesIgual([...prev, createPreviewDivision(0)]);
    });
  }, []);

  const removeColumna = useCallback(() => {
    setDivisiones((prev) => (prev.length === 0 ? prev : prev.slice(0, -1)));
  }, []);

  const setColumnCount = useCallback((count: number) => {
    const n = Math.min(MAX_COLS, Math.max(0, Math.round(Number(count) || 0)));
    setDivisiones((prev) => {
      if (prev.length === n) return prev;
      if (n === 0) return [];
      if (n > prev.length) {
        const extra = Array.from({ length: n - prev.length }, () => createPreviewDivision(0));
        return rebalanceDivisionesIgual([...prev, ...extra]);
      }
      return rebalanceDivisionesIgual(prev.slice(0, n));
    });
  }, []);

  return {
    divisiones,
    sumPct,
    pctOk,
    hydrated,
    updatePorcentaje,
    addColumna,
    removeColumna,
    setColumnCount,
    canAdd: divisiones.length < MAX_COLS,
    canRemove: divisiones.length > 0,
  };
}
