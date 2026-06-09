'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Link2, UserCheck, Users } from 'lucide-react';
import { AppCombobox } from '@/components/ui/AppCombobox';
import {
  caseMatchesFilter,
  confirmIdentityCase,
  type IdentityCase,
  type IdentityCaseKind,
  type IdentitySummaryFilter,
  countPendingIdentityCases,
} from '@/lib/nomina/worker-identity-cases';
import {
  getIdentityPolicy,
  isActionAllowedForCase,
  resolutionFromPolicy,
} from '@/lib/nomina/worker-identity-policy';
import type { WorkerMatchRecord } from '@/lib/nomina/worker-match';
import { cn } from '@/lib/utils';

const KIND_LABELS: Record<IdentityCaseKind, string> = {
  cedula_corrected: 'Cédula corregida',
  cedula_shared: 'Cédula compartida',
  name_not_in_base: 'No está en la base',
  cedula_conflict: 'Conflicto de cédula',
  ambiguous_name: 'Nombre ambiguo',
};

function kindBadgeClass(kind: IdentityCaseKind): string {
  switch (kind) {
    case 'cedula_shared':
    case 'cedula_corrected':
      return 'bg-amber-500/15 text-amber-300 border-amber-500/25';
    case 'cedula_conflict':
    case 'ambiguous_name':
      return 'bg-rose-500/15 text-rose-300 border-rose-500/25';
    default:
      return 'bg-sky-500/15 text-sky-300 border-sky-500/25';
  }
}

