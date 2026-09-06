import { BibliotecaProvider } from '@/contexts/biblioteca-context';
import { loadBibliotecaAppSnapshot } from '@/lib/biblioteca-catalog';
import { getSystemAlerts } from '@/lib/actions/system-alerts';
import AppLayoutClient from './AppLayoutClient';
import { ConfirmDialogProvider } from '@/components/ui/ConfirmDialogProvider';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let biblioteca: Awaited<ReturnType<typeof loadBibliotecaAppSnapshot>>;
  let alerts: Awaited<ReturnType<typeof getSystemAlerts>>;

  try {
    [biblioteca, alerts] = await Promise.all([
      loadBibliotecaAppSnapshot(),
      getSystemAlerts().catch((err) => {
        console.error('[AppLayout] getSystemAlerts error:', err);
        return [] as Awaited<ReturnType<typeof getSystemAlerts>>;
      }),
    ]);
  } catch (err) {
    console.error('[AppLayout] Error loading layout data:', err);
    biblioteca = { options: {}, valuesBySlug: {} } as Awaited<ReturnType<typeof loadBibliotecaAppSnapshot>>;
    alerts = [];
  }

  return (
    <BibliotecaProvider snapshot={biblioteca}>
      <ConfirmDialogProvider>
        <AppLayoutClient alerts={alerts}>{children}</AppLayoutClient>
      </ConfirmDialogProvider>
    </BibliotecaProvider>
  );
}
