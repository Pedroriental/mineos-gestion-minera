'use client';

import { useState, useMemo, useTransition, useEffect, useCallback } from 'react';
import { Loader2, CheckCircle2, AlertTriangle, Printer, Upload } from 'lucide-react';
import type { Personal } from '@/lib/types';
import { calcularLiquidacionPendiente, type LiquidacionResultado } from '@/lib/nomina-calculo';
import { procesarLiquidacionDespedidosAction } from '@/lib/actions/nomina-v3';
import { printLiquidacionPdf, type LiquidacionExportRow, type LiquidacionExportMeta } from '@/lib/nomina/liquidacion-pdf';
import { ImportarDespedidosModal } from '@/components/nomina/ImportarDespedidosModal';
import type { DistribucionParte } from '@/lib/nomina-distribucion';

type Props = {
  area: string;
  personal: Personal[];
  distribucionPartes?: DistribucionParte[];
  onRefresh?: () => void;
};

type LiquidacionOverride = {
  bonificaciones: number;
  montoEditado: number | null;
  cobraSemanaLibre: boolean;
  diasTrabajadosOverride: number | null;
  cerrada: boolean;
};

const DEFAULT_OVERRIDE: LiquidacionOverride = {
  bonificaciones: 0,
  montoEditado: null,
  cobraSemanaLibre: false,
  diasTrabajadosOverride: null,
  cerrada: false,
};

type LiquidacionItem = {
  personal: Personal;
  liquidacion: LiquidacionResultado;
  bonificaciones: number;
  montoEditado: number | null;
  cobraSemanaLibre: boolean;
  diasTrabajadosOverride: number | null;
  cerrada: boolean;
};

