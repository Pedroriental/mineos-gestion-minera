/** Trabajadores cargados manualmente por semana de periodo manual (localStorage). */

export type ManualWeekRosterEntry = {
  id: string;
  areaDetalle?: string;
};

export function manualWeekRosterKey(
  area: string,
  weekStart: string,
  periodId?: string | null,
): string {
  if (periodId) {
    return `nomina-manual-week-roster-v2-${area}-${periodId}-${weekStart}`;
  }
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

function parseRosterRaw(raw: string | null): ManualWeekRosterEntry[] {
  if (!raw) return [];
  try {
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

export function readManualWeekRosterEntries(
  area: string,
  weekStart: string,
  periodId?: string | null,
): ManualWeekRosterEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    return parseRosterRaw(localStorage.getItem(manualWeekRosterKey(area, weekStart, periodId)));
  } catch {
    return [];
  }
}

export function readManualWeekRoster(
  area: string,
  weekStart: string,
  periodId?: string | null,
): string[] {
  return readManualWeekRosterEntries(area, weekStart, periodId).map((e) => e.id);
}

export function writeManualWeekRosterEntries(
  area: string,
  weekStart: string,
  entries: ManualWeekRosterEntry[],
  periodId?: string | null,
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
    const key = manualWeekRosterKey(area, weekStart, periodId);
    if (!unique.length) {
      localStorage.removeItem(key);
      return;
    }
    localStorage.setItem(key, JSON.stringify(unique));
  } catch {
    /* quota / private mode */
  }
}

export function writeManualWeekRoster(
  area: string,
  weekStart: string,
  personalIds: string[],
  periodId?: string | null,
): void {
  writeManualWeekRosterEntries(
    area,
    weekStart,
    personalIds.map((id) => ({ id })),
    periodId,
  );
}

export function addToManualWeekRoster(
  area: string,
  weekStart: string,
  personalId: string,
  areaDetalle?: string,
  periodId?: string | null,
): void {
  const next = readManualWeekRosterEntries(area, weekStart, periodId);
  const idx = next.findIndex((e) => e.id === personalId);
  const entry: ManualWeekRosterEntry = {
    id: personalId,
    ...(areaDetalle?.trim() ? { areaDetalle: areaDetalle.trim() } : {}),
  };
  if (idx >= 0) next[idx] = { ...next[idx], ...entry };
  else next.push(entry);
  writeManualWeekRosterEntries(area, weekStart, next, periodId);
}

export function removeFromManualWeekRoster(
  area: string,
  weekStart: string,
  personalId: string,
  periodId?: string | null,
): void {
  writeManualWeekRosterEntries(
    area,
    weekStart,
    readManualWeekRosterEntries(area, weekStart, periodId).filter((e) => e.id !== personalId),
    periodId,
  );
}

export function mergeManualWeekRosterIds(
  area: string,
  weekStart: string,
  personalIds: string[],
  periodId?: string | null,
): void {
  if (!personalIds.length) return;
  const existing = readManualWeekRosterEntries(area, weekStart, periodId);
  const byId = new Map(existing.map((e) => [e.id, e]));
  for (const id of personalIds) {
    if (!id) continue;
    if (!byId.has(id)) byId.set(id, { id });
  }
  writeManualWeekRosterEntries(area, weekStart, [...byId.values()], periodId);
}

export function clearManualWeekRoster(
  area: string,
  weekStart: string,
  periodId?: string | null,
): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(manualWeekRosterKey(area, weekStart, periodId));
  } catch {
    /* ignore */
  }
}

function operationalWeekEmptyKey(area: string, weekStart: string): string {
  return `nomina-operational-week-empty-v1-${area}-${weekStart}`;
}

/** Marca la semana operativa como vaciada (sin auto-incluir todo el personal del área). */
export function markOperationalWeekEmptied(
  area: string,
  weekStart: string,
  emptied: boolean,
): void {
  if (typeof window === 'undefined') return;
  try {
    const key = operationalWeekEmptyKey(area, weekStart);
    if (emptied) localStorage.setItem(key, '1');
    else localStorage.removeItem(key);
  } catch {
    /* quota / private mode */
  }
}

export function isOperationalWeekEmptied(area: string, weekStart: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(operationalWeekEmptyKey(area, weekStart)) === '1';
  } catch {
    return false;
  }
}
