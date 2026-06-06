'use client';

import { PencilLine, Trash2, Variable } from 'lucide-react';
import type { BibliotecaCategoriaCompleta } from '@/lib/types';
import { getBibliotecaCategorySchema } from '@/lib/biblioteca-schemas';
import { MODULO_LABEL } from '@/components/plataforma/biblioteca-constants';

type Props = {
  categoria: BibliotecaCategoriaCompleta;
  isPending: boolean;
  onEditCategoria: () => void;
  onDeleteCategoria: () => void;
  onEditVariable: (v: BibliotecaCategoriaCompleta['variables'][number]) => void;
  onDeleteVariable: (id: string) => void;
};

export function BibliotecaCategoryVariablesView({
  categoria,
  isPending,
  onEditCategoria,
  onDeleteCategoria,
  onEditVariable,
  onDeleteVariable,
}: Props) {
  const schema = getBibliotecaCategorySchema(categoria.slug);
  const colCount = schema.columns.length + 1;

  return (
    <>
      <div className="border-b border-white/[0.06] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Variable className="h-4 w-4 shrink-0 mineos-icon-general" />
              <h2 className="text-base font-bold text-white">{categoria.nombre}</h2>
              <span
                className={`rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${schema.badgeClass}`}
              >
                {schema.label}
              </span>
              <span className="text-[10px] text-white/35">{MODULO_LABEL[categoria.modulo]}</span>
            </div>
            <p className="mt-2 max-w-3xl text-xs leading-relaxed text-white/50">{schema.purpose}</p>
            {categoria.descripcion ? (
              <p className="mt-1 text-[11px] text-white/40">{categoria.descripcion}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={onEditCategoria}
              className="rounded-lg border border-white/10 p-2 text-white/55 hover:text-white"
              title="Editar categoría"
            >
              <PencilLine className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={onDeleteCategoria}
              className="rounded-lg border border-red-500/20 p-2 text-red-300/80 hover:bg-red-500/10"
              title="Eliminar categoría"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead className="sticky top-0 z-10 bg-[#0f1419]/95 backdrop-blur-sm">
            <tr className="border-b border-white/[0.08] text-[11px] uppercase tracking-wide text-white/45">
              {schema.columns.map((col) => (
                <th key={col.id} className={`px-4 py-3 ${col.className || ''}`}>
                  {col.label}
                </th>
              ))}
              <th className="w-20 px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {categoria.variables.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="px-4 py-10 text-center text-xs text-white/45">
                  Sin variables en esta categoría. Usa «Nueva variable» con los campos de{' '}
                  {schema.label.toLowerCase()}.
                </td>
              </tr>
            ) : (
              categoria.variables.map((v) => (
                <tr key={v.id} className="border-b border-white/[0.05] hover:bg-white/[0.02]">
                  {schema.columns.map((col) => (
                    <td key={col.id} className={`px-4 py-3 ${col.className || ''}`}>
                      {col.render(v, categoria.slug)}
                    </td>
                  ))}
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => onEditVariable(v)}
                        className="rounded border border-white/10 p-1.5 text-white/55 hover:text-white"
                      >
                        <PencilLine className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => onDeleteVariable(v.id)}
                        className="rounded border border-red-500/20 p-1.5 text-red-300/70 hover:bg-red-500/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
