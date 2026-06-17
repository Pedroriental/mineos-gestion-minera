import type { ReportModule, ReportPayload } from '@/lib/reports/report-types';

const VALID_MODULES = new Set<ReportModule>([
  'produccion',
  'extraccion',
  'quemado',
  'voladuras',
  'gastos',
  'nomina',
  'balance',
  'reconciliacion',
]);

export function buildConstructorUrl(payload: Partial<ReportPayload>): string {
  const params = encodeReportPayloadToSearchParams(payload);
  const qs = params.toString();
  return qs ? `/reportes/constructor?${qs}` : '/reportes/constructor';
}

export function encodeReportPayloadToSearchParams(
  payload: Partial<ReportPayload>,
): URLSearchParams {
  const params = new URLSearchParams();

  if (payload.dateFrom) params.set('from', payload.dateFrom);
  if (payload.dateTo) params.set('to', payload.dateTo);
  if (payload.groupBy) params.set('groupBy', payload.groupBy);

  if (payload.modules?.length) {
    params.set('modules', payload.modules.join(','));
  }

  const recon = payload.filters?.reconciliacion;
  if (recon) {
    const molinos = extractList(recon.molino ?? recon.molinos);
    const minas = extractList(recon.mina ?? recon.minas);
    if (molinos?.length) params.set('molinos', molinos.join(','));
    if (minas?.length) params.set('minas', minas.join(','));
  }

  const cross = payload.crossModuleJoin;
  if (cross?.value?.trim() && cross.include?.length) {
    params.set('crossType', cross.type);
    params.set('crossValue', cross.value.trim());
    params.set('crossInclude', cross.include.join(','));
  }

  return params;
}

export function decodeReportPayloadFromSearchParams(
  params: URLSearchParams,
): Partial<ReportPayload> {
  const payload: Partial<ReportPayload> = {};

  const from = params.get('from');
  const to = params.get('to');
  if (from) payload.dateFrom = from;
  if (to) payload.dateTo = to;

  const groupBy = params.get('groupBy');
  if (groupBy) payload.groupBy = groupBy;

  const modulesRaw = params.get('modules');
  if (modulesRaw) {
    const modules = modulesRaw
      .split(',')
      .map((m) => m.trim())
      .filter((m): m is ReportModule => VALID_MODULES.has(m as ReportModule));
    if (modules.length) payload.modules = modules;
  }

  const molinos = splitCsv(params.get('molinos'));
  const minas = splitCsv(params.get('minas'));
  if (molinos?.length || minas?.length) {
    payload.filters = {
      reconciliacion: {
        ...(molinos?.length ? { molinos: { in: molinos } } : {}),
        ...(minas?.length ? { minas: { in: minas } } : {}),
      },
    };
  }

  const crossType = params.get('crossType');
  const crossValue = params.get('crossValue');
  const crossInclude = splitCsv(params.get('crossInclude'));
  if (crossType && crossValue && crossInclude?.length) {
    payload.crossModuleJoin = {
      type: crossType as NonNullable<ReportPayload['crossModuleJoin']>['type'],
      value: crossValue,
      include: crossInclude.filter((m): m is ReportModule =>
        VALID_MODULES.has(m as ReportModule),
      ),
    };
  }

  return payload;
}

function splitCsv(raw: string | null): string[] | undefined {
  if (!raw?.trim()) return undefined;
  const list = raw.split(',').map((s) => s.trim()).filter(Boolean);
  return list.length ? list : undefined;
}

function extractList(
  raw: string[] | { in: string[] } | string | number | undefined,
): string[] | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (Array.isArray(raw)) return raw.length ? raw.map(String) : undefined;
  if (typeof raw === 'object' && 'in' in raw) {
    return raw.in.length ? raw.in.map(String) : undefined;
  }
  const str = String(raw).trim();
  return str ? [str] : undefined;
}