export function LiquidacionDespedidosPanel({ area, personal, distribucionPartes, onRefresh }: Props) {
  const [overrides, setOverrides] = useState<Record<string, LiquidacionOverride>>({});
  const [processing, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);

  const despedidos = useMemo(
    () => personal.filter(
      (p) => p.area === area && p.estado_laboral === 'DESPEDIDO',
    ),
    [personal, area],
  );

  const itemsList: LiquidacionItem[] = useMemo(() => {
    return despedidos.map((p) => {
      const despidoFecha = p.despido_fecha ?? p.estado_fin_fecha ?? new Date().toISOString().split('T')[0];
      const ov = overrides[p.id] ?? DEFAULT_OVERRIDE;
      const liquidacion = calcularLiquidacionPendiente(
        p,
        despidoFecha,
        ov.cobraSemanaLibre,
        ov.diasTrabajadosOverride,
      );
      return {
        personal: p,
        liquidacion,
        bonificaciones: ov.bonificaciones,
        montoEditado: ov.montoEditado,
        cobraSemanaLibre: ov.cobraSemanaLibre,
        diasTrabajadosOverride: ov.diasTrabajadosOverride,
        cerrada: ov.cerrada,
      };
    });
  }, [despedidos, overrides]);

  useEffect(() => {
    setError(null);
  }, [itemsList.length]);

  const handleBonificacion = useCallback((personalId: string, valor: number) => {
    setOverrides((prev) => {
      const next = { ...prev };
      const existing = next[personalId] ?? DEFAULT_OVERRIDE;
      next[personalId] = { ...existing, bonificaciones: valor };
      return next;
    });
  }, []);

  const handleMontoEditado = useCallback((personalId: string, valor: number | null) => {
    setOverrides((prev) => {
      const next = { ...prev };
      const existing = next[personalId] ?? DEFAULT_OVERRIDE;
      next[personalId] = { ...existing, montoEditado: valor };
      return next;
    });
  }, []);

  const handleCobraSemanaLibre = useCallback((personalId: string, valor: boolean) => {
    setOverrides((prev) => {
      const next = { ...prev };
      const existing = next[personalId] ?? DEFAULT_OVERRIDE;
      next[personalId] = { ...existing, cobraSemanaLibre: valor };
      return next;
    });
  }, []);

  const handleDiasTrabajados = useCallback((personalId: string, valor: number | null) => {
    setOverrides((prev) => {
      const next = { ...prev };
      const existing = next[personalId] ?? DEFAULT_OVERRIDE;
      next[personalId] = { ...existing, diasTrabajadosOverride: valor };
      return next;
    });
  }, []);

  const montoFinal = (item: LiquidacionItem): number => {
    if (item.montoEditado !== null) return item.montoEditado;
    return parseFloat((item.liquidacion.montoTotal + item.bonificaciones).toFixed(2));
  };

  const totalGeneral = itemsList.reduce((n, item) => n + montoFinal(item), 0);

  const handleCerrar = () => {
    setError(null);
    setSuccess(null);
    const pendientes = itemsList.filter((item) => !item.cerrada);
    if (pendientes.length === 0) return;

    startTransition(async () => {
      const payload = pendientes.map((item) => ({
        personalId: item.personal.id,
        montoLiquidacion: montoFinal(item),
        bonificaciones: item.bonificaciones,
        cobraSemanaLibre: item.cobraSemanaLibre,
        diasTrabajados: item.diasTrabajadosOverride,
        observacion: [
          ...item.liquidacion.semanas.map((s) => `${s.descripcion}: $${s.monto.toFixed(2)}`),
          item.cobraSemanaLibre ? 'Incluye semana libre' : 'Sin semana libre',
        ].join('; '),
        despidoFecha: item.personal.despido_fecha ?? new Date().toISOString().split('T')[0],
      }));

      const distribucionPayload = distribucionPartes && distribucionPartes.length > 0
        ? distribucionPartes.map((d) => ({
            nombre: d.nombre,
            porcentaje: d.porcentaje,
            pagoDirecto: d.pagoDirecto,
          }))
        : undefined;

      const res = await procesarLiquidacionDespedidosAction({
        area,
        liquidaciones: payload,
        distribucion: distribucionPayload,
      });
      if (res.ok) {
        setSuccess(`${pendientes.length} liquidacion(es) procesada(s) correctamente.`);
        setOverrides((prev) => {
          const next = { ...prev };
          for (const item of pendientes) {
            const existing = next[item.personal.id] ?? DEFAULT_OVERRIDE;
            next[item.personal.id] = { ...existing, cerrada: true };
          }
          return next;
        });
        onRefresh?.();
      } else {
        setError(res.message);
      }
    });
  };

  const handleImprimirPDF = useCallback(() => {
    const pdfRows: LiquidacionExportRow[] = itemsList.map((item) => {
      const salarioBase = Number(item.personal.salario_base) || 0;
      const salarioLibre = Number(item.personal.salario_libre) || salarioBase;
      const porDia = parseFloat((salarioBase / 7).toFixed(2));
      const totalDias = parseFloat((porDia * item.liquidacion.diasParciales).toFixed(2));
      const semanaLibreMonto = item.cobraSemanaLibre ? salarioLibre : 0;
      const totalACobrar = montoFinal(item);
      return {
        personal: {
          nombre_completo: item.personal.nombre_completo,
          cedula: item.personal.cedula,
          cargo: item.personal.cargo,
          area_detalle: item.personal.area_detalle,
        },
        salarioBase,
        porDia,
        diasTrabajados: item.liquidacion.diasParciales,
        totalDias,
        cobraSemanaLibre: item.cobraSemanaLibre,
        semanaLibreMonto,
        bonificaciones: item.bonificaciones,
        totalACobrar,
        despidoFecha: item.personal.despido_fecha ?? '',
        despidoCausa: item.personal.despido_causa,
      };
    });

    const totalGeneral = itemsList.reduce((n, item) => n + montoFinal(item), 0);
    const totalDias = pdfRows.reduce((n, r) => n + r.totalDias, 0);
    const totalLibres = pdfRows.reduce((n, r) => n + r.semanaLibreMonto, 0);
    const totalBonificaciones = pdfRows.reduce((n, r) => n + r.bonificaciones, 0);

    const today = new Date().toISOString().split('T')[0];
    const areaLabel = area === 'mina' ? 'Mina Belén' : area === 'planta' ? 'Molino' : area;

    const meta: LiquidacionExportMeta = {
      area,
      areaLabel,
      fechaGeneracion: new Date().toLocaleString('es-ES'),
      fechaLiquidacion: today,
      workerCount: itemsList.length,
      totalGeneral: parseFloat(totalGeneral.toFixed(2)),
      totalDias: parseFloat(totalDias.toFixed(2)),
      totalLibres: parseFloat(totalLibres.toFixed(2)),
      totalBonificaciones: parseFloat(totalBonificaciones.toFixed(2)),
    };

    const distLineas = distribucionPartes
      ? distribucionPartes.map((d) => {
          const bruto = parseFloat(((totalGeneral * d.porcentaje) / 100).toFixed(2));
          const neto = parseFloat((bruto + d.pagoDirecto).toFixed(2));
          return {
            id: d.id,
            nombre: d.nombre,
            porcentaje: d.porcentaje,
            pagoDirecto: d.pagoDirecto,
            bruto,
            neto,
          };
        })
      : [];

    printLiquidacionPdf(pdfRows, meta, distLineas);
  }, [itemsList, area, distribucionPartes]);

  if (despedidos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16">
        <CheckCircle2 className="h-8 w-8 text-emerald-500/50" />
        <p className="text-sm text-zinc-500">No hay trabajadores despedidos en {area}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-zinc-200">Liquidaciones Pendientes</h3>
          <p className="text-[11px] text-zinc-500">
            {despedidos.length} trabajador(es) despedido(s) — {itemsList.filter((i) => !i.cerrada).length} pendiente(s)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold tabular-nums text-amber-400">
            Total: ${totalGeneral.toFixed(2)}
          </span>
          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-zinc-900/40 px-3 py-1.5 text-[11px] font-medium text-zinc-300 hover:bg-white/5 transition-colors"
          >
            <Upload className="h-3.5 w-3.5" />
            Importar Excel
          </button>
          <button
            type="button"
            onClick={handleImprimirPDF}
            disabled={itemsList.length === 0}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-zinc-900/40 px-3 py-1.5 text-[11px] font-medium text-zinc-300 hover:bg-white/5 transition-colors disabled:opacity-40"
          >
            <Printer className="h-3.5 w-3.5" />
            Imprimir PDF
          </button>
          <button
            type="button"
            onClick={handleCerrar}
            disabled={processing || itemsList.every((i) => i.cerrada)}
            className="flex items-center gap-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 px-3 py-1.5 text-[11px] font-semibold text-amber-300 hover:bg-amber-500/25 transition-colors disabled:opacity-40"
          >
            {processing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            Cerrar Liquidación
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-[11px] text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-[11px] text-emerald-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {success}
        </div>
      )}

      <div className="space-y-2">
        {itemsList.map((item) => (
          <LiquidacionCard
            key={item.personal.id}
            item={item}
            montoFinal={montoFinal(item)}
            onBonificacion={(v) => handleBonificacion(item.personal.id, v)}
            onMontoEditado={(v) => handleMontoEditado(item.personal.id, v)}
            onCobraSemanaLibre={(v) => handleCobraSemanaLibre(item.personal.id, v)}
            onDiasTrabajados={(v) => handleDiasTrabajados(item.personal.id, v)}
          />
        ))}
      </div>

      {showImportModal && (
        <ImportarDespedidosModal
          onClose={() => setShowImportModal(false)}
          onSuccess={() => {
            setShowImportModal(false);
            onRefresh?.();
          }}
        />
      )}
    </div>
  );
}

