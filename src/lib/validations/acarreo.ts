import { z } from 'zod';

export const LineaAcarreoSchema = z.object({
  sacos: z.coerce.number().int('Los sacos deben ser enteros').positive('Cada línea debe tener al menos 1 saco'),
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

  mina: z.string().trim().min(1, 'Mina requerida').max(150),

  molino: z.string().trim().min(1, 'Molino destino requerido').max(150),

  lineas: z.array(LineaAcarreoSchema).min(1, 'Agrega al menos una línea de acarreo'),

  carga_total: z.coerce.number().int().positive('La carga total debe ser mayor a 0'),

  sacos_libres: z.coerce.number().int().min(0, 'Los sacos libres no pueden ser negativos'),

  observaciones: z.string().max(2000).optional().nullable(),

  registrado_por: z.string().uuid().optional().nullable(),
}).superRefine((data, ctx) => {
  const sumLineas = data.lineas.reduce((s, l) => s + l.sacos, 0);
  if (sumLineas !== data.carga_total) {
    ctx.addIssue({
      code: 'custom',
      message: `La carga total (${data.carga_total}) debe coincidir con la suma de líneas (${sumLineas})`,
      path: ['carga_total'],
    });
  }
});

export const AcarreoUpdateSchema = AcarreoSchema.extend({
  id: z.string().uuid('ID de registro inválido'),
});

export type AcarreoInput = z.infer<typeof AcarreoSchema>;
export type AcarreoUpdate = z.infer<typeof AcarreoUpdateSchema>;
