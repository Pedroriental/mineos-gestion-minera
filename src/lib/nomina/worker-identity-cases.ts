import type { ParsedNominaPeriod, ParsedWorkerRow } from '@/lib/nomina/types';
import {
  applyImportAliases,
  type AliasApplication,
  type ImportAliasRecord,
} from '@/lib/nomina/worker-alias';
import { validateAllResolutionPolicies } from '@/lib/nomina/worker-identity-policy';
import {
  findFuzzyWorkerCandidates,
  mergeWorkerCandidates,
  type FuzzyWorkerCandidate,
} from '@/lib/nomina/worker-name-fuzzy';
import {
  buildWorkerLookup,
  normalizeWorkerName,
  resolveRowWorker,
  type WorkerMatchRecord,
} from '@/lib/nomina/worker-match';

export type IdentityCaseKind =
  | 'cedula_corrected'
  | 'cedula_shared'
  | 'name_not_in_base'
  | 'cedula_conflict'
  | 'ambiguous_name';

export type IdentityResolutionAction =
  | 'use_suggested'
  | 'pick_candidate'
  | 'keep_excel'
  | 'create_new';

export type IdentityResolution = {
  personalId: string;
  cedula: string;
  nombre: string;
  action: IdentityResolutionAction;
};

export type IdentityCaseStatus = 'pending' | 'confirmed' | 'skipped';

export type IdentityCase = {
  id: string;
  kind: IdentityCaseKind;
  excelNombre: string;
  excelCedula: string;
  suggested?: WorkerMatchRecord;
  candidates?: WorkerMatchRecord[];
  sectionTitle?: string;
  sectionCargo?: string;
  rowTotal?: number;
  rowRefs: string[];
  sharedCedulaGroup?: string;
  status: IdentityCaseStatus;
  resolution?: IdentityResolution;
  resolvedViaAlias?: boolean;
  aliasId?: string;
  fuzzyCandidates?: FuzzyWorkerCandidate[];
};

export type IdentitySummaryFilter =
  | 'all'
  | 'matched'
  | 'corrected'
  | 'shared'
  | 'unknown'
  | 'conflict'
  | 'alias'
  | 'pending';

export type IdentitySummary = {
  totalWorkers: number;
  autoMatched: number;
  corrected: number;
  shared: number;
  unknown: number;
  conflict: number;
  aliasResolved: number;
  pending: number;
};

export type IdentityImportPrep = {
  periodForMatching: ParsedNominaPeriod;
  cases: IdentityCase[];
  aliasApplications: AliasApplication[];
  summary: IdentitySummary;
};

export function makeWorkerRowRef(
  sectionId: string,
  row: ParsedWorkerRow,
  rowIndex: number,
): string {
  return `${sectionId}::${row.sourceRowIndex ?? rowIndex}::${normalizeWorkerName(row.nombre_completo)}`;
}

function isSyntheticCedula(cedula: string): boolean {
  return /^SC-/i.test(cedula);
}

function getAmbiguousCandidates(
  workers: WorkerMatchRecord[],
  nameKey: string,
): WorkerMatchRecord[] {
  return workers.filter((w) => normalizeWorkerName(w.nombre_completo) === nameKey);
}

function classifyUnmatchedKind(
  row: Pick<ParsedWorkerRow, 'nombre_completo' | 'cedula'>,
  lookup: ReturnType<typeof buildWorkerLookup>,
): IdentityCaseKind {
  const excelCedula = row.cedula;
  const nameKey = normalizeWorkerName(row.nombre_completo);
  const byCedula = lookup.byCedula.get(excelCedula);

  if (byCedula && !isSyntheticCedula(excelCedula)) {
    const dbName = normalizeWorkerName(byCedula.nombre_completo);
    if (dbName !== nameKey) {
      return 'cedula_conflict';
    }
  }

  return 'name_not_in_base';
}

function mapMatchKindToCaseKind(
  matchKind: ReturnType<typeof resolveRowWorker>['kind'],
  row: ParsedWorkerRow,
  lookup: ReturnType<typeof buildWorkerLookup>,
): IdentityCaseKind | null {
  switch (matchKind) {
    case 'matched':
      return null;
    case 'corrected':
      return 'cedula_corrected';
    case 'ambiguous':
      return 'ambiguous_name';
    case 'unmatched':
      return classifyUnmatchedKind(row, lookup);
    default:
      return null;
  }
}

