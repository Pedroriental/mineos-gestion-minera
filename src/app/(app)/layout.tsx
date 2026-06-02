import { BibliotecaProvider } from '@/contexts/biblioteca-context';
import { loadBibliotecaAppSnapshot } from '@/lib/biblioteca-catalog';
import { getSystemAlerts } from '@/lib/actions/system-alerts';
import AppLayoutClient from './AppLayoutClient';
import { ConfirmDialogProvider } from '@/components/ui/ConfirmDialogProvider';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [biblioteca, alerts] = await Promise.all([
    loadBibliotecaAppSnapshot(),
    getSystemAlerts(),
  ]);

  return (
    <BibliotecaProvider snapshot={biblioteca}>
      <ConfirmDialogProvider>
        <AppLayoutClient alerts={alerts}>{children}</AppLayoutClient>
      </ConfirmDialogProvider>
    </BibliotecaProvider>
  );
}
