import { z } from 'zod';

const PlanchaItemSchema = z.object({
  amalgama_g: z.coerce.number().min(0).default(0),
  oro_recuperado_g: z.coerce.number().min(0).default(0),
}).refine(data => data.oro_recuperado_g <= data.amalgama_g, {
  message: 'Oro recuperado no puede ser mayor que amalgama',
  path: ['oro_recuperado_g'],
});

export const QuemadoSchema = z.object({
  fecha: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)')
    .refine((d) => !isNaN(Date.parse(d)), 'Fecha inválida'),

  turno: z.enum(['dia', 'noche', 'completo'], {
    errorMap: () => ({ message: 'Turno inválido' }),
  }),

  numero_quemada: z
    .string()
    .max(50, 'Máximo 50 caracteres')
    .optional()
    .nullable(),

  planchas: z.array(PlanchaItemSchema).min(1, 'Agrega al menos una plancha'),

  manto_amalgama_g: z.coerce.number().min(0).optional().nullable(),
  manto_oro_g: z.coerce.number().min(0).optional().nullable(),
  retorta_oro_g: z.coerce.number().min(0).optional().nullable(),

  total_amalgama_g: z.coerce.number().min(0),
  total_oro_g: z.coerce.number().positive('El oro recuperado total debe ser mayor a 0'),

  responsable: z
    .string()
    .max(150)
    .optional()
    .nullable(),

  observaciones: z
    .string()
    .max(1000)
    .optional()
    .nullable(),

  registrado_por: z.string().uuid().optional().nullable(),
}).refine(data => data.total_oro_g <= data.total_amalgama_g, {
  message: 'El oro total no puede superar la amalgama total',
  path: ['total_oro_g'],
});

export const QuemadoUpdateSchema = QuemadoSchema.extend({
  id: z.string().uuid('ID de registro inválido'),
});

export type QuemadoInput = z.infer<typeof QuemadoSchema>;
export type QuemadoUpdate = z.infer<typeof QuemadoUpdateSchema>;
