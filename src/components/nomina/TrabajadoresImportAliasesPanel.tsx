'use client';

import { useState } from 'react';
import { Link2, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { toastError } from '@/lib/app-toast';
import {
  deleteImportAliasAction,
  getImportAliasesAction,
} from '@/lib/actions/nomina-actions';
import type { ImportAliasRecord } from '@/lib/nomina/worker-alias';

export function TrabajadoresImportAliasesPanel({
  trabajadoresById,
}: {
  trabajadoresById: Map<string, { nombre_completo: string; cedula: string }>;
}) {
  const [aliases, setAliases] = useState<ImportAliasRecord[]>([]);
  const [isPending, setIsPending] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  async function loadAliases() {
    if (hasLoaded || isPending) return;
    setIsPending(true);
    try {
      const res = await getImportAliasesAction();
      if (res && res.ok && res.data) {
        setAliases(res.data);
      }
      setHasLoaded(true);
    } catch (err) {
      console.warn('[TrabajadoresImportAliasesPanel] error loading aliases:', err);
    } finally {
      setIsPending(false);
    }
  }

  function handleToggle(e: React.SyntheticEvent<HTMLDetailsElement>) {
    const open = e.currentTarget.open;
    if (open && !hasLoaded) {
      void loadAliases();
    }
  }

  async function handleDelete(id: string) {
    setIsPending(true);
    try {
      const res = await deleteImportAliasAction(id);
      if (res && res.ok) {
        toast.success('Alias eliminado');
        setAliases((prev) => prev.filter((a) => a.id !== id));
      } else {
        toastError(res?.message || 'Error al eliminar alias');
      }
    } catch (err: any) {
      toastError(err?.message || 'Error al eliminar alias');
    } finally {
      setIsPending(false);
    }
  }

  return (
    <details
      onToggle={handleToggle}
      className="group rounded-2xl border border-white/8 bg-zinc-900/30"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 marker:content-none">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-violet-400" />
          <h2 className="text-sm font-semibold text-zinc-100">Alias de importación histórica</h2>
          {hasLoaded ? (
            <span className="rounded-full border border-violet-500/25 bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold text-violet-300">
              {aliases.length}
            </span>
          ) : null}
        </div>
        <span className="text-[10px] font-medium text-zinc-500 group-open:hidden">Expandir</span>
        <span className="hidden text-[10px] font-medium text-zinc-500 group-open:inline">Contraer</span>
      </summary>
      <div className="border-t border-white/6 px-4 pb-4 pt-3">
        <p className="mb-4 text-xs leading-relaxed text-zinc-500">
          Vinculaciones guardadas al confirmar importaciones de nómina (nombre/cédula del Excel →
          trabajador en la base).
        </p>

        {isPending && !hasLoaded ? (
          <div className="flex items-center justify-center py-6 text-xs text-zinc-500 gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
            <span>Cargando alias...</span>
          </div>
        ) : aliases.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-700 px-4 py-6 text-center text-xs text-zinc-500">
            No hay alias guardados todavía.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/6">
            <table className="w-full min-w-[520px] text-left text-xs">
              <thead className="border-b border-white/6 bg-zinc-950/60 text-[10px] uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-3 py-2">Nombre en Excel</th>
                  <th className="px-3 py-2">Cédula Excel</th>
                  <th className="px-3 py-2">Trabajador en base</th>
                  <th className="px-3 py-2 text-right">Acción</th>
                </tr>
              </thead>
              <tbody>
                {aliases.map((alias) => {
                  const worker = trabajadoresById.get(alias.personal_id);
                  return (
                    <tr key={alias.id} className="border-t border-white/4">
                      <td className="px-3 py-2 text-zinc-200">{alias.alias_nombre_normalizado}</td>
                      <td className="px-3 py-2 font-mono text-zinc-400">
                        {alias.alias_cedula_excel ?? '—'}
                      </td>
                      <td className="px-3 py-2 text-zinc-300">
                        {worker
                          ? `${worker.nombre_completo} (${worker.cedula})`
                          : alias.personal_id}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleDelete(alias.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-500/20 px-2 py-1 text-[10px] text-rose-300 hover:bg-rose-500/10 disabled:opacity-40"
                        >
                          <Trash2 className="h-3 w-3" />
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </details>
  );
}
