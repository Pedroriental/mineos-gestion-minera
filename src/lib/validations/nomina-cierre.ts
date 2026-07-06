/**
 * Blindaje del cierre de nómina V3 (Fase 1).
 *
 * Capa de validación estricta + recálculo server-side (checksum):
 * el frontend PROPONE montos; el servidor los RECALCULA con los datos
 * maestros de la BD (`personal`) y las reglas de ciclo
 * (`perfil-ciclo-reglas.ts` vía `calculateNominaRowPay`). Cualquier
 * discrepancia mayor a la tolerancia se rechaza, salvo ajuste explícito
 * con motivo.
 *
 * Módulo puro (sin 'use server'): testeable con `tsx --test`.
 */
import { z } from 'zod';
import { calculateNominaRowPay, MAX_DIAS_TRABAJADOS } from '@/lib/nomina-calculo';
import { calculatePayForPlantillaNominaRow } from '@/lib/rotacion-plantillas/semana-cierre';
import type { EstatusRotacionPlantilla } from '@/lib/rotacion-plantillas/types';
import {
  asistenciaEsperadaPorPosicion,
  inputsDiasBloqueados,
  posicionEsquemaPersonal,
  totalSemanasEsquema,
} from '@/lib/nomina/perfil-ciclo-reglas';
import type { Personal } from '@/lib/types';

/** Tolerancia de redondeo entre el total del cliente y el recalculado. */
export const CIERRE_TOLERANCIA_USD = 0.01;

/** Techo de cordura: ningún pago semanal individual legítimo supera esto. */
export const CIERRE_MONTO_MAX_USD = 50_000;

const fechaIso = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD requerido')
  .refine((d) => !isNaN(Date.parse(d)), 'Fecha inválida');

const montoUsd = z
  .number({ error: 'Monto inválido' })
  .finite('Monto inválido')
  .min(0, 'El monto no puede ser negativo')
  .max(CIERRE_MONTO_MAX_USD, `El monto excede el máximo permitido ($${CIERRE_MONTO_MAX_USD})`);

export const RegistroCierreSchema = z
  .object({
    personalId: z.string().uuid('ID de trabajador inválido'),
    estadoAsistencia: z.enum(['trabajada', 'libre', 'no_laborado'], {
      error: 'Estado de asistencia inválido',
    }),
    diasTrabajados: z
      .number({ error: 'Días trabajados inválidos' })
      .int('Días trabajados debe ser entero')
      .min(0, 'Días trabajados no puede ser negativo')
      .max(MAX_DIAS_TRABAJADOS, `Días trabajados no puede superar ${MAX_DIAS_TRABAJADOS}`),
    total: montoUsd,
    bonoTransporte: montoUsd,
    bonificaciones: montoUsd,
    totalVales: montoUsd,
    novedadTurno: z.string().max(50).optional().default('ACTIVO'),
    novedadTurnoObs: z.string().max(500).optional().default(''),
    esSemanaLibre: z.boolean().optional(),
    salarioBaseCalculado: montoUsd.optional(),
    reposoCondicion: z.string().nullable().optional(),
    reposoDiasPagados: z.number().int().min(0).max(MAX_DIAS_TRABAJADOS).optional(),
    reposoCompensacionMonto: montoUsd.optional(),
    /**
     * Ajuste explícito: permite que `total` difiera del recalculado por el
     * servidor. Obliga a dejar un motivo auditable (mín. 5 caracteres).
     */
    ajusteMotivo: z.string().trim().min(5, 'El motivo del ajuste requiere al menos 5 caracteres').max(300).optional(),
    /** Semana de plantilla manual (p. ej. bono_transporte_paga separado del sueldo). */
    estatusPlantilla: z
      .enum([
        'trabajada_paga',
        'libre_paga',
        'libre_sin_pago',
        'no_laborada',
        'reposo',
        'vacaciones',
        'bono_transporte_paga',
      ])
      .optional(),
    /** Cuadrilla de plantilla al cerrar (persistida en personal_snapshot). */
    cuadrillaId: z.string().uuid('ID de cuadrilla inválido').optional(),
    cuadrillaNombre: z.string().trim().min(1).max(200).optional(),
    posicionCiclo: z.number().int().min(0).max(20).nullable().optional(),
  })
  .superRefine((r, ctx) => {
    if (r.estadoAsistencia === 'no_laborado' && r.diasTrabajados !== 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'Un registro "no laborado" debe tener 0 días trabajados.',
        path: ['diasTrabajados'],
      });
    }
    if (r.estadoAsistencia === 'trabajada' && r.diasTrabajados === 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'Un registro "trabajada" requiere al menos 1 día trabajado.',
        path: ['diasTrabajados'],
      });
    }
  });

