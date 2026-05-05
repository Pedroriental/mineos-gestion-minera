import { z } from 'zod';

export const ProduccionSchema = z.object({
  fecha: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)')
    .refine((d) => !isNaN(Date.parse(d)), 'Fecha inválida'),

  turno: z.enum(['dia', 'noche', 'completo'], {
    errorMap: () => ({ message: 'Turno inválido' }),
  }),

  molino: z.string().min(1, 'El molino es obligatorio').max(100),
  material: z.string().min(1, 'El material es obligatorio').max(150),
  
  material_codigo: z.string().max(50).optional().nullable(),

  amalgama_1_g: z.coerce.number().min(0, 'Amalgama 1 no puede ser negativa').optional().nullable(),
  amalgama_2_g: z.coerce.number().min(0, 'Amalgama 2 no puede ser negativa').optional().nullable(),
  
  oro_recuperado_g: z.coerce.number().min(0, 'El oro recuperado no puede ser negativo'),
  
  merma_1_pct: z.coerce.number().optional().nullable(),
  merma_2_pct: z.coerce.number().optional().nullable(),

  sacos: z.coerce.number().min(0, 'La cantidad de sacos no puede ser negativa'),
  toneladas_procesadas: z.coerce.number().min(0, 'Las toneladas no pueden ser negativas').optional().nullable(),
  
  tenor_tonelada_gpt: z.coerce.number().optional().nullable(),
  tenor_saco_gps: z.coerce.number().optional().nullable(),

  responsable: z.string().max(150).optional().nullable(),
  observaciones: z.string().max(1000).optional().nullable(),
  registrado_por: z.string().uuid().optional().nullable(),
});

export const ProduccionUpdateSchema = ProduccionSchema.extend({
  id: z.string().uuid('ID de registro inválido'),
});

export type ProduccionInput = z.infer<typeof ProduccionSchema>;
export type ProduccionUpdate = z.infer<typeof ProduccionUpdateSchema>;
