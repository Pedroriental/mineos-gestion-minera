import type { ParsedNominaPeriod } from '@/lib/nomina/types';
import { makeWorkerRowRef } from '@/lib/nomina/worker-identity-cases';
import { normalizeWorkerName, type WorkerMatchRecord } from '@/lib/nomina/worker-match';

export type ImportAliasRecord = {
  id: string;
  alias_nombre_normalizado: string;
  alias_cedula_excel: string;
  personal_id: string;
  source?: string;
  created_at?: string;
};

export function aliasLookupKey(nombre: string, cedula?: string | null): string {
  return `${normalizeWorkerName(nombre)}|${cedula ?? ''}`;
}

export function buildAliasMap(aliases: ImportAliasRecord[]): Map<string, ImportAliasRecord> {
  const map = new Map<string, ImportAliasRecord>();
  for (const alias of aliases) {
    map.set(
      aliasLookupKey(alias.alias_nombre_normalizado, alias.alias_cedula_excel),
      alias,
    );
    if (alias.alias_cedula_excel) {
      const nameOnlyKey = aliasLookupKey(alias.alias_nombre_normalizado, '');
      if (!map.has(nameOnlyKey)) {
        map.set(nameOnlyKey, alias);
      }
    }
  }
  return map;
}

export function findAliasForRow(
  nombre: string,
  cedula: string,
  aliasMap: Map<string, ImportAliasRecord>,
): ImportAliasRecord | null {
  return (
    aliasMap.get(aliasLookupKey(nombre, cedula)) ??
    aliasMap.get(aliasLookupKey(nombre, '')) ??
    null
  );
}

export type AliasApplication = {
  rowRef: string;
  aliasId: string;
  excelNombre: string;
  excelCedula: string;
  worker: WorkerMatchRecord;
};

/** Aplica alias guardados al periodo (muta el clon). */
export function applyImportAliases(
  period: ParsedNominaPeriod,
  aliases: ImportAliasRecord[],
  workersById: Map<string, WorkerMatchRecord>,
): { applications: AliasApplication[]; appliedRowRefs: Set<string> } {
  if (!aliases.length) {
    return { applications: [], appliedRowRefs: new Set() };
  }

  const aliasMap = buildAliasMap(aliases);
  const applications: AliasApplication[] = [];
  const appliedRowRefs = new Set<string>();

  for (const section of period.sections) {
    section.rows.forEach((row, rowIndex) => {
      if (!row._valid) return;

      const alias = findAliasForRow(row.nombre_completo, row.cedula, aliasMap);
      if (!alias) return;

      const worker = workersById.get(alias.personal_id);
      if (!worker) return;

      const rowRef = makeWorkerRowRef(section.id, row, rowIndex);
      row.cedula = worker.cedula;
      appliedRowRefs.add(rowRef);
      applications.push({
        rowRef,
        aliasId: alias.id,
        excelNombre: row.nombre_completo,
        excelCedula: alias.alias_cedula_excel ?? row.cedula,
        worker,
      });
    });
  }

  for (const flat of period.flatCells) {
    const section = period.sections.find((s) => s.id === flat.sectionId);
    if (!section) continue;

    const rowIndex = section.rows.findIndex(
      (r) =>
        r._valid &&
        r.nombre_completo === flat.worker.nombre_completo &&
        (r.sourceRowIndex === flat.worker.sourceRowIndex ||
          (r.sourceRowIndex == null && flat.worker.sourceRowIndex == null)),
    );

    if (rowIndex >= 0) {
      flat.worker.cedula = section.rows[rowIndex].cedula;
      continue;
    }

    const alias = findAliasForRow(flat.worker.nombre_completo, flat.worker.cedula, aliasMap);
    const worker = alias ? workersById.get(alias.personal_id) : undefined;
    if (worker) flat.worker.cedula = worker.cedula;
  }

  const workerCedulas = new Set<string>();
  for (const section of period.sections) {
    for (const row of section.rows) {
      if (row._valid) workerCedulas.add(row.cedula);
    }
  }
  period.stats.workerCount = workerCedulas.size;

  return { applications, appliedRowRefs };
}

export function buildAliasUpsertRows(
  cases: Array<{
    excelNombre: string;
    excelCedula: string;
    status: string;
    resolution?: { personalId: string; action: string };
  }>,
  userId?: string,
): Array<{
  alias_nombre_normalizado: string;
  alias_cedula_excel: string;
  personal_id: string;
  source: string;
  created_by?: string;
}> {
  const rows: Array<{
    alias_nombre_normalizado: string;
    alias_cedula_excel: string;
    personal_id: string;
    source: string;
    created_by?: string;
  }> = [];

  for (const caseItem of cases) {
    if (caseItem.status !== 'confirmed' || !caseItem.resolution) continue;
    if (!caseItem.resolution.personalId) continue;
    if (caseItem.resolution.action === 'create_new') continue;

    rows.push({
      alias_nombre_normalizado: normalizeWorkerName(caseItem.excelNombre),
      alias_cedula_excel: caseItem.excelCedula || '',
      personal_id: caseItem.resolution.personalId,
      source: 'nomina_historico',
      ...(userId ? { created_by: userId } : {}),
    });
  }

  return rows;
}
