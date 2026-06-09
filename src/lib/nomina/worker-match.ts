import type { ParsedNominaPeriod, ParsedWorkerRow } from '@/lib/nomina/types';

export type WorkerMatchRecord = {
  id?: string;
  cedula: string;
  nombre_completo: string;
};

export type WorkerMatchKind = 'matched' | 'corrected' | 'unmatched' | 'ambiguous';

export type WorkerMatchWarning = {
  nombre: string;
  excelCedula: string;
  resolvedCedula: string;
  kind: WorkerMatchKind;
  message: string;
};

export type WorkerMatchResult = {
  period: ParsedNominaPeriod;
  warnings: WorkerMatchWarning[];
  correctedCount: number;
  unmatchedCount: number;
};

/** Normaliza nombre para comparación (sin acentos, minúsculas, solo alfanumérico). */
export function normalizeWorkerName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export type WorkerLookup = {
  byName: Map<string, WorkerMatchRecord>;
  byCedula: Map<string, WorkerMatchRecord>;
  duplicateNames: Set<string>;
};

export function buildWorkerLookup(workers: WorkerMatchRecord[]): WorkerLookup {
  const byName = new Map<string, WorkerMatchRecord>();
  const byCedula = new Map<string, WorkerMatchRecord>();
  const nameCounts = new Map<string, number>();

  for (const w of workers) {
    const key = normalizeWorkerName(w.nombre_completo);
    if (!key) continue;
    nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1);
    byName.set(key, w);
    if (w.cedula) byCedula.set(w.cedula, w);
  }

  const duplicateNames = new Set(
    [...nameCounts.entries()].filter(([, n]) => n > 1).map(([k]) => k),
  );

  return { byName, byCedula, duplicateNames };
}

function isSyntheticCedula(cedula: string): boolean {
  return /^SC-/i.test(cedula);
}

export function resolveRowWorker(
  row: Pick<ParsedWorkerRow, 'nombre_completo' | 'cedula'>,
  lookup: WorkerLookup,
): { cedula: string; kind: WorkerMatchKind; message?: string } {
  const excelCedula = row.cedula;
  const nameKey = normalizeWorkerName(row.nombre_completo);

  if (!nameKey) {
    return {
      cedula: excelCedula,
      kind: 'unmatched',
      message: `Sin nombre válido para vincular con la Base de Trabajadores.`,
    };
  }

  if (lookup.duplicateNames.has(nameKey)) {
    return {
      cedula: excelCedula,
      kind: 'ambiguous',
      message: `Nombre ambiguo en la base: varios trabajadores coinciden con «${row.nombre_completo}».`,
    };
  }

  const byName = lookup.byName.get(nameKey);
  if (byName) {
    const dbCedula = byName.cedula;
    if (excelCedula === dbCedula || (isSyntheticCedula(excelCedula) && dbCedula)) {
      return { cedula: dbCedula, kind: 'matched' };
    }
    return {
      cedula: dbCedula,
      kind: 'corrected',
      message: `Cédula del archivo (${excelCedula}) corregida a ${dbCedula} según Base de Trabajadores para «${row.nombre_completo}».`,
    };
  }

  const byCedula = lookup.byCedula.get(excelCedula);
  if (byCedula && !isSyntheticCedula(excelCedula)) {
    const dbName = normalizeWorkerName(byCedula.nombre_completo);
    if (dbName !== nameKey) {
      return {
        cedula: excelCedula,
        kind: 'unmatched',
        message: `«${row.nombre_completo}» no está en la base; la cédula ${excelCedula} pertenece a «${byCedula.nombre_completo}». Revise el nombre o registre al trabajador.`,
      };
    }
  }

  return {
    cedula: excelCedula,
    kind: 'unmatched',
    message: `«${row.nombre_completo}» no encontrado en la Base de Trabajadores.`,
  };
}

/** Asigna cédulas reales por nombre (doble filtro nombre + validación cédula). */
export function resolvePeriodWorkers(
  period: ParsedNominaPeriod,
  workers: WorkerMatchRecord[],
): WorkerMatchResult {
  if (!workers.length) {
    return { period, warnings: [], correctedCount: 0, unmatchedCount: 0 };
  }

  const lookup = buildWorkerLookup(workers);
  const warnings: WorkerMatchWarning[] = [];
  let correctedCount = 0;
  let unmatchedCount = 0;
  const workerSet = new Set<string>();
  const seen = new WeakSet<ParsedWorkerRow>();
  const warnedNames = new Set<string>();

  const applyResolution = (row: ParsedWorkerRow) => {
    if (!row._valid || seen.has(row)) return;
    seen.add(row);

    const excelCedula = row.cedula;
    const resolved = resolveRowWorker(row, lookup);

    if (resolved.cedula !== excelCedula) {
      row.cedula = resolved.cedula;
    }

    if (!warnedNames.has(row.nombre_completo)) {
      warnedNames.add(row.nombre_completo);
      if (resolved.kind === 'corrected') {
        correctedCount += 1;
        warnings.push({
          nombre: row.nombre_completo,
          excelCedula,
          resolvedCedula: resolved.cedula,
          kind: 'corrected',
          message: resolved.message!,
        });
      } else if (resolved.kind === 'unmatched' || resolved.kind === 'ambiguous') {
        unmatchedCount += 1;
        warnings.push({
          nombre: row.nombre_completo,
          excelCedula,
          resolvedCedula: resolved.cedula,
          kind: resolved.kind,
          message: resolved.message!,
        });
      }
    }

    workerSet.add(row.cedula);
  };

  for (const section of period.sections) {
    for (const row of section.rows) {
      applyResolution(row);
    }
  }

  for (const flat of period.flatCells) {
    applyResolution(flat.worker);
  }

  period.stats.workerCount = workerSet.size;

  const matchWarnings = warnings.map((w) => w.message);
  period.stats.warnings = [...period.stats.warnings, ...matchWarnings];

  return { period, warnings, correctedCount, unmatchedCount };
}