export function countValidWorkers(period: ParsedNominaPeriod): number {
  return period.sections.reduce(
    (n, section) => n + section.rows.filter((row) => row._valid).length,
    0,
  );
}

export function computeIdentitySummary(
  period: ParsedNominaPeriod,
  cases: IdentityCase[],
  aliasResolved = 0,
): IdentitySummary {
  const totalWorkers = countValidWorkers(period);
  const pending = countPendingIdentityCases(cases);
  const corrected = cases.filter(
    (c) => c.kind === 'cedula_corrected' && !c.resolvedViaAlias,
  ).length;
  const shared = cases.filter((c) => c.kind === 'cedula_shared').length;
  const unknown = cases.filter((c) => c.kind === 'name_not_in_base').length;
  const conflict = cases.filter(
    (c) => c.kind === 'cedula_conflict' || c.kind === 'ambiguous_name',
  ).length;
  const manualCases = cases.length;
  const autoMatched = Math.max(0, totalWorkers - manualCases - aliasResolved);

  return {
    totalWorkers,
    autoMatched,
    corrected,
    shared,
    unknown,
    conflict,
    aliasResolved,
    pending,
  };
}

export function caseMatchesFilter(
  caseItem: IdentityCase,
  filter: IdentitySummaryFilter,
): boolean {
  if (filter === 'all') return true;
  if (filter === 'pending') return caseItem.status === 'pending';
  if (filter === 'alias') return Boolean(caseItem.resolvedViaAlias);
  if (filter === 'corrected') return caseItem.kind === 'cedula_corrected';
  if (filter === 'shared') return caseItem.kind === 'cedula_shared';
  if (filter === 'unknown') return caseItem.kind === 'name_not_in_base';
  if (filter === 'conflict') {
    return caseItem.kind === 'cedula_conflict' || caseItem.kind === 'ambiguous_name';
  }
  return false;
}

export function workerNameMatchesIdentityFilter(
  nombre: string,
  cases: IdentityCase[],
  filter: IdentitySummaryFilter,
): boolean {
  if (filter === 'all' || filter === 'matched') return true;
  if (filter === 'alias') return false;
  return cases.some((c) => c.excelNombre === nombre && caseMatchesFilter(c, filter));
}

/** Detecta filas que requieren confirmación manual antes de importar. No muta el periodo original. */
export function buildIdentityCases(
  period: ParsedNominaPeriod,
  workers: WorkerMatchRecord[],
  options?: { skipRowRefs?: Set<string> },
): IdentityCase[] {
  if (!workers.length) return [];

  const lookup = buildWorkerLookup(workers);
  const cases: IdentityCase[] = [];
  const cedulaToNames = new Map<string, Set<string>>();
  const skipRowRefs = options?.skipRowRefs;

  for (const section of period.sections) {
    section.rows.forEach((row, rowIndex) => {
      if (!row._valid) return;

      const rowRef = makeWorkerRowRef(section.id, row, rowIndex);
      if (skipRowRefs?.has(rowRef)) return;

      const nameKey = normalizeWorkerName(row.nombre_completo);
      if (!cedulaToNames.has(row.cedula)) {
        cedulaToNames.set(row.cedula, new Set());
      }
      if (nameKey) cedulaToNames.get(row.cedula)!.add(nameKey);

      const match = resolveRowWorker(row, lookup);
      const caseKind = mapMatchKindToCaseKind(match.kind, row, lookup);
      if (!caseKind) return;

      const nameKeyNorm = normalizeWorkerName(row.nombre_completo);
      const suggested = lookup.byName.get(nameKeyNorm);
      const baseCandidates =
        caseKind === 'ambiguous_name'
          ? getAmbiguousCandidates(workers, nameKeyNorm)
          : caseKind === 'cedula_conflict'
            ? [...lookup.byCedula.values()]
            : undefined;

      const fuzzyCandidates =
        caseKind === 'name_not_in_base' || caseKind === 'cedula_conflict'
          ? findFuzzyWorkerCandidates(row.nombre_completo, workers)
          : [];

      const candidates = mergeWorkerCandidates(baseCandidates, fuzzyCandidates);

      cases.push({
        id: rowRef,
        kind: caseKind,
        excelNombre: row.nombre_completo,
        excelCedula: row.cedula,
        suggested: suggested ?? fuzzyCandidates[0]?.worker,
        candidates: candidates.length ? candidates : undefined,
        fuzzyCandidates: fuzzyCandidates.length ? fuzzyCandidates : undefined,
        sectionTitle: section.title,
        sectionCargo: row.cargo || section.cargo,
        rowTotal: row.total,
        rowRefs: [rowRef],
        status: 'pending',
      });
    });
  }

  const sharedCedulas = new Set(
    [...cedulaToNames.entries()]
      .filter(([, names]) => names.size > 1)
      .map(([cedula]) => cedula),
  );

  for (const caseItem of cases) {
    if (sharedCedulas.has(caseItem.excelCedula)) {
      caseItem.sharedCedulaGroup = caseItem.excelCedula;
      if (caseItem.kind === 'cedula_corrected') {
        caseItem.kind = 'cedula_shared';
      }
    }
  }

  return cases;
}

