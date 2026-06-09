import type { ParsedNominaPeriod } from '@/lib/nomina/types';
import {
  type IdentityCase,
  makeWorkerRowRef,
} from '@/lib/nomina/worker-identity-cases';

/** Aplica resoluciones confirmadas al periodo (muta el clon recibido). */
export function applyIdentityResolutions(
  period: ParsedNominaPeriod,
  cases: IdentityCase[],
): ParsedNominaPeriod {
  const refToCedula = new Map<string, string>();

  for (const caseItem of cases) {
    if (caseItem.status !== 'confirmed' || !caseItem.resolution) continue;
    for (const ref of caseItem.rowRefs) {
      refToCedula.set(ref, caseItem.resolution.cedula);
    }
    refToCedula.set(caseItem.id, caseItem.resolution.cedula);
  }

  const workerCedulas = new Set<string>();

  for (const section of period.sections) {
    section.rows.forEach((row, rowIndex) => {
      if (!row._valid) return;
      const ref = makeWorkerRowRef(section.id, row, rowIndex);
      const resolvedCedula = refToCedula.get(ref);
      if (resolvedCedula) {
        row.cedula = resolvedCedula;
      }
      workerCedulas.add(row.cedula);
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

    const ref = makeWorkerRowRef(flat.sectionId, flat.worker, 0);
    const resolvedCedula = refToCedula.get(ref);
    if (resolvedCedula) {
      flat.worker.cedula = resolvedCedula;
    }
  }

  period.stats.workerCount = workerCedulas.size;

  return period;
}
