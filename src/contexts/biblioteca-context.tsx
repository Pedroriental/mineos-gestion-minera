'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import {
  FALLBACK_SNAPSHOT,
  getBibliotecaOptions,
  getTurnoOptions,
  type BibliotecaAppSnapshot,
  type BibliotecaSelectOption,
} from '@/lib/biblioteca-catalog';

const BibliotecaContext = createContext<BibliotecaAppSnapshot>(FALLBACK_SNAPSHOT);

export function BibliotecaProvider({
  snapshot,
  children,
}: {
  snapshot: BibliotecaAppSnapshot;
  children: ReactNode;
}) {
  return <BibliotecaContext.Provider value={snapshot}>{children}</BibliotecaContext.Provider>;
}

export function useBiblioteca(): BibliotecaAppSnapshot {
  return useContext(BibliotecaContext);
}

export function useBibliotecaOptions(
  slug: string,
  config?: { prependEmpty?: boolean; emptyLabel?: string; emptyValue?: string },
): BibliotecaSelectOption[] {
  const snapshot = useBiblioteca();
  return useMemo(() => getBibliotecaOptions(snapshot, slug, config), [snapshot, slug, config]);
}

export function useTurnoOptions(withEmoji = true): BibliotecaSelectOption[] {
  const snapshot = useBiblioteca();
  return useMemo(() => getTurnoOptions(snapshot, withEmoji), [snapshot, withEmoji]);
}

/** Mapa valor → etiqueta para una categoría (tablas, badges). */
export function useBibliotecaLabelsMap(slug: string): Record<string, string> {
  const snapshot = useBiblioteca();
  return useMemo(() => snapshot.labelsBySlug[slug] || {}, [snapshot, slug]);
}
