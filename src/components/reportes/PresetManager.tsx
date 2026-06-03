'use client';

import { memo, useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Save, Trash2, Check, Loader2 } from 'lucide-react';
import {
  loadReportPresets,
  saveReportPreset,
  deleteReportPreset,
  setDefaultPreset,
} from '@/lib/actions/report-presets';
import type { ReportPreset } from '@/lib/actions/report-presets';
import type { ReportPayload } from '@/lib/reports/report-types';

type Props = {
  currentPayload: ReportPayload;
  onLoad: (payload: ReportPayload) => void;
};

export const PresetManager = memo(function PresetManager({ currentPayload, onLoad }: Props) {
  const [presets, setPresets] = useState<ReportPreset[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [showSave, setShowSave] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchPresets = useCallback(async () => {
    setLoading(true);
    const res = await loadReportPresets();
    if (res.ok && Array.isArray(res.data)) {
      setPresets(res.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchPresets(); }, [fetchPresets]);

  const handleLoad = async (id: string) => {
    setLoading(true);
    const res = await loadReportPresets();
    if (res.ok && Array.isArray(res.data)) {
      const found = res.data.find((p: ReportPreset) => p.id === id);
      if (found) {
        onLoad(found.payload as unknown as ReportPayload);
      }
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const res = await saveReportPreset(name.trim(), desc.trim(), currentPayload as unknown as Record<string, unknown>);
    if (res.ok) {
      setName('');
      setDesc('');
      setShowSave(false);
      await fetchPresets();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    await deleteReportPreset(id);
    await fetchPresets();
    setDeletingId(null);
  };

  const handleSetDefault = async (id: string) => {
    await setDefaultPreset(id);
    await fetchPresets();
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
          Presets
        </p>
        <button
          type="button"
          onClick={() => setShowSave(!showSave)}
          className="text-[10px] text-amber-400 hover:text-amber-300 transition-colors"
        >
          {showSave ? 'Cancelar' : '+ Guardar'}
        </button>
      </div>

      {showSave && (
        <div className="space-y-1.5 rounded-lg border border-white/5 bg-zinc-900/30 p-2.5">
          <input
            type="text"
            placeholder="Nombre del preset"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-white/5 bg-zinc-900/60 px-2 py-1 text-[11px] text-white outline-none focus:border-zinc-500/40"
          />
          <input
            type="text"
            placeholder="Descripción (opcional)"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            className="w-full rounded-md border border-white/5 bg-zinc-900/60 px-2 py-1 text-[11px] text-white outline-none focus:border-zinc-500/40"
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="flex w-full items-center justify-center gap-1.5 rounded-md bg-amber-500/20 border border-amber-500/30 px-2 py-1 text-[11px] font-medium text-amber-300 hover:bg-amber-500/30 transition-colors disabled:opacity-40"
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            Guardar
          </button>
        </div>
      )}

      <div className="max-h-40 overflow-y-auto space-y-1 scrollbar-thin">
        {presets.length === 0 && !loading && (
          <p className="text-[10px] italic text-zinc-600 py-1">Sin presets guardados</p>
        )}
        {presets.map((p) => (
          <div
            key={p.id}
            className={cn(
              'flex items-center justify-between rounded-md px-2 py-1.5 transition-colors',
              p.is_default
                ? 'border border-amber-500/20 bg-amber-500/5'
                : 'border border-transparent hover:bg-white/[0.03]',
            )}
          >
            <button
              type="button"
              onClick={() => handleLoad(p.id)}
              className="flex-1 text-left min-w-0"
            >
              <p className="text-[11px] text-zinc-300 truncate">{p.name}</p>
              {p.description && (
                <p className="text-[9px] text-zinc-500 truncate">{p.description}</p>
              )}
            </button>
            <div className="flex items-center gap-0.5 shrink-0 ml-1">
              {!p.is_default && (
                <button
                  type="button"
                  onClick={() => handleSetDefault(p.id)}
                  title="Marcar por defecto"
                  className="rounded p-0.5 text-zinc-600 hover:text-amber-400 transition-colors"
                >
                  <Check className="h-3 w-3" />
                </button>
              )}
              <button
                type="button"
                onClick={() => handleDelete(p.id)}
                disabled={deletingId === p.id}
                className="rounded p-0.5 text-zinc-600 hover:text-red-400 transition-colors"
              >
                {deletingId === p.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Trash2 className="h-3 w-3" />
                )}
              </button>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-center py-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-500" />
          </div>
        )}
      </div>
    </div>
  );
});
