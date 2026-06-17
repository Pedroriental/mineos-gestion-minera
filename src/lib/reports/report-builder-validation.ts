import type { ReportModule, ReportPayload } from '@/lib/reports/report-types';
import { isCrossModuleJoinActive } from '@/lib/reports/execute-report-core';

export type ReportValidationResult =
  | { ok: true }
  | { ok: false; messages: string[] };

export function validateReportPayload(payload: ReportPayload): ReportValidationResult {
  const messages: string[] = [];

  if (!payload.modules?.length) {
    messages.push('Selecciona al menos un módulo.');
  }

  if (payload.dateFrom && payload.dateTo && payload.dateFrom > payload.dateTo) {
    messages.push('La fecha inicial no puede ser posterior a la final.');
  }

  if (isCrossModuleJoinActive(payload.crossModuleJoin)) {
    const include = payload.crossModuleJoin!.include ?? [];
    const rpcEligible = include.filter(
      (m) => m !== 'balance' && m !== 'reconciliacion',
    );
    if (rpcEligible.length < 2) {
      messages.push('El cruce RPC requiere al menos 2 módulos operativos (sin balance/reconciliación).');
    }
    if (!payload.crossModuleJoin!.value?.trim()) {
      messages.push('Indica el valor del cruce entre módulos.');
    }
  }

  if (payload.modules?.includes('balance') && payload.modules?.includes('reconciliacion')) {
    messages.push('Balance y Reconciliación no pueden combinarse en un solo reporte.');
  }

  if ((payload.modules?.length ?? 0) > 4) {
    messages.push('Demasiados módulos seleccionados; el reporte puede ser lento (máx. recomendado: 4).');
  }

  return messages.length ? { ok: false, messages } : { ok: true };
}

export function validateReportModules(modules: ReportModule[]): ReportValidationResult {
  return validateReportPayload({
    dateFrom: '2000-01-01',
    dateTo: '2000-01-31',
    modules,
  });
}
