import type {
  IdentityCase,
  IdentityCaseKind,
  IdentityResolution,
  IdentityResolutionAction,
} from '@/lib/nomina/worker-identity-cases';

export type IdentityPolicy = {
  allowedActions: IdentityResolutionAction[];
  requiresPicker: boolean;
  allowKeepExcel: boolean;
  allowCreateNew: boolean;
  blockImportIfPending: boolean;
};

export const IDENTITY_POLICIES: Record<IdentityCaseKind, IdentityPolicy> = {
  cedula_corrected: {
    allowedActions: ['use_suggested', 'pick_candidate'],
    requiresPicker: false,
    allowKeepExcel: false,
    allowCreateNew: false,
    blockImportIfPending: true,
  },
  cedula_shared: {
    allowedActions: ['use_suggested', 'pick_candidate'],
    requiresPicker: false,
    allowKeepExcel: false,
    allowCreateNew: false,
    blockImportIfPending: true,
  },
  name_not_in_base: {
    allowedActions: ['create_new', 'pick_candidate'],
    requiresPicker: false,
    allowKeepExcel: false,
    allowCreateNew: true,
    blockImportIfPending: true,
  },
  cedula_conflict: {
    allowedActions: ['pick_candidate'],
    requiresPicker: true,
    allowKeepExcel: false,
    allowCreateNew: false,
    blockImportIfPending: true,
  },
  ambiguous_name: {
    allowedActions: ['pick_candidate'],
    requiresPicker: true,
    allowKeepExcel: false,
    allowCreateNew: false,
    blockImportIfPending: true,
  },
};

export function getIdentityPolicy(kind: IdentityCaseKind): IdentityPolicy {
  return IDENTITY_POLICIES[kind];
}

export function isActionAllowedForCase(
  caseItem: IdentityCase,
  action: IdentityResolutionAction,
): boolean {
  return getIdentityPolicy(caseItem.kind).allowedActions.includes(action);
}

export function validateResolutionPolicy(caseItem: IdentityCase): {
  ok: boolean;
  message?: string;
} {
  if (caseItem.status !== 'confirmed' || !caseItem.resolution) {
    return { ok: caseItem.status === 'pending' ? true : false, message: 'Resolución incompleta.' };
  }

  const policy = getIdentityPolicy(caseItem.kind);
  const { action, personalId, cedula } = caseItem.resolution;

  if (!policy.allowedActions.includes(action)) {
    return {
      ok: false,
      message: `La acción «${action}» no está permitida para «${caseItem.excelNombre}».`,
    };
  }

  if (action === 'keep_excel' && !policy.allowKeepExcel) {
    return {
      ok: false,
      message: `No se puede mantener la cédula del Excel para «${caseItem.excelNombre}».`,
    };
  }

  if (action === 'create_new' && !policy.allowCreateNew) {
    return {
      ok: false,
      message: `No se puede crear un registro histórico para «${caseItem.excelNombre}» en este caso.`,
    };
  }

  if (
    (caseItem.kind === 'cedula_conflict' || caseItem.kind === 'ambiguous_name') &&
    action !== 'pick_candidate'
  ) {
    return {
      ok: false,
      message: `«${caseItem.excelNombre}» requiere elegir un trabajador de la base.`,
    };
  }

  if (action === 'pick_candidate' && !personalId) {
    return {
      ok: false,
      message: `Debe seleccionar un trabajador de la base para «${caseItem.excelNombre}».`,
    };
  }

  if (
    (caseItem.kind === 'cedula_corrected' || caseItem.kind === 'cedula_shared') &&
    action === 'use_suggested' &&
    cedula === caseItem.excelCedula
  ) {
    return {
      ok: false,
      message: `La cédula del Excel no puede usarse sin confirmar el trabajador sugerido.`,
    };
  }

  return { ok: true };
}

export function validateAllResolutionPolicies(cases: IdentityCase[]): {
  ok: boolean;
  message?: string;
} {
  for (const caseItem of cases) {
    if (caseItem.status !== 'confirmed') continue;
    const result = validateResolutionPolicy(caseItem);
    if (!result.ok) return result;
  }
  return { ok: true };
}

export function resolutionFromPolicy(
  caseItem: IdentityCase,
  action: IdentityResolutionAction,
  worker?: { id?: string; cedula: string; nombre_completo: string },
): IdentityResolution | null {
  if (!isActionAllowedForCase(caseItem, action)) return null;

  if (action === 'use_suggested' && caseItem.suggested) {
    return {
      personalId: caseItem.suggested.id ?? '',
      cedula: caseItem.suggested.cedula,
      nombre: caseItem.suggested.nombre_completo,
      action,
    };
  }

  if (action === 'pick_candidate' && worker) {
    return {
      personalId: worker.id ?? '',
      cedula: worker.cedula,
      nombre: worker.nombre_completo,
      action,
    };
  }

  if (action === 'create_new' || action === 'keep_excel') {
    return {
      personalId: '',
      cedula: caseItem.excelCedula,
      nombre: caseItem.excelNombre,
      action,
    };
  }

  return null;
}
