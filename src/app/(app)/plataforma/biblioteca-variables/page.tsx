import BibliotecaVariablesClient from '@/components/plataforma/BibliotecaVariablesClient';
import { loadBibliotecaCompleta } from '@/lib/actions/biblioteca-variables';

export const metadata = {
  title: 'Biblioteca de Variables - MineOS',
};

export default async function BibliotecaVariablesPage() {
  const catalogo = await loadBibliotecaCompleta();
  return <BibliotecaVariablesClient catalogo={catalogo} />;
}
