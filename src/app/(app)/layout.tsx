import { BibliotecaProvider } from '@/contexts/biblioteca-context';
import { loadBibliotecaAppSnapshot } from '@/lib/biblioteca-catalog';
import AppLayoutClient from './AppLayoutClient';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const biblioteca = await loadBibliotecaAppSnapshot();

  return (
    <BibliotecaProvider snapshot={biblioteca}>
      <AppLayoutClient>{children}</AppLayoutClient>
    </BibliotecaProvider>
  );
}
