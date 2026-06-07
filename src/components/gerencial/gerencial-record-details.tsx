'use client';

import type {
  ReporteVoladura,
  ReporteExtraccion,
  ReporteQuemado,
  ReporteProduccion,
} from '@/lib/types';
import {
  fmtGerencialDate,
  fmtGerencialDateTime,
  fmtGerencialNum,
  formatOptionalNumber,
  formatOptionalText,
  turnoLabel,
} from '@/lib/gerencial-format';
import { GerencialDetailField, GerencialDetailSection } from '@/components/gerencial/GerencialDetailField';

const PESO_SACO_KG = 50;

export function VoladurasRecordDetail({ record }: { record: ReporteVoladura }) {
  const pausas = record.pausas_barrenado ?? [];

  return (
    <>
      <GerencialDetailSection title="Identificación">
        <GerencialDetailField label="Fecha" value={fmtGerencialDate(record.fecha)} mono />
        <GerencialDetailField label="Turno" value={turnoLabel(record.turno)} />
        <GerencialDetailField label="Mina" value={formatOptionalText(record.mina)} />
        <GerencialDetailField label="Vertical" value={formatOptionalText(record.vertical_disparo)} />
        <GerencialDetailField label="Responsable" value={formatOptionalText(record.responsable)} />
        <GerencialDetailField label="N° Disparo" value={formatOptionalText(record.numero_disparo)} mono />
      </GerencialDetailSection>

      <GerencialDetailSection title="Barrenado">
        <GerencialDetailField label="Hora inicio" value={formatOptionalText(record.hora_inicio_barrenado)} mono />
        <GerencialDetailField label="Hora culmina" value={formatOptionalText(record.hora_fin_barrenado)} mono />
        <GerencialDetailField label="Hora disparo" value={formatOptionalText(record.hora_disparo)} mono />
        <GerencialDetailField
          label="Estado"
          value={record.sin_novedad ? '✓ Sin novedad' : '⚠ Con novedad'}
        />
      </GerencialDetailSection>

      {pausas.length > 0 && (
        <section>
          <h3 className="gastos-detail-label mb-2 text-[10px] font-bold uppercase tracking-wider">Pausas de barrenado</h3>
          <div className="space-y-2">
            {pausas.map((pausa, index) => (
              <div key={index} className="app-detail-panel grid grid-cols-3 gap-3 rounded-xl p-3">
                <GerencialDetailField label="Inicio" value={formatOptionalText(pausa.hora_inicio)} mono />
                <GerencialDetailField label="Fin" value={formatOptionalText(pausa.hora_fin)} mono />
                <GerencialDetailField label="Motivo" value={formatOptionalText(pausa.motivo)} className="col-span-3 sm:col-span-1" />
              </div>
            ))}
          </div>
        </section>
      )}

      <GerencialDetailSection title="Condimentos">
        <GerencialDetailField label="Fósforos LP" value={formatOptionalNumber(record.fosforos_lp, 0)} />
        <GerencialDetailField label="Espaguetis" value={formatOptionalNumber(record.espaguetis, 0)} />
        <GerencialDetailField label="Vitamina E" value={formatOptionalNumber(record.vitamina_e, 0)} />
        <GerencialDetailField label="Trenza (m)" value={formatOptionalNumber(record.trenza_metros)} />
        <GerencialDetailField label="Arroz (kg)" value={formatOptionalNumber(record.arroz_kg)} highlight />
      </GerencialDetailSection>

      <GerencialDetailSection title="Huecos y chupis">
        <GerencialDetailField label="Huecos cantidad" value={formatOptionalNumber(record.huecos_cantidad, 0)} highlight />
        <GerencialDetailField label="Pies / hueco" value={formatOptionalNumber(record.huecos_pies, 0)} />
        <GerencialDetailField label="Chupis cantidad" value={formatOptionalNumber(record.chupis_cantidad, 0)} highlight />
        <GerencialDetailField label="Pies / chupi" value={formatOptionalNumber(record.chupis_pies, 0)} />
      </GerencialDetailSection>

      {(record.observaciones_disparo?.trim() || record.observaciones?.trim()) && (
        <GerencialDetailSection title="Observaciones">
          {record.observaciones_disparo?.trim() ? (
            <GerencialDetailField label="Disparo" value={record.observaciones_disparo} className="col-span-2 sm:col-span-3 lg:col-span-4" />
          ) : null}
          {record.observaciones?.trim() ? (
            <GerencialDetailField label="Generales" value={record.observaciones} className="col-span-2 sm:col-span-3 lg:col-span-4" />
          ) : null}
        </GerencialDetailSection>
      )}

      <GerencialDetailSection title="Auditoría">
        <GerencialDetailField label="ID registro" value={record.id} mono />
        <GerencialDetailField label="Registrado" value={fmtGerencialDateTime(record.created_at)} mono />
      </GerencialDetailSection>
    </>
  );
}

