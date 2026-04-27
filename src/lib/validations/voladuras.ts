/**
 * Esquemas de validación Zod — Módulo de Voladuras.
 *
 * Usados en Server Actions (validación robusta en servidor).
 * Los campos numéricos vienen como string desde el form y se
 * coercionan a number con z.coerce.number() antes de guardar.
 */
import { z } from 'zod';

// ── Pausa de barrenado (JSON embebido) ────────────────────────
const PausaBarrenadoSchema = z.object({
  hora_inicio: z.string().min(1, 'Hora de parada requerida'),
  hora_fin:    z.string().min(1, 'Hora de reinicio requerida'),
  motivo:      z.string().max(200, 'Motivo muy largo').default(''),
});

// ── Schema base — crear ───────────────────────────────────────
export const VoladuraSchema = z.object({
  fecha: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)')
    .refine((d) => !isNaN(Date.parse(d)), 'Fecha inválida'),

  turno: z.enum(['dia', 'noche', 'completo'], {
    errorMap: () => ({ message: 'Turno inválido' }),
  }),

  mina: z
    .string()
    .max(100, 'Máximo 100 caracteres')
    .transform((s) => s.trim())
    .optional()
    .nullable(),

  responsable: z
    .string()
    .max(150, 'Máximo 150 caracteres')
    .transform((s) => s.trim())
    .optional()
    .nullable(),

  hora_inicio_barrenado: z.string().optional().nullable(),
  hora_fin_barrenado:    z.string().optional().nullable(),

  numero_disparo: z
    .string()
    .max(10, 'Máximo 10 caracteres')
    .optional()
    .nullable(),

  hora_disparo:    z.string().optional().nullable(),
  vertical_disparo: z.string().max(50, 'Máximo 50 caracteres').optional().nullable(),

  sin_novedad: z.boolean().default(true),

  huecos_cantidad: z.coerce
    .number({ invalid_type_error: 'Debe ser un número' })
    .int('Debe ser entero')
    .min(0, 'No puede ser negativo')
    .default(0),

  huecos_pies: z.coerce
    .number({ invalid_type_error: 'Debe ser un número' })
    .int('Debe ser entero')
    .min(0)
    .default(0),

  chupis_cantidad: z.coerce
    .number({ invalid_type_error: 'Debe ser un número' })
    .int('Debe ser entero')
    .min(0)
    .default(0),

  chupis_pies: z.coerce
    .number({ invalid_type_error: 'Debe ser un número' })
    .int('Debe ser entero')
    .min(0)
    .default(0),

  fosforos_lp: z.coerce.number().int().min(0).default(0),
  espaguetis:  z.coerce.number().int().min(0).default(0),
  vitamina_e:  z.coerce.number().int().min(0).default(0),

  trenza_metros: z.coerce
    .number({ invalid_type_error: 'Debe ser un número' })
    .min(0)
    .default(0),

  arroz_kg: z.coerce
    .number({ invalid_type_error: 'Debe ser un número' })
    .min(0, 'No puede ser negativo')
    .default(0),

  pausas_barrenado: z.array(PausaBarrenadoSchema).optional().nullable(),

  observaciones_disparo: z
    .string()
    .max(1000, 'Máximo 1000 caracteres')
    .transform((s) => s.trim())
    .optional()
    .nullable(),

  observaciones: z
    .string()
    .max(1000, 'Máximo 1000 caracteres')
    .transform((s) => s.trim())
    .optional()
    .nullable(),

  registrado_por: z.string().uuid().optional().nullable(),
});

// ── Schema para UPDATE — requiere id ─────────────────────────
export const VoladuraUpdateSchema = VoladuraSchema.extend({
  id: z.string().uuid('ID de registro inválido'),
});

// ── Tipos inferidos ──────────────────────────────────────────
export type VoladuraInput  = z.infer<typeof VoladuraSchema>;
export type VoladuraUpdate = z.infer<typeof VoladuraUpdateSchema>;