/** Aplica alias y construye casos pendientes sobre el periodo ya parcialmente resuelto. */
export function prepareIdentityImport(
  rawPeriod: ParsedNominaPeriod,
  workers: WorkerMatchRecord[],
  aliases: ImportAliasRecord[] = [],
): IdentityImportPrep {
  const periodForMatching = structuredClone(rawPeriod) as ParsedNominaPeriod;
  const workersById = new Map(
    workers.filter((w) => w.id).map((w) => [w.id!, w]),
  );

  const { applications, appliedRowRefs } = applyImportAliases(
    periodForMatching,
    aliases,
    workersById,
  );

  const cases = buildIdentityCases(periodForMatching, workers, {
    skipRowRefs: appliedRowRefs,
  });

  const summary = computeIdentitySummary(
    rawPeriod,
    cases,
    applications.length,
  );

  return {
    periodForMatching,
    cases,
    aliasApplications: applications,
    summary,
  };
}

export function countPendingIdentityCases(cases: IdentityCase[]): number {
  return cases.filter((c) => c.status === 'pending').length;
}

export function validateIdentityCasesComplete(cases: IdentityCase[]): {
  ok: boolean;
  message?: string;
} {
  const pending = countPendingIdentityCases(cases);
  if (pending > 0) {
    return {
      ok: false,
      message: `Faltan ${pending} resolución${pending === 1 ? '' : 'es'} de identidad pendiente${pending === 1 ? '' : 's'}.`,
    };
  }
  return { ok: true };
}

export function confirmIdentityCase(
  caseItem: IdentityCase,
  action: IdentityResolutionAction,
  worker?: WorkerMatchRecord,
): IdentityCase {
  if (action === 'use_suggested' && caseItem.suggested) {
    return {
      ...caseItem,
      status: 'confirmed',
      resolution: {
        personalId: caseItem.suggested.id ?? '',
        cedula: caseItem.suggested.cedula,
        nombre: caseItem.suggested.nombre_completo,
        action,
      },
    };
  }

  if (action === 'pick_candidate' && worker) {
    return {
      ...caseItem,
      status: 'confirmed',
      resolution: {
        personalId: worker.id ?? '',
        cedula: worker.cedula,
        nombre: worker.nombre_completo,
        action,
      },
    };
  }

  if (action === 'create_new' || action === 'keep_excel') {
    return {
      ...caseItem,
      status: 'confirmed',
      resolution: {
        personalId: '',
        cedula: caseItem.excelCedula,
        nombre: caseItem.excelNombre,
        action,
      },
    };
  }

  return caseItem;
}

export function validateClientIdentityCases(
  serverCases: IdentityCase[],
  clientCases: IdentityCase[],
): { ok: boolean; message?: string } {
  const completeness = validateIdentityCasesComplete(clientCases);
  if (!completeness.ok) return completeness;

  for (const serverCase of serverCases) {
    const clientCase = clientCases.find((c) => c.id === serverCase.id);
    if (!clientCase || clientCase.status !== 'confirmed' || !clientCase.resolution) {
      return {
        ok: false,
        message: `Falta confirmar la identidad de «${serverCase.excelNombre}».`,
      };
    }
  }

  const policyValidation = validateAllResolutionPolicies(clientCases);
  if (!policyValidation.ok) return policyValidation;

  return { ok: true };
}