export function ExtraccionRecordDetail({ record }: { record: ReporteExtraccion }) {
  const eventos = (record.eventos ?? []).filter((ev) => ev.hora?.trim() || ev.descripcion?.trim());

  return (
    <>
      <GerencialDetailSection title="Identificación">
        <GerencialDetailField label="Fecha" value={fmtGerencialDate(record.fecha)} mono />
        <GerencialDetailField label="Turno" value={turnoLabel(record.turno)} />
        <GerencialDetailField label="Vertical" value={formatOptionalText(record.vertical)} />
        <GerencialDetailField label="Mina" value={formatOptionalText(record.mina)} />
        <GerencialDetailField label="Responsable" value={formatOptionalText(record.responsable)} />
        <GerencialDetailField label="Hora inicio" value={formatOptionalText(record.hora_inicio)} mono />
        <GerencialDetailField label="Hora culmina" value={formatOptionalText(record.hora_fin)} mono />
      </GerencialDetailSection>

      {eventos.length > 0 && (
        <section>
          <h3 className="gastos-detail-label mb-2 text-[10px] font-bold uppercase tracking-wider">Eventos del turno</h3>
          <div className="space-y-2">
            {eventos.map((evento, index) => (
              <div key={index} className="app-detail-panel grid grid-cols-[5.5rem_1fr] gap-3 rounded-xl p-3">
                <GerencialDetailField label="Hora" value={formatOptionalText(evento.hora)} mono />
                <GerencialDetailField label="Descripción" value={formatOptionalText(evento.descripcion)} />
              </div>
            ))}
          </div>
        </section>
      )}

      <GerencialDetailSection title="Producción del turno">
        <GerencialDetailField label="Sacos extraídos" value={formatOptionalNumber(record.sacos_extraidos, 0)} highlight />
        <GerencialDetailField label="N° disparo" value={formatOptionalText(record.numero_disparo)} mono />
        {record.observaciones?.trim() ? (
          <GerencialDetailField label="Observaciones" value={record.observaciones} className="col-span-2 sm:col-span-3 lg:col-span-4" />
        ) : null}
      </GerencialDetailSection>

      <GerencialDetailSection title="Auditoría">
        <GerencialDetailField label="ID registro" value={record.id} mono />
        <GerencialDetailField label="Registrado" value={fmtGerencialDateTime(record.created_at)} mono />
      </GerencialDetailSection>
    </>
  );
}

export function QuemadoRecordDetail({ record }: { record: ReporteQuemado }) {
  const planchas = record.planchas ?? [];
  const totalAmalgama = record.total_amalgama_g ?? planchas.reduce((s, p) => s + (Number(p.amalgama_g) || 0), 0) + (Number(record.manto_amalgama_g) || 0);
  const totalOro = record.total_oro_g ?? planchas.reduce((s, p) => s + (Number(p.oro_recuperado_g) || 0), 0) + (Number(record.manto_oro_g) || 0) + (Number(record.retorta_oro_g) || 0);

  return (
    <>
      <GerencialDetailSection title="Identificación">
        <GerencialDetailField label="Fecha" value={fmtGerencialDate(record.fecha)} mono />
        <GerencialDetailField label="Turno" value={turnoLabel(record.turno)} />
        <GerencialDetailField label="N° quemada" value={formatOptionalText(record.numero_quemada)} mono />
        <GerencialDetailField label="Responsable" value={formatOptionalText(record.responsable)} />
      </GerencialDetailSection>

      {planchas.length > 0 && (
        <section>
          <h3 className="gastos-detail-label mb-2 text-[10px] font-bold uppercase tracking-wider">Planchas</h3>
          <div className="space-y-2">
            {planchas.map((plancha, index) => (
              <div key={index} className="app-detail-panel grid grid-cols-2 gap-3 rounded-xl p-3">
                <GerencialDetailField label={`Plancha ${index + 1} — Amalgama (g)`} value={formatOptionalNumber(plancha.amalgama_g)} />
                <GerencialDetailField label={`Plancha ${index + 1} — Oro recup. (g)`} value={formatOptionalNumber(plancha.oro_recuperado_g)} highlight />
              </div>
            ))}
          </div>
        </section>
      )}

      <GerencialDetailSection title="Manto y retorta">
        <GerencialDetailField label="Manto amalgama (g)" value={formatOptionalNumber(record.manto_amalgama_g)} />
        <GerencialDetailField label="Manto oro (g)" value={formatOptionalNumber(record.manto_oro_g)} highlight />
        <GerencialDetailField label="Retorta oro (g)" value={formatOptionalNumber(record.retorta_oro_g)} highlight />
      </GerencialDetailSection>

      <GerencialDetailSection title="Totales">
        <GerencialDetailField label="Total amalgama (g)" value={fmtGerencialNum(totalAmalgama)} />
        <GerencialDetailField label="Total oro (g Au)" value={fmtGerencialNum(totalOro)} highlight />
      </GerencialDetailSection>

      {record.observaciones?.trim() ? (
        <GerencialDetailSection title="Observaciones">
          <GerencialDetailField label="Notas" value={record.observaciones} className="col-span-2 sm:col-span-3 lg:col-span-4" />
        </GerencialDetailSection>
      ) : null}

      <GerencialDetailSection title="Auditoría">
        <GerencialDetailField label="ID registro" value={record.id} mono />
        <GerencialDetailField label="Registrado" value={fmtGerencialDateTime(record.created_at)} mono />
        <GerencialDetailField label="Actualizado" value={fmtGerencialDateTime(record.updated_at)} mono />
      </GerencialDetailSection>
    </>
  );
}

