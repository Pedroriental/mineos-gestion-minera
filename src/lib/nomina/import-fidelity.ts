import { buildImportCommitPayload } from '@/lib/nomina/import-commit';
import type { InferredWorkerProfile, ParsedNominaPeriod } from '@/lib/nomina/types';
import {
  resolvePeriodWorkers,
  type WorkerMatchRecord,
  type WorkerMatchWarning,
} from '@/lib/nomina/worker-match';
import type { Personal } from '@/lib/types';

const MONEY_TOLERANCE = 0.05;
const SOURCE_TOLERANCE = 1;

export type ImportFidelityDroppedWorker = {
  nombre: string;
  cedula: string;
  total: number;
  reason: string;
};

export type ImportFidelityReport = {
  sourceDeclaredTotal: number | null;
  parsedTotal: number;
  commitTotal: number;
  savedTotal: number | null;
  workerCountParsed: number;
  workerCountValid: number;
  workerCountCommit: number;
  workerCountSaved: number | null;
  registrosCommit: number;
  registrosSaved: number | null;
  duplicateCellCount: number;
  deltas: {
    sourceToParsed: number | null;
    parsedToCommit: number;
    commitToSaved: number | null;
  };
  status: 'ok' | 'warn' | 'error';
  issues: string[];
  droppedWorkers: ImportFidelityDroppedWorker[];
  workerMatchWarnings?: WorkerMatchWarning[];
  workerMatchCorrected?: number;
  workerMatchUnmatched?: number;
};

function roundMoney(n: number): number {
  return parseFloat(n.toFixed(2));
}

function moneyDelta(a: number, b: number): number {
  return roundMoney(b - a);
}

function withinTolerance(delta: number, tolerance: number): boolean {
  return Math.abs(delta) <= tolerance;
}

function resolveStatus(report: Omit<ImportFidelityReport, 'status'>): ImportFidelityReport['status'] {
  const moneyIssues =
    (report.deltas.sourceToParsed != null &&
      !withinTolerance(report.deltas.sourceToParsed, SOURCE_TOLERANCE)) ||
    !withinTolerance(report.deltas.parsedToCommit, MONEY_TOLERANCE) ||
    (report.deltas.commitToSaved != null &&
      !withinTolerance(report.deltas.commitToSaved, MONEY_TOLERANCE));

  const workerIssues =
    report.droppedWorkers.length > 0 ||
    (report.workerMatchUnmatched ?? 0) > 0 ||
    (report.workerCountSaved != null && report.workerCountSaved < report.workerCountCommit);

  if (moneyIssues || report.droppedWorkers.some((w) => w.total >= 50)) return 'error';
  if (workerIssues || report.duplicateCellCount > 0) return 'warn';
  if (report.deltas.sourceToParsed != null && Math.abs(report.deltas.sourceToParsed) > 0) {
    return withinTolerance(report.deltas.sourceToParsed, SOURCE_TOLERANCE) ? 'ok' : 'warn';
  }
  return 'ok';
}

