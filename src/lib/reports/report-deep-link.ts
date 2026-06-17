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

export type ConstructorUrlOptions = {
  autoRun?: boolean;
};

export function buildConstructorUrl(
  payload: Partial<ReportPayload>,
  options?: ConstructorUrlOptions,
): string {
  const params = encodeReportPayloadToSearchParams(payload, options);
  const qs = params.toString();
  return qs ? `/reportes/constructor?${qs}` : '/reportes/constructor';
}

export function encodeReportPayloadToSearchParams(
  payload: Partial<ReportPayload>,
  options?: ConstructorUrlOptions,
): URLSearchParams {
  const params = new URLSearchParams();

  if (payload.dateFrom) params.set('from', payload.dateFrom);
  if (payload.dateTo) params.set('to', payload.dateTo);
  if (payload.groupBy) params.set('groupBy', payload.groupBy);

  if (payload.modules?.length) {
    params.set('modules', payload.modules.join(','));
  }

  if (payload.filters && Object.keys(payload.filters).length > 0) {
    try {
      const json = JSON.stringify(payload.filters);
      params.set('filters', btoa(unescape(encodeURIComponent(json))));
    } catch {
      // fallback: molinos/minas legacy below
    }
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

  if (options?.autoRun) {
    params.set('run', '1');
  }

  return params;
}

export function decodeReportPayloadFromSearchParams(
  params: URLSearchParams,
): Partial<ReportPayload> & { autoRun?: boolean } {
  const payload: Partial<ReportPayload> & { autoRun?: boolean } = {};

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

  const filtersB64 = params.get('filters');
  if (filtersB64) {
    try {
      const json = decodeURIComponent(escape(atob(filtersB64)));
      payload.filters = JSON.parse(json) as ReportPayload['filters'];
    } catch {
      // ignore malformed payload
    }
  }

  const molinos = splitCsv(params.get('molinos'));
  const minas = splitCsv(params.get('minas'));
  if (molinos?.length || minas?.length) {
    payload.filters = {
      ...payload.filters,
      reconciliacion: {
        ...payload.filters?.reconciliacion,
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

  payload.autoRun = params.get('run') === '1';

  return payload;
}

export function shouldAutoRunFromSearchParams(params: URLSearchParams): boolean {
  return params.get('run') === '1';
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
    const list = Array.isArray((raw as { in?: unknown }).in)
      ? (raw as { in: unknown[] }).in
      : [];
    return list.length ? list.map(String) : undefined;
  }
  const str = String(raw).trim();
  return str ? [str] : undefined;
}
