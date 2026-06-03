import { ReportBuilder } from '@/components/reportes/ReportBuilder';

export const metadata = { title: 'Constructor de Reportes - MineOS' };

export default function ConstructorPage() {
  return (
    <div className="space-y-4 p-4 lg:p-6">
      <div className="flex items-center gap-2">
        <h1 className="text-base font-semibold text-zinc-100">
          Constructor de Reportes
        </h1>
        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-300">
          Universal
        </span>
      </div>
      <p className="text-[12px] text-zinc-500 -mt-2">
        Reportes cruzados multi-módulo con filtros dinámicos
      </p>
      <ReportBuilder />
    </div>
  );
}
