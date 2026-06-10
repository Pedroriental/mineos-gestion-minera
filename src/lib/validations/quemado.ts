import { z } from 'zod';

const PlanchaItemSchema = z.object({
  amalgama_g: z.coerce.number().min(0).default(0),
  oro_recuperado_g: z.coerce.number().min(0).default(0),
});

export const QuemadoSchema = z.object({
  fecha: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)')
    .refine((d) => !isNaN(Date.parse(d)), 'Fecha inválida'),

  turno: z.string().min(1, 'Turno requerido'),

  numero_quemada: z
    .string()
    .max(50, 'Máximo 50 caracteres')
    .optional()
    .nullable(),

  planchas: z.array(PlanchaItemSchema).default([]),

  manto_amalgama_g: z.coerce.number().min(0).optional().nullable(),
  manto_oro_g: z.coerce.number().min(0).optional().nullable(),
  retorta_oro_g: z.coerce.number().min(0).optional().nullable(),

  total_amalgama_g: z.coerce.number().min(0).default(0),
  total_oro_g: z.coerce.number().min(0).default(0),

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
});

export const QuemadoUpdateSchema = QuemadoSchema.extend({
  id: z.string().uuid('ID de registro inválido'),
});

export type QuemadoInput = z.infer<typeof QuemadoSchema>;
export type QuemadoUpdate = z.infer<typeof QuemadoUpdateSchema>;