function LiquidacionCard({
  item,
  montoFinal,
  onBonificacion,
  onMontoEditado,
  onCobraSemanaLibre,
  onDiasTrabajados,
}: {
  item: LiquidacionItem;
  montoFinal: number;
  onBonificacion: (v: number) => void;
  onMontoEditado: (v: number | null) => void;
  onCobraSemanaLibre: (v: boolean) => void;
  onDiasTrabajados: (v: number | null) => void;
}) {
  const { personal: p, liquidacion, bonificaciones, cobraSemanaLibre, diasTrabajadosOverride, cerrada } = item;
  const [editMode, setEditMode] = useState(false);

  const salarioBase = Number(p.salario_base) || 0;
  const salarioLibre = Number(p.salario_libre) || salarioBase;
  const porDia = salarioBase / 7;
  const totalDias = liquidacion.diasParciales;
  const totalDT = totalDias > 0 ? parseFloat((porDia * totalDias).toFixed(2)) : 0;
  const totalLibre = cobraSemanaLibre ? salarioLibre : 0;

  return (
    <div className={`rounded-lg border p-3 transition-colors ${
      cerrada
        ? 'border-emerald-500/20 bg-emerald-500/5'
        : 'border-white/5 bg-zinc-900/30'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-zinc-200 truncate">{p.nombre_completo}</p>
            {cerrada && (
              <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 text-[9px] font-medium text-emerald-400">
                Cerrada
              </span>
            )}
          </div>
          <p className="text-[10px] text-zinc-500">
            C.I. {p.cedula} · {p.cargo} · ${salarioBase.toFixed(0)}/sem
          </p>
          <p className="text-[10px] text-zinc-500">
            Despido: {p.despido_fecha ?? '—'}
            {p.despido_causa && (
              <span className="ml-1 rounded bg-amber-500/10 border border-amber-500/20 px-1 text-amber-300">
                {p.despido_causa}
              </span>
            )}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-base font-bold tabular-nums text-amber-400">
            ${montoFinal.toFixed(2)}
          </p>
          <p className="text-[9px] text-zinc-500">
            {totalDias}d · ${porDia.toFixed(2)}/día
            {cobraSemanaLibre ? ' +libre' : ''}
          </p>
        </div>
      </div>

      {/* Desglose tipo Excel */}
      <div className="mt-2 grid grid-cols-4 gap-1 rounded-md bg-zinc-900/30 px-2 py-1.5 text-center text-[10px]">
        <div>
          <p className="text-zinc-500">$/día</p>
          <p className="tabular-nums text-zinc-300">${porDia.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-zinc-500">Días Trab.</p>
          <p className="tabular-nums text-zinc-300">{totalDias}</p>
        </div>
        <div>
          <p className="text-zinc-500">Total/DT</p>
          <p className="tabular-nums text-zinc-300">${totalDT.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-zinc-500">Sem. Libre</p>
          <p className="tabular-nums text-zinc-300">${totalLibre.toFixed(2)}</p>
        </div>
      </div>

      {!cerrada && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label className="flex cursor-pointer items-center gap-1.5">
            <input
              type="checkbox"
              checked={cobraSemanaLibre}
              onChange={(e) => onCobraSemanaLibre(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-white/10 bg-zinc-900/60 text-amber-500 focus:ring-1 focus:ring-amber-500/30"
            />
            <span className="text-[10px] text-zinc-300">Cobró semana libre</span>
            <span className="text-[9px] text-zinc-500">(+${salarioLibre.toFixed(2)})</span>
          </label>
          <label className="text-[10px] text-zinc-500">Días Trab.:</label>
          <input
            type="number"
            step="any"
            placeholder="auto"
            value={diasTrabajadosOverride ?? ''}
            onChange={(e) => onDiasTrabajados(e.target.value ? Number(e.target.value) : null)}
            className="w-16 rounded-md border border-white/5 bg-zinc-900/60 px-2 py-0.5 text-[11px] text-white outline-none focus:border-zinc-500/40"
          />
          <label className="text-[10px] text-zinc-500">Bono:</label>
          <input
            type="number"
            step="any"
            placeholder="0"
            value={bonificaciones || ''}
            onChange={(e) => onBonificacion(Number(e.target.value) || 0)}
            className="w-16 rounded-md border border-white/5 bg-zinc-900/60 px-2 py-0.5 text-[11px] text-white outline-none focus:border-zinc-500/40"
          />
          <button
            type="button"
            onClick={() => setEditMode(!editMode)}
            className="text-[10px] text-zinc-500 hover:text-zinc-300"
          >
            {editMode ? 'Auto' : 'Total fijo'}
          </button>
          {editMode && (
            <input
              type="number"
              step="any"
              placeholder={montoFinal.toFixed(2)}
              value={item.montoEditado ?? ''}
              onChange={(e) => onMontoEditado(e.target.value ? Number(e.target.value) : null)}
              className="w-24 rounded-md border border-white/5 bg-zinc-900/60 px-2 py-0.5 text-[11px] text-white outline-none focus:border-zinc-500/40"
            />
          )}
        </div>
      )}
    </div>
  );
}
