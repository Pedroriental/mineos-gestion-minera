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
    <div className="reportes-balances-page flex min-h-0 w-full flex-1 flex-col overflow-hidden p-0">
      <ReportesClient initialOptions={filterOptions} />
    </div>
  );
}
