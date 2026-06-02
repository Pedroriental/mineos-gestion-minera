import { z } from 'zod';

export const ExtraccionSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD requerido'),
  turno: z.enum(['dia', 'noche', 'completo'], { message: 'Turno inválido' }),
  vertical: z.string().max(100).optional().nullable(),
  mina: z.string().max(100).optional().nullable(),
  responsable: z.string().max(150).optional().nullable(),
  hora_inicio: z.string().optional().nullable(),
  hora_fin: z.string().optional().nullable(),
  eventos: z.array(z.any()).optional().nullable(),
  sacos_extraidos: z.coerce.number().min(0, 'Los sacos no pueden ser negativos'),
  numero_disparo: z.string().max(50).optional().nullable(),
  observaciones: z.string().max(1000).optional().nullable(),
  registrado_por: z.string().uuid().optional().nullable(),
});

export const ExtraccionUpdateSchema = ExtraccionSchema.extend({
  id: z.string().uuid('ID inválido'),
});

export type ExtraccionInput = z.infer<typeof ExtraccionSchema>;
export type ExtraccionUpdate = z.infer<typeof ExtraccionUpdateSchema>;