export const DistribucionParteSchema = z.object({
  id: z.string().min(1).max(80),
  nombre: z.string().min(1, 'Cada beneficiario debe tener nombre').max(120),
  porcentaje: z
    .number({ error: 'Porcentaje inválido' })
    .finite()
    .min(0, 'Los porcentajes no pueden ser negativos')
    .max(100, 'Un porcentaje no puede superar 100'),
  pagoDirecto: montoUsd,
});

const DIA_MS = 24 * 60 * 60 * 1000;

function diffDias(inicio: string, fin: string): number {
  return Math.round(
    (new Date(`${fin}T00:00:00Z`).getTime() - new Date(`${inicio}T00:00:00Z`).getTime()) / DIA_MS,
  );
}

/**
 * Payload de cierre V3. NO acepta `userId`: la identidad se resuelve
 * server-side con `supabase.auth.getUser()`.
 */
export const CierreNominaV3Schema = z
  .object({
    area: z.enum(['administracion', 'mina', 'planta', 'seguridad', 'transporte'], {
      error: 'Área de nómina inválida',
    }),
    inicio: fechaIso,
    fin: fechaIso,
    rows: z
      .array(RegistroCierreSchema)
      .min(1, 'El cierre requiere al menos un trabajador')
      .max(500, 'El cierre excede el máximo de trabajadores por semana'),
    distribucion: z
      .array(DistribucionParteSchema)
      .min(1, 'Agrega al menos un beneficiario')
      .max(20, 'Demasiados beneficiarios en la distribución'),
    modoCierre: z.enum(['operativo', 'historico_manual']).optional(),
    periodoManual: z
      .object({
        label: z.string(),
        rangeStart: fechaIso,
        rangeEnd: fechaIso,
        plantillaId: z.string().uuid().optional(),
      })
      .optional(),
  })
  .superRefine((p, ctx) => {
    if (diffDias(p.inicio, p.fin) !== 6) {
      ctx.addIssue({
        code: 'custom',
        message: 'La semana debe ser exactamente de 7 días (inicio a fin).',
        path: ['fin'],
      });
    }
    const vistos = new Set<string>();
    for (const r of p.rows) {
      if (vistos.has(r.personalId)) {
        ctx.addIssue({
          code: 'custom',
          message: 'Hay trabajadores duplicados en el cierre.',
          path: ['rows'],
        });
        break;
      }
      vistos.add(r.personalId);
    }
  });

/** Forma aceptada en el wire (antes de defaults de Zod). */
export type CierreNominaV3Input = z.input<typeof CierreNominaV3Schema>;
/** Forma ya validada/normalizada (después de `parse`). */
export type RegistroCierreInput = z.infer<typeof RegistroCierreSchema>;
export type CierreNominaV3Parsed = z.infer<typeof CierreNominaV3Schema>;

/** Subconjunto de `personal` (datos maestros de BD) que usa el recálculo. */
export type PersonalCierre = Pick<
  Personal,
  | 'id'
  | 'cedula'
  | 'nombre_completo'
  | 'cargo'
  | 'area'
  | 'area_detalle'
  | 'salario_base'
  | 'salario_libre'
  | 'bono_transporte'
  | 'esquema_rotacion'
  | 'rotacion_inicio_fecha'
>;

export type RegistroVerificado = {
  personal: PersonalCierre;
  input: RegistroCierreInput;
  /** Monto final a persistir (cliente, validado contra el recálculo). */
  montoPagado: number;
  /** Recalculados server-side (fuente: BD + reglas de ciclo). */
  salarioBaseCalculado: number;
  esSemanaLibre: boolean;
  totalRecalculado: number;
};

export type AjusteDetectado = {
  personalId: string;
  nombre: string;
  totalRecalculado: number;
  totalCliente: number;
  motivo: string;
  campos?: string[];
};

export type ChecksumCierreResult =
  | {
      ok: true;
      registros: RegistroVerificado[];
      totalNomina: number;
      ajustes: AjusteDetectado[];
    }
  | { ok: false; message: string };

