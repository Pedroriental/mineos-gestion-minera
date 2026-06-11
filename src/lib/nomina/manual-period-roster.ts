/** Trabajadores cargados manualmente por semana de periodo manual (localStorage). */

export type ManualWeekRosterEntry = {
  id: string;
  areaDetalle?: string;
};

export function manualWeekRosterKey(area: string, weekStart: string): string {
  return `nomina-manual-week-roster-v1-${area}-${weekStart}`;
}

function normalizeRosterEntry(raw: unknown): ManualWeekRosterEntry | null {
  if (typeof raw === 'string' && raw.length > 0) return { id: raw };
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const id = typeof row.id === 'string' ? row.id : '';
  if (!id) return null;
  const areaDetalle =
    typeof row.areaDetalle === 'string' && row.areaDetalle.trim()
      ? row.areaDetalle.trim()
      : undefined;
  return { id, areaDetalle };
}

export function readManualWeekRosterEntries(
  area: string,
  weekStart: string,
): ManualWeekRosterEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(manualWeekRosterKey(area, weekStart));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: ManualWeekRosterEntry[] = [];
    for (const item of parsed) {
      const entry = normalizeRosterEntry(item);
      if (entry && !out.some((e) => e.id === entry.id)) out.push(entry);
    }
    return out;
  } catch {
    return [];
  }
}

export function readManualWeekRoster(area: string, weekStart: string): string[] {
  return readManualWeekRosterEntries(area, weekStart).map((e) => e.id);
}

export function writeManualWeekRosterEntries(
  area: string,
  weekStart: string,
  entries: ManualWeekRosterEntry[],
): void {
  if (typeof window === 'undefined') return;
  try {
    const unique: ManualWeekRosterEntry[] = [];
    for (const entry of entries) {
      if (!entry.id) continue;
      const idx = unique.findIndex((e) => e.id === entry.id);
      if (idx >= 0) unique[idx] = { ...unique[idx], ...entry };
      else unique.push(entry);
    }
    if (!unique.length) {
      localStorage.removeItem(manualWeekRosterKey(area, weekStart));
      return;
    }
    localStorage.setItem(manualWeekRosterKey(area, weekStart), JSON.stringify(unique));
  } catch {
    /* quota / private mode */
  }
}

export function writeManualWeekRoster(
  area: string,
  weekStart: string,
  personalIds: string[],
): void {
  writeManualWeekRosterEntries(
    area,
    weekStart,
    personalIds.map((id) => ({ id })),
  );
}

export function addToManualWeekRoster(
  area: string,
  weekStart: string,
  personalId: string,
  areaDetalle?: string,
): void {
  const next = readManualWeekRosterEntries(area, weekStart);
  const idx = next.findIndex((e) => e.id === personalId);
  const entry: ManualWeekRosterEntry = {
    id: personalId,
    ...(areaDetalle?.trim() ? { areaDetalle: areaDetalle.trim() } : {}),
  };
  if (idx >= 0) next[idx] = { ...next[idx], ...entry };
  else next.push(entry);
  writeManualWeekRosterEntries(area, weekStart, next);
}

export function removeFromManualWeekRoster(
  area: string,
  weekStart: string,
  personalId: string,
): void {
  writeManualWeekRosterEntries(
    area,
    weekStart,
    readManualWeekRosterEntries(area, weekStart).filter((e) => e.id !== personalId),
  );
}

export function mergeManualWeekRosterIds(
  area: string,
  weekStart: string,
  personalIds: string[],
): void {
  if (!personalIds.length) return;
  const existing = readManualWeekRosterEntries(area, weekStart);
  const byId = new Map(existing.map((e) => [e.id, e]));
  for (const id of personalIds) {
    if (!id) continue;
    if (!byId.has(id)) byId.set(id, { id });
  }
  writeManualWeekRosterEntries(area, weekStart, [...byId.values()]);
}

export function clearManualWeekRoster(area: string, weekStart: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(manualWeekRosterKey(area, weekStart));
  } catch {
    /* ignore */
  }
}
