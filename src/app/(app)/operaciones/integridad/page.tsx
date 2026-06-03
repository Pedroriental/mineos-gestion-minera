import { verifyFinancialIntegrityAction } from '@/lib/actions/verify-integrity';
import IntegrityDashboard from '@/components/integrity/IntegrityDashboard';

export const dynamic = 'force-dynamic';

export default async function IntegridadPage() {
  const result = await verifyFinancialIntegrityAction();

  if (!result.ok) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50/60 dark:bg-red-950/20 p-6 max-w-lg">
          <p className="text-sm font-medium text-red-600 dark:text-red-400">
            No se pudo verificar la integridad financiera
          </p>
          <p className="text-xs text-red-500/70 mt-1">{result.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-[18px] font-extrabold tracking-tight text-[var(--dashboard-text)]">
          Integridad Financiera
        </h1>
        <p className="text-[13px] text-[var(--dashboard-text-muted)] mt-0.5">
          Verificación cruzada entre Nómina, Gastos, Producción y Balance Diario
        </p>
      </div>
      <IntegrityDashboard initialData={result.data} />
    </div>
  );
}