/**
 * Checksum financiero: recalcula el total de cada fila con los datos
 * maestros de BD y las reglas de ciclo. Rechaza si difiere del total del
 * cliente en más de `CIERRE_TOLERANCIA_USD`, salvo `ajusteMotivo` explícito.
 */
export function verificarTotalesCierre(
  rows: RegistroCierreInput[],
  personalDb: PersonalCierre[],
  weekStart: string,
): ChecksumCierreResult {
  const byId = new Map(personalDb.map((p) => [p.id, p]));
  const registros: RegistroVerificado[] = [];
  const ajustes: AjusteDetectado[] = [];

  for (const row of rows) {
    const personal = byId.get(row.personalId);
    if (!personal) {
      return {
        ok: false,
        message: `Trabajador ${row.personalId} no existe en la base de datos. Recarga la pre-nómina.`,
      };
    }

    const pay = row.estatusPlantilla
      ? calculatePayForPlantillaNominaRow({
          estatus: row.estatusPlantilla as EstatusRotacionPlantilla,
          personal,
          estadoAsistencia: row.estadoAsistencia,
          diasTrabajados: row.diasTrabajados,
          bonoTransporte: row.bonoTransporte,
          bonificaciones: row.bonificaciones,
          totalVales: row.totalVales,
        })
      : calculateNominaRowPay({
          personal,
          estadoAsistencia: row.estadoAsistencia,
          diasTrabajados: row.diasTrabajados,
          weekStart,
          bonificaciones: row.bonificaciones,
          totalVales: row.totalVales,
        });

    const desviaciones: string[] = [];
    if (!row.estatusPlantilla) {
      const posicion = posicionEsquemaPersonal(personal, weekStart);
      const totalSemanas = totalSemanasEsquema(personal.esquema_rotacion);
      if (posicion !== null && totalSemanas > 1) {
        const asistenciaEsperada = asistenciaEsperadaPorPosicion(personal.esquema_rotacion, posicion);
        if (row.estadoAsistencia !== asistenciaEsperada) {
          desviaciones.push(
            `asistencia esperada ${asistenciaEsperada}, recibida ${row.estadoAsistencia}`,
          );
        }
        if (inputsDiasBloqueados(personal.esquema_rotacion, posicion) && row.diasTrabajados !== 0) {
          desviaciones.push('días trabajados modificados en una posición bloqueada por ciclo');
        }
      }
    }

    const baseCliente = row.salarioBaseCalculado;
    if (
      baseCliente !== undefined &&
      Math.abs(baseCliente - pay.salarioBaseCalculado) > CIERRE_TOLERANCIA_USD
    ) {
      desviaciones.push(
        `sueldo base calculado cliente $${baseCliente.toFixed(2)}, servidor $${pay.salarioBaseCalculado.toFixed(2)}`,
      );
    }

    if (Math.abs(row.bonoTransporte - pay.bonoTransporte) > CIERRE_TOLERANCIA_USD) {
      desviaciones.push(
        `bono transporte cliente $${row.bonoTransporte.toFixed(2)}, servidor $${pay.bonoTransporte.toFixed(2)}`,
      );
    }

    const diff = Math.abs(pay.total - row.total);
    if (diff > CIERRE_TOLERANCIA_USD) {
      desviaciones.push(
        `total cliente $${row.total.toFixed(2)}, servidor $${pay.total.toFixed(2)}`,
      );
    }

    if (desviaciones.length > 0) {
      if (!row.ajusteMotivo) {
        return {
          ok: false,
          message:
            `Ajuste no auditado para ${personal.nombre_completo}: ${desviaciones.join('; ')}. ` +
            'Recarga la pre-nómina o registra un ajuste explícito con motivo.',
        };
      }
      ajustes.push({
        personalId: personal.id,
        nombre: personal.nombre_completo,
        totalRecalculado: pay.total,
        totalCliente: row.total,
        motivo: row.ajusteMotivo,
        campos: desviaciones,
      });
    }

    registros.push({
      personal,
      input: row,
      montoPagado: row.total,
      salarioBaseCalculado: pay.salarioBaseCalculado,
      esSemanaLibre: pay.esSemanaLibre,
      totalRecalculado: pay.total,
    });
  }

  const totalNomina = parseFloat(
    registros.reduce((s, r) => s + r.montoPagado, 0).toFixed(2),
  );

  return { ok: true, registros, totalNomina, ajustes };
}
