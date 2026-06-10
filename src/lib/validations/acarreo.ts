import { z } from 'zod';

export const INFORME_PENDIENTE_LABEL = 'Pendiente';

export const LineaAcarreoSchema = z.object({
  sacos: z.coerce.number().int('Los sacos deben ser enteros').min(0, 'Los sacos no pueden ser negativos'),
  vertical: z
    .string()
    .max(80)
    .optional()
    .nullable()
    .transform((v) => v?.trim() || undefined),
  disparo: z
    .string()
    .max(40)
    .optional()
    .nullable()
    .transform((v) => v?.trim() || undefined),
});

export const AcarreoSchema = z.object({
  fecha: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)')
    .refine((d) => !Number.isNaN(Date.parse(d)), 'Fecha inválida'),

  turno: z.enum(['dia', 'noche', 'completo'], { message: 'Turno requerido' }),

  mina: z
    .string()
    .max(150)
    .optional()
    .nullable()
    .transform((v) => v?.trim() || INFORME_PENDIENTE_LABEL),

  molino: z
    .string()
    .max(150)
    .optional()
    .nullable()
    .transform((v) => v?.trim() || INFORME_PENDIENTE_LABEL),

  lineas: z.array(LineaAcarreoSchema).default([]),

  carga_total: z.coerce.number().int().min(0, 'La carga total no puede ser negativa').default(0),

  sacos_libres: z.coerce.number().int().min(0, 'Los sacos libres no pueden ser negativos').default(0),

  observaciones: z.string().max(2000).optional().nullable(),

  registrado_por: z.string().uuid().optional().nullable(),
});

export const AcarreoUpdateSchema = AcarreoSchema.extend({
  id: z.string().uuid('ID de registro inválido'),
});

export type AcarreoInput = z.infer<typeof AcarreoSchema>;
export type AcarreoUpdate = z.infer<typeof AcarreoUpdateSchema>;