function IdentityCaseRow({
  caseItem,
  workers,
  onConfirm,
}: {
  caseItem: IdentityCase;
  workers: WorkerMatchRecord[];
  onConfirm: (updated: IdentityCase) => void;
}) {
  const [pickerValue, setPickerValue] = useState('');
  const policy = getIdentityPolicy(caseItem.kind);

  const pickerWorkers = useMemo(() => {
    if (caseItem.candidates?.length) return caseItem.candidates;
    return workers;
  }, [caseItem.candidates, workers]);

  const workerOptions = useMemo(
    () =>
      pickerWorkers.map((w) => ({
        value: w.id ?? w.cedula,
        label: `${w.nombre_completo} · ${w.cedula}`,
      })),
    [pickerWorkers],
  );

  const isConfirmed = caseItem.status === 'confirmed';
  const canUseSuggested =
    isActionAllowedForCase(caseItem, 'use_suggested') && Boolean(caseItem.suggested);
  const canCreateNew = isActionAllowedForCase(caseItem, 'create_new');
  const canPick = isActionAllowedForCase(caseItem, 'pick_candidate');

  function applyResolution(
    action: 'use_suggested' | 'pick_candidate' | 'create_new',
    worker?: WorkerMatchRecord,
  ) {
    const resolution = resolutionFromPolicy(caseItem, action, worker);
    if (!resolution) return;
    if (action === 'use_suggested') {
      onConfirm(confirmIdentityCase(caseItem, 'use_suggested'));
      return;
    }
    if (action === 'create_new') {
      onConfirm(confirmIdentityCase(caseItem, 'create_new'));
      return;
    }
    if (worker) {
      onConfirm(confirmIdentityCase(caseItem, 'pick_candidate', worker));
    }
  }

  return (
    <div
      className={cn(
        'rounded-xl border px-4 py-3 transition',
        isConfirmed
          ? 'border-emerald-500/25 bg-emerald-500/5'
          : 'border-white/8 bg-zinc-900/40',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide',
                kindBadgeClass(caseItem.kind),
              )}
            >
              {KIND_LABELS[caseItem.kind]}
            </span>
            {caseItem.resolvedViaAlias ? (
              <span className="inline-flex items-center gap-1 rounded border border-violet-500/25 bg-violet-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-violet-300">
                <Link2 className="h-3 w-3" />
                Alias
              </span>
            ) : null}
            {caseItem.sectionTitle ? (
              <span className="text-[10px] text-zinc-500">{caseItem.sectionTitle}</span>
            ) : null}
            {isConfirmed ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            ) : null}
          </div>

          <p className="mt-1.5 text-sm font-medium text-zinc-100">{caseItem.excelNombre}</p>
          <p className="font-mono text-[10px] text-zinc-500">
            Cédula en archivo: {caseItem.excelCedula}
          </p>
          {caseItem.sectionCargo || caseItem.rowTotal != null ? (
            <p className="mt-0.5 text-[10px] text-zinc-500">
              {caseItem.sectionCargo ? `${caseItem.sectionCargo}` : ''}
              {caseItem.sectionCargo && caseItem.rowTotal != null ? ' · ' : ''}
              {caseItem.rowTotal != null ? `$${caseItem.rowTotal.toFixed(2)}` : ''}
            </p>
          ) : null}

          {caseItem.fuzzyCandidates?.length && !isConfirmed ? (
            <div className="mt-1.5 space-y-0.5">
              <p className="text-[10px] font-medium text-violet-300/90">Sugerencias por similitud:</p>
              {caseItem.fuzzyCandidates.slice(0, 3).map((f) => (
                <p key={f.worker.cedula} className="text-[10px] text-violet-200/70">
                  {f.worker.nombre_completo} ({f.worker.cedula}) — {Math.round(f.score * 100)}%
                </p>
              ))}
            </div>
          ) : null}

          {caseItem.suggested && !isConfirmed ? (
            <p className="mt-1 text-[11px] text-amber-200/90">
              Sugerido: {caseItem.suggested.nombre_completo} ({caseItem.suggested.cedula})
            </p>
          ) : null}

          {policy.requiresPicker && !isConfirmed ? (
            <p className="mt-1 text-[11px] text-rose-200/80">
              Debe elegir el trabajador correcto en la base.
            </p>
          ) : null}

          {isConfirmed && caseItem.resolution ? (
            <p className="mt-1 text-[11px] text-emerald-300/90">
              → {caseItem.resolution.nombre} ({caseItem.resolution.cedula})
            </p>
          ) : null}
        </div>

        {!isConfirmed ? (
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[220px]">
            {canUseSuggested ? (
              <button
                type="button"
                onClick={() => applyResolution('use_suggested')}
                className="btn-primary justify-center py-2 text-[11px]"
              >
                Confirmar sugerido
              </button>
            ) : null}

            {canCreateNew ? (
              <button
                type="button"
                onClick={() => applyResolution('create_new')}
                className="btn-secondary justify-center py-2 text-[11px]"
              >
                Crear registro histórico
              </button>
            ) : null}

            {canPick ? (
              <div className="flex flex-col gap-1.5">
                <AppCombobox
                  value={pickerValue}
                  onChange={setPickerValue}
                  options={workerOptions}
                  placeholder="Elegir trabajador…"
                  className="text-xs"
                />
                <button
                  type="button"
                  onClick={() => {
                    const worker =
                      pickerWorkers.find((w) => (w.id ?? w.cedula) === pickerValue) ??
                      workers.find((w) => (w.id ?? w.cedula) === pickerValue);
                    if (worker) applyResolution('pick_candidate', worker);
                  }}
                  disabled={!pickerValue}
                  className="btn-secondary justify-center py-2 text-[11px] disabled:opacity-40"
                >
                  Usar seleccionado
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function NominaImportIdentityPanel({
  cases,
  workers,
  activeFilter = 'all',
  onChange,
}: {
  cases: IdentityCase[];
  workers: WorkerMatchRecord[];
  activeFilter?: IdentitySummaryFilter;
  onChange: (cases: IdentityCase[]) => void;
}) {
  const pending = countPendingIdentityCases(cases);

  const visibleCases = useMemo(
    () => cases.filter((c) => caseMatchesFilter(c, activeFilter)),
    [cases, activeFilter],
  );

  const grouped = useMemo(() => {
    const sharedGroups = new Map<string, IdentityCase[]>();
    const standalone: IdentityCase[] = [];

    for (const c of visibleCases) {
      if (c.sharedCedulaGroup) {
        const list = sharedGroups.get(c.sharedCedulaGroup) ?? [];
        list.push(c);
        sharedGroups.set(c.sharedCedulaGroup, list);
      } else {
        standalone.push(c);
      }
    }

    return { sharedGroups, standalone };
  }, [visibleCases]);

  function updateCase(updated: IdentityCase) {
    onChange(cases.map((c) => (c.id === updated.id ? updated : c)));
  }

  if (cases.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/8 px-4 py-4 text-sm text-emerald-200">
        <UserCheck className="h-5 w-5 shrink-0" />
        Todos los trabajadores coinciden con la Base de Trabajadores.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/8 px-4 py-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        <div className="text-xs leading-relaxed text-amber-100">
          <p className="font-semibold text-amber-200">
            {cases.length} caso{cases.length === 1 ? '' : 's'} requiere{cases.length === 1 ? '' : 'n'}{' '}
            confirmación
          </p>
          <p className="mt-1 text-amber-200/80">
            Revise que cada fila del archivo corresponda al trabajador correcto antes de continuar.
            {pending > 0 ? ` Pendientes: ${pending}.` : ' Todos confirmados.'}
          </p>
        </div>
      </div>

      {visibleCases.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-700 px-4 py-6 text-center text-xs text-zinc-500">
          Ningún caso coincide con el filtro seleccionado.
        </p>
      ) : null}

      {[...grouped.sharedGroups.entries()].map(([cedula, groupCases]) => (
        <div
          key={cedula}
          className="rounded-xl border border-amber-500/20 bg-amber-950/10 p-3"
        >
          <div className="mb-2 flex items-center gap-2 px-1">
            <Users className="h-3.5 w-3.5 text-amber-400" />
            <p className="text-[11px] font-semibold text-amber-200">
              La cédula {cedula} aparece {groupCases.length} veces con nombres distintos
            </p>
          </div>
          <div className="flex flex-col gap-2">
            {groupCases.map((c) => (
              <IdentityCaseRow
                key={c.id}
                caseItem={c}
                workers={workers}
                onConfirm={updateCase}
              />
            ))}
          </div>
        </div>
      ))}

      {grouped.standalone.length > 0 ? (
        <div className="flex flex-col gap-2">
          {grouped.standalone.map((c) => (
            <IdentityCaseRow
              key={c.id}
              caseItem={c}
              workers={workers}
              onConfirm={updateCase}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
