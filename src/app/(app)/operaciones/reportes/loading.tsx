import { Loader2 } from 'lucide-react';

export default function ReportesLoading() {
  return (
    <div className="flex h-[calc(100vh-12rem)] w-full flex-col items-center justify-center gap-3 rounded-2xl border border-white/5 bg-zinc-950/40 backdrop-blur-xl">
      <Loader2 className="h-10 w-10 animate-spin text-amber-500" />
      <p className="text-sm font-semibold text-zinc-400">
        Iniciando Centro de Reportes y Balances...
      </p>
    </div>
  );
}