export function ProduccionRecordDetail({ record }: { record: ReporteProduccion }) {
  const sacos = Number(record.sacos) || 0;

  return (
    <>
      <GerencialDetailSection title="Datos del reporte">
        <GerencialDetailField label="Fecha" value={fmtGerencialDate(record.fecha)} mono />
        <GerencialDetailField label="Turno" value={turnoLabel(record.turno)} />
        <GerencialDetailField label="Molino" value={formatOptionalText(record.molino)} />
        <GerencialDetailField label="Material / mina" value={formatOptionalText(record.material)} />
        <GerencialDetailField label="Código lote/veta" value={formatOptionalText(record.material_codigo)} mono />
        <GerencialDetailField label="Responsable" value={formatOptionalText(record.responsable)} />
      </GerencialDetailSection>

      <GerencialDetailSection title="Amalgamación">
        <GerencialDetailField label="Amalgama 1 (g)" value={formatOptionalNumber(record.amalgama_1_g)} />
        <GerencialDetailField label="Amalgama 2 (g)" value={formatOptionalNumber(record.amalgama_2_g)} />
        <GerencialDetailField label="Oro recuperado (g Au)" value={formatOptionalNumber(record.oro_recuperado_g)} highlight />
        <GerencialDetailField label="Merma 1 (%)" value={record.merma_1_pct != null ? `${record.merma_1_pct}%` : '—'} />
        <GerencialDetailField label="Merma 2 (%)" value={record.merma_2_pct != null ? `${record.merma_2_pct}%` : '—'} />
      </GerencialDetailSection>

      <GerencialDetailSection title="Producción">
        <GerencialDetailField label="Sacos (×50 kg)" value={formatOptionalNumber(record.sacos, 0)} highlight />
        <GerencialDetailField
          label="Peso equivalente"
          value={sacos > 0 ? `${sacos * PESO_SACO_KG} kg` : '—'}
        />
        <GerencialDetailField label="Ton. procesadas" value={formatOptionalNumber(record.toneladas_procesadas, 3)} />
        <GerencialDetailField label="Tenor (g/t)" value={formatOptionalNumber(record.tenor_tonelada_gpt)} />
        <GerencialDetailField label="Tenor (g/s)" value={formatOptionalNumber(record.tenor_saco_gps)} />
      </GerencialDetailSection>

      {record.observaciones?.trim() ? (
        <GerencialDetailSection title="Observaciones">
          <GerencialDetailField label="Notas" value={record.observaciones} className="col-span-2 sm:col-span-3 lg:col-span-4" />
        </GerencialDetailSection>
      ) : null}

      <GerencialDetailSection title="Auditoría">
        <GerencialDetailField label="ID registro" value={record.id} mono />
        <GerencialDetailField label="Registrado" value={fmtGerencialDateTime(record.created_at)} mono />
        <GerencialDetailField label="Actualizado" value={fmtGerencialDateTime(record.updated_at)} mono />
      </GerencialDetailSection>
    </>
  );
}
