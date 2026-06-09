'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { applyIdentityResolutions } from '@/lib/nomina/apply-identity-resolutions';
import { applyImportAliases, type ImportAliasRecord } from '@/lib/nomina/worker-alias';
import {
  countPendingIdentityCases,
  prepareIdentityImport,
  type IdentityCase,
  type IdentitySummaryFilter,
} from '@/lib/nomina/worker-identity-cases';
import type { WorkerMatchRecord } from '@/lib/nomina/worker-match';
import type { ParsedNominaPeriod } from '@/lib/nomina/types';
import { getImportAliasesAction, getPersonalMapAction } from '@/lib/actions/nomina-actions';

export function useNominaImportIdentity(initialPeriod: ParsedNominaPeriod | null = null) {
  const [rawPeriod, setRawPeriod] = useState<ParsedNominaPeriod | null>(initialPeriod);
  const [identityCases, setIdentityCases] = useState<IdentityCase[]>([]);
  const [existingPersonal, setExistingPersonal] = useState<WorkerMatchRecord[]>([]);
  const [importAliases, setImportAliases] = useState<ImportAliasRecord[]>([]);
  const [aliasResolvedCount, setAliasResolvedCount] = useState(0);
  const [identityFilter, setIdentityFilter] = useState<IdentitySummaryFilter>('all');
  const [resourcesReady, setResourcesReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getPersonalMapAction(), getImportAliasesAction()]).then(([workersRes, aliasesRes]) => {
      if (cancelled) return;
      if (workersRes.ok && workersRes.data) setExistingPersonal(workersRes.data);
      if (aliasesRes.ok && aliasesRes.data) setImportAliases(aliasesRes.data);
      setResourcesReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const period = useMemo(() => {
    if (!rawPeriod) return null;
    const clone = structuredClone(rawPeriod) as ParsedNominaPeriod;
    const workersById = new Map(
      existingPersonal.filter((w) => w.id).map((w) => [w.id!, w]),
    );
    if (importAliases.length) {
      applyImportAliases(clone, importAliases, workersById);
    }
    if (identityCases.length > 0) {
      applyIdentityResolutions(clone, identityCases);
    }
    return clone;
  }, [rawPeriod, identityCases, importAliases, existingPersonal]);

  const pendingIdentityCount = useMemo(
    () => countPendingIdentityCases(identityCases),
    [identityCases],
  );

  const workerWarningsByName = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of identityCases) {
      if (c.status !== 'confirmed' || !c.resolution) continue;
      if (c.resolution.cedula !== c.excelCedula) {
        map.set(
          c.excelNombre,
          `Cédula confirmada: ${c.excelCedula} → ${c.resolution.cedula}`,
        );
      }
    }
    return map;
  }, [identityCases]);

  const applyIdentityPrep = useCallback(
    (parsed: ParsedNominaPeriod, workers = existingPersonal, aliases = importAliases) => {
      const prep = prepareIdentityImport(parsed, workers, aliases);
      setRawPeriod(parsed);
      setIdentityCases(prep.cases);
      setAliasResolvedCount(prep.aliasApplications.length);
      setIdentityFilter('all');
      return prep;
    },
    [existingPersonal, importAliases],
  );

  const bootstrapFromPeriod = useCallback(
    (parsed: ParsedNominaPeriod) => {
      if (!existingPersonal.length && !importAliases.length) {
        setRawPeriod(parsed);
        setIdentityCases([]);
        setAliasResolvedCount(0);
        return { cases: [], aliasApplications: [] };
      }
      return applyIdentityPrep(parsed);
    },
    [applyIdentityPrep, existingPersonal.length, importAliases.length],
  );

  useEffect(() => {
    if (!initialPeriod || !resourcesReady) return;
    bootstrapFromPeriod(initialPeriod);
  }, [initialPeriod, resourcesReady, bootstrapFromPeriod]);

  return {
    rawPeriod,
    setRawPeriod,
    period,
    identityCases,
    setIdentityCases,
    existingPersonal,
    importAliases,
    aliasResolvedCount,
    identityFilter,
    setIdentityFilter,
    pendingIdentityCount,
    workerWarningsByName,
    resourcesReady,
    setExistingPersonal,
    applyIdentityPrep,
    bootstrapFromPeriod,
  };
}
