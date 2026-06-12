'use client';

import { Plus, X } from 'lucide-react';
import { AppSelect } from '@/components/ui/AppSelect';
import {
  TIPOS_HUECO,
  type ChupiLineaForm,
  type HuecoLineaForm,
  emptyChupiLinea,
  emptyHuecoLinea,
} from '@/lib/voladuras-huecos-chupis';
import { mineosLabelAccent, mineosModalDivider, mineosModalHeading, mineosPanel } from '@/lib/mineos-visual';

interface VoladurasHuecosChupisEditorProps {
  huecos: HuecoLineaForm[];
  chupis: ChupiLineaForm[];
  onHuecosChange: (lineas: HuecoLineaForm[]) => void;
  onChupisChange: (lineas: ChupiLineaForm[]) => void;
}

export function VoladurasHuecosChupisEditor({
  huecos,
  chupis,
  onHuecosChange,
  onChupisChange,
}: VoladurasHuecosChupisEditorProps) {
  const updateHueco = (index: number, patch: Partial<HuecoLineaForm>) => {
    onHuecosChange(huecos.map((linea, i) => (i === index ? { ...linea, ...patch } : linea)));
  };

  const updateChupi = (index: number, patch: Partial<ChupiLineaForm>) => {
    onChupisChange(chupis.map((linea, i) => (i === index ? { ...linea, ...patch } : linea)));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2">
          <h3 className={mineosModalHeading('general')}>
            <span>🕳 Huecos</span>
            <span className={mineosModalDivider('general')} />
          </h3>
          <button
            type="button"
            onClick={() => onHuecosChange([...huecos, emptyHuecoLinea()])}
            className="btn-secondary !px-2.5 !py-1 !text-xs"
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> Agregar
          </button>
        </div>
        <div className="space-y-2">
          {huecos.map((linea, index) => (
            <div
              key={`hueco-${index}`}
              className={`grid grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_auto] items-end gap-2 ${mineosPanel('general')}`}
            >
              <div>
                <label className="input-label">Tipo</label>
                <AppSelect
                  value={linea.tipo}
                  onChange={(value) => updateHueco(index, { tipo: value as HuecoLineaForm['tipo'] })}
                  options={TIPOS_HUECO.map((tipo) => ({ value: tipo.value, label: tipo.label }))}
                />
              </div>
              <div>
                <label className={mineosLabelAccent('general')}>Cantidad</label>
                <input
                  type="number"
                  min={0}
                  value={linea.cantidad}
                  onChange={(e) => updateHueco(index, { cantidad: e.target.value })}
                  className="input-field font-bold"
                />
              </div>
              <div>
                <label className="input-label">Pies / hueco</label>
                <input
                  type="number"
                  min={0}
                  value={linea.pies}
                  onChange={(e) => updateHueco(index, { pies: e.target.value })}
                  className="input-field"
                />
              </div>
              <button
                type="button"
                onClick={() => onHuecosChange(huecos.filter((_, i) => i !== index))}
                disabled={huecos.length <= 1}
                className="rounded-lg p-2 text-white/30 transition-colors hover:bg-red-500/15 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-30"
                aria-label="Quitar línea de hueco"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-amber-400">
            <span>🔥 Chupis</span>
          </h3>
          <button
            type="button"
            onClick={() => onChupisChange([...chupis, emptyChupiLinea()])}
            className="btn-secondary !px-2.5 !py-1 !text-xs"
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> Agregar
          </button>
        </div>
        <div className="space-y-2">
          {chupis.map((linea, index) => (
            <div
              key={`chupi-${index}`}
              className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,0.8fr)_auto] items-end gap-2 rounded-xl border border-amber-400/20 bg-amber-500/[0.07] p-3"
            >
              <div>
                <label className="input-label !text-amber-400">Pies / chupi</label>
                <input
                  type="number"
                  min={0}
                  value={linea.pies}
                  onChange={(e) => updateChupi(index, { pies: e.target.value })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="input-label !text-amber-400">Cantidad</label>
                <input
                  type="number"
                  min={0}
                  value={linea.cantidad}
                  onChange={(e) => updateChupi(index, { cantidad: e.target.value })}
                  className="input-field font-bold"
                />
              </div>
              <button
                type="button"
                onClick={() => onChupisChange(chupis.filter((_, i) => i !== index))}
                disabled={chupis.length <= 1}
                className="rounded-lg p-2 text-white/30 transition-colors hover:bg-red-500/15 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-30"
                aria-label="Quitar línea de chupi"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
