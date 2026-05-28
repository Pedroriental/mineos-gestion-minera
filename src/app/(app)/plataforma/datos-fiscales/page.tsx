import DatosFiscalesClient from '@/components/plataforma/DatosFiscalesClient';
import {
  loadFiscalEntidadesCompletas,
  loadFiscalParametros,
  loadFiscalTextosLegales,
} from '@/lib/actions/datos-fiscales';

export const metadata = {
  title: 'Datos Fiscales - MineOS',
};

export default async function DatosFiscalesPage() {
  const [entidades, textos, parametros] = await Promise.all([
    loadFiscalEntidadesCompletas(),
    loadFiscalTextosLegales(),
    loadFiscalParametros(),
  ]);

  return (
    <DatosFiscalesClient entidades={entidades} textos={textos} parametros={parametros} />
  );
}
