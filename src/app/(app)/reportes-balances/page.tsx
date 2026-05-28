import { fetchFilterOptions } from '@/lib/actions/report-actions';
import ReportesClient from './ReportesClient';

export const metadata = {
  title: 'Centro de Reportes y Balances | MineOS',
  description: 'Descarga reportes y balances detallados de toda tu operación minera con filtros dinámicos avanzados y formatos en PDF y CSV.',
};

export default async function ReportesPage() {
  // Fetch initial dropdown options on the server side
  const filterOptions = await fetchFilterOptions();

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <ReportesClient initialOptions={filterOptions} />
    </div>
  );
}