export function buildImportFidelityReport(
  period: ParsedNominaPeriod,
  profiles: InferredWorkerProfile[],
  options?: {
    existingPersonal?: Map<string, Personal>;
    idByCedula?: Map<string, string>;
    workersBase?: WorkerMatchRecord[];
  },
): ImportFidelityReport {
  const workerMatch = options?.workersBase?.length
    ? resolvePeriodWorkers(
        structuredClone(period) as ParsedNominaPeriod,
        options.workersBase,
      )
    : null;
  const resolvedPeriod = workerMatch?.period ?? period;

  const allRows = resolvedPeriod.sections.flatMap((s) => s.rows);
  const validRows = allRows.filter((r) => r._valid);
  const invalidRows = allRows.filter((r) => !r._valid);

  const commitPlan = buildImportCommitPayload(resolvedPeriod, profiles, {
    existingPersonal: options?.existingPersonal,
  });

  const commitTotal = roundMoney(
    commitPlan.semanas.reduce(
      (sum, semana) => sum + semana.registros.reduce((n, r) => n + r.monto_pagado, 0),
      0,
    ),
  );

  const cellKeys = new Map<string, number>();
  let duplicateCellCount = 0;
  for (const flat of resolvedPeriod.flatCells) {
    const key = `${flat.worker.cedula}|${flat.weekStart}`;
    const prev = cellKeys.get(key) ?? 0;
    if (prev > 0) duplicateCellCount += 1;
    cellKeys.set(key, prev + flat.cell.amount);
  }

  const commitCedulas = new Set(commitPlan.personal.map((p) => p.cedula));
  const droppedWorkers: ImportFidelityDroppedWorker[] = [];

  for (const row of invalidRows) {
    if (row.total <= 0) continue;
    droppedWorkers.push({
      nombre: row.nombre_completo,
      cedula: row.cedula || '—',
      total: row.total,
      reason: row._error ?? 'Cédula inválida o fila incompleta',
    });
  }

  for (const row of validRows) {
    if (commitCedulas.has(row.cedula)) continue;
    droppedWorkers.push({
      nombre: row.nombre_completo,
      cedula: row.cedula,
      total: row.total,
      reason: 'No entra en el plan de importación',
    });
  }

  let savedTotal: number | null = null;
  let registrosSaved: number | null = null;
  let workerCountSaved: number | null = null;

  if (options?.idByCedula) {
    const savedCedulas = new Set<string>();
    let registros = 0;
    savedTotal = 0;
    for (const semana of commitPlan.semanas) {
      for (const reg of semana.registros) {
        if (!options.idByCedula.get(reg.cedula)) continue;
        savedTotal += reg.monto_pagado;
        registros += 1;
        savedCedulas.add(reg.cedula);
      }
    }
    savedTotal = roundMoney(savedTotal);
    registrosSaved = registros;
    workerCountSaved = savedCedulas.size;
  }

  const sourceDeclaredTotal = resolvedPeriod.stats.declaredSourceTotal ?? null;
  const parsedTotal = resolvedPeriod.grandTotal;
  const parsedToCommit = moneyDelta(parsedTotal, commitTotal);
  const sourceToParsed =
    sourceDeclaredTotal != null ? moneyDelta(sourceDeclaredTotal, parsedTotal) : null;
  const commitToSaved = savedTotal != null ? moneyDelta(commitTotal, savedTotal) : null;

  const issues: string[] = [];
  if (options?.existingPersonal) {
    for (const row of validRows) {
      const existing = options.existingPersonal.get(row.cedula);
      if (existing) {
        const est = existing.estado_laboral;
        const causa = existing.despido_causa || existing.observacion_estado || '';
        const isAutoRotation = est === 'VACACIONES' && causa.includes('[auto-rotación]');
        
        if ((est === 'DESPEDIDO' || est === 'REPOSO' || est === 'VACACIONES') && !isAutoRotation) {
          const causaStr = causa ? ` por causa: "${causa}"` : '';
          issues.push(
            `⚠️ El trabajador ${existing.nombre_completo} (C.I. ${existing.cedula}) figura anteriormente como ${est}${causaStr}. Se cargará su pago e historial igualmente.`,
          );
        }
      }
    }
  }

  if (sourceToParsed != null && !withinTolerance(sourceToParsed, SOURCE_TOLERANCE)) {
    issues.push(
      `El total extraído difiere del impreso en el archivo en $${Math.abs(sourceToParsed).toFixed(2)}.`,
    );
  }
  if (!withinTolerance(parsedToCommit, MONEY_TOLERANCE)) {
    issues.push(
      `El total a importar difiere del extraído en $${Math.abs(parsedToCommit).toFixed(2)}.`,
    );
  }
  if (commitToSaved != null && !withinTolerance(commitToSaved, MONEY_TOLERANCE)) {
    issues.push(
      `El total guardado difiere del plan de importación en $${Math.abs(commitToSaved).toFixed(2)}.`,
    );
  }
  if (invalidRows.length > 0) {
    issues.push(`${invalidRows.length} fila(s) con cédula inválida u omitida en el parseo.`);
  }
  if (droppedWorkers.length > 0) {
    const lost = roundMoney(droppedWorkers.reduce((n, w) => n + w.total, 0));
    issues.push(
      `${droppedWorkers.length} trabajador(es) no se importarán (~$${lost.toFixed(2)}).`,
    );
  }
  if (duplicateCellCount > 0) {
    issues.push(`${duplicateCellCount} celda(s) duplicada(s) (misma cédula y semana).`);
  }
  if (workerMatch) {
    if (workerMatch.correctedCount > 0) {
      issues.push(
        `${workerMatch.correctedCount} cédula(s) corregida(s) según la Base de Trabajadores (nombre).`,
      );
    }
    if (workerMatch.unmatchedCount > 0) {
      issues.push(
        `${workerMatch.unmatchedCount} trabajador(es) sin coincidencia en la Base de Trabajadores.`,
      );
    }
    for (const w of workerMatch.warnings.filter((x) => x.kind === 'ambiguous')) {
      issues.push(w.message);
    }
  }
  if (
    options?.idByCedula &&
    workerCountSaved != null &&
    workerCountSaved < commitPlan.personal.length
  ) {
    issues.push(
      `${commitPlan.personal.length - workerCountSaved} trabajador(es) no se vincularon por cédula en la base.`,
    );
  }

  const base = {
    sourceDeclaredTotal,
    parsedTotal,
    commitTotal,
    savedTotal,
    workerCountParsed: resolvedPeriod.stats.workerCount,
    workerCountValid: validRows.length,
    workerCountCommit: commitPlan.personal.length,
    workerCountSaved,
    registrosCommit: commitPlan.semanas.reduce((n, s) => n + s.registros.length, 0),
    registrosSaved,
    duplicateCellCount,
    deltas: { sourceToParsed, parsedToCommit, commitToSaved },
    issues,
    droppedWorkers: droppedWorkers.sort((a, b) => b.total - a.total),
    workerMatchWarnings: workerMatch?.warnings,
    workerMatchCorrected: workerMatch?.correctedCount,
    workerMatchUnmatched: workerMatch?.unmatchedCount,
  };

  return { ...base, status: resolveStatus(base) };
}

export function formatFidelityDelta(delta: number | null): string {
  if (delta == null) return '—';
  if (Math.abs(delta) < 0.005) return '±$0,00';
  const sign = delta > 0 ? '+' : '−';
  return `${sign}$${Math.abs(delta).toLocaleString('es', { minimumFractionDigits: 2 })}`;
}
