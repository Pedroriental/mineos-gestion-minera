/**
 * Esquemas de validación Zod — Módulo de Voladuras.
 *
 * Modo borrador: solo fecha y turno son obligatorios; el resto puede ir vacío o en cero.
 */
import { z } from 'zod';
import {
  aggregateChupisLineas,
  aggregateHuecosLineas,
} from '@/lib/voladuras-huecos-chupis';

function toNonNegativeNumber(value: unknown, fallback = 0): number {
  if (value === '' || value === null || value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
}

function toNonNegativeInt(value: unknown, fallback = 0): number {
  return Math.trunc(toNonNegativeNumber(value, fallback));
}

const nonNegativeNumber = (fallback = 0) =>
  z.preprocess((value) => toNonNegativeNumber(value, fallback), z.number().min(0));

const nonNegativeInt = (fallback = 0) =>
  z.preprocess((value) => toNonNegativeInt(value, fallback), z.number().int().min(0));

const optionalTrimmed = (max: number) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => {
      const trimmed = (value ?? '').trim();
      return trimmed || null;
    })
    .pipe(z.string().max(max).nullable());

// ── Pausa de barrenado (JSON embebido) ────────────────────────
const PausaBarrenadoSchema = z.object({
  hora_inicio: z.string().optional().nullable(),
  hora_fin: z.string().optional().nullable(),
  motivo: z.string().max(200, 'Motivo muy largo').default(''),
});

const LineaHuecoSchema = z.object({
  tipo: z.enum(['hueco', 'hueco_salida']),
  cantidad: nonNegativeInt(),
  pies: nonNegativeInt(),
});

const LineaChupiSchema = z.object({
  cantidad: nonNegativeInt(),
  pies: nonNegativeInt(),
});

// ── Schema base — crear ───────────────────────────────────────
const VoladuraBaseSchema = z.object({
  fecha: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)')
    .refine((d) => !isNaN(Date.parse(d)), 'Fecha inválida'),

  turno: z.string().min(1, 'Turno requerido'),

  mina: optionalTrimmed(100),
  responsable: optionalTrimmed(150),

  hora_inicio_barrenado: z.union([z.string(), z.null(), z.undefined()]).transform((v) => v?.trim() || null),
  hora_fin_barrenado: z.union([z.string(), z.null(), z.undefined()]).transform((v) => v?.trim() || null),

  numero_disparo: optionalTrimmed(10),

  hora_disparo: z.union([z.string(), z.null(), z.undefined()]).transform((v) => v?.trim() || null),
  vertical_disparo: optionalTrimmed(50),

  sin_novedad: z.boolean().default(true),

  huecos_cantidad: nonNegativeInt(),
  huecos_pies: nonNegativeInt(),
  chupis_cantidad: nonNegativeInt(),
  chupis_pies: nonNegativeInt(),

  huecos_lineas: z.array(LineaHuecoSchema).optional().default([]),
  chupis_lineas: z.array(LineaChupiSchema).optional().default([]),

  fosforos_lp: nonNegativeInt(),
  espaguetis: nonNegativeInt(),
  vitamina_e: nonNegativeInt(),
  trenza_metros: nonNegativeNumber(),
  arroz_kg: nonNegativeNumber(),

  pausas_barrenado: z.array(PausaBarrenadoSchema).optional().nullable(),

  observaciones_disparo: optionalTrimmed(1000),
  observaciones: optionalTrimmed(1000),

  registrado_por: z.string().uuid().optional().nullable(),
});

type VoladuraParsed = z.infer<typeof VoladuraBaseSchema>;

function applyVoladuraAggregates(data: VoladuraParsed) {
  const huecosAgg = data.huecos_lineas.length > 0
    ? aggregateHuecosLineas(data.huecos_lineas)
    : { cantidad: data.huecos_cantidad, pies: data.huecos_pies };
  const chupisAgg = data.chupis_lineas.length > 0
    ? aggregateChupisLineas(data.chupis_lineas)
    : { cantidad: data.chupis_cantidad, pies: data.chupis_pies };

  return {
    ...data,
    huecos_cantidad: huecosAgg.cantidad,
    huecos_pies: huecosAgg.pies,
    chupis_cantidad: chupisAgg.cantidad,
    chupis_pies: chupisAgg.pies,
  };
}

export const VoladuraSchema = VoladuraBaseSchema.transform(applyVoladuraAggregates);

// ── Schema para UPDATE — requiere id ─────────────────────────
export const VoladuraUpdateSchema = VoladuraBaseSchema.extend({
  id: z.string().uuid('ID de registro inválido'),
}).transform(applyVoladuraAggregates);

// ── Tipos inferidos ──────────────────────────────────────────
export type VoladuraInput  = z.infer<typeof VoladuraSchema>;
export type VoladuraUpdate = z.infer<typeof VoladuraUpdateSchema>;
