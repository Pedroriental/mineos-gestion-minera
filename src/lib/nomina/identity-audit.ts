import type { IdentityCase, IdentitySummary } from '@/lib/nomina/worker-identity-cases';
import type { AliasApplication } from '@/lib/nomina/worker-alias';

export type IdentityAuditPayload = {
  summary: IdentitySummary;
  cases: Array<{
    id: string;
    kind: IdentityCase['kind'];
    excelNombre: string;
    excelCedula: string;
    sectionTitle?: string;
    sectionCargo?: string;
    rowTotal?: number;
    status: IdentityCase['status'];
    resolution?: IdentityCase['resolution'];
    resolvedViaAlias?: boolean;
    fuzzyUsed?: boolean;
  }>;
  aliasApplied: number;
  importedAt: string;
};

export function buildIdentityAuditPayload(
  cases: IdentityCase[],
  summary: IdentitySummary,
  aliasApplications: AliasApplication[] = [],
): IdentityAuditPayload {
  return {
    summary,
    cases: cases.map((c) => ({
      id: c.id,
      kind: c.kind,
      excelNombre: c.excelNombre,
      excelCedula: c.excelCedula,
      sectionTitle: c.sectionTitle,
      sectionCargo: c.sectionCargo,
      rowTotal: c.rowTotal,
      status: c.status,
      resolution: c.resolution,
      resolvedViaAlias: c.resolvedViaAlias,
      fuzzyUsed: c.resolution?.action === 'pick_candidate' && Boolean(c.fuzzyCandidates?.length),
    })),
    aliasApplied: aliasApplications.length,
    importedAt: new Date().toISOString(),
  };
}

export function formatIdentityAuditDetail(audit: IdentityAuditPayload): string {
  const s = audit.summary;
  const parts = [
    `Identidad: ${s.autoMatched} auto`,
    s.aliasResolved ? `${s.aliasResolved} alias` : null,
    s.corrected ? `${s.corrected} corregidas` : null,
    s.shared ? `${s.shared} compartidas` : null,
    s.unknown ? `${s.unknown} sin base` : null,
    s.conflict ? `${s.conflict} conflictos` : null,
  ].filter(Boolean);
  return parts.join(' · ');
}
