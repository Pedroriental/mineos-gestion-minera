import { z } from 'zod';

export const PersonalV2Schema = z.object({
  cedula: z.string().min(6, 'Cédula inválida').max(20),
  nombre_completo: z.string().min(2, 'Nombre requerido').max(150),
  cargo: z.string().min(2, 'Cargo requerido').max(100),
  area: z.string().min(1, 'Área requerida'),
  area_detalle: z.string().max(200).optional().default(''),
  salario_base: z.coerce.number().positive('El salario base debe ser mayor a 0'),
  salario_libre: z.coerce.number().min(0, 'Salario libre no puede ser negativo'),
  bono_transporte: z.coerce.number().min(0, 'Bono de transporte no puede ser negativo'),
  fecha_ingreso: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD requerido')
    .refine((d) => !isNaN(Date.parse(d)), 'Fecha inválida'),
});

export const PersonalV2UpdateSchema = PersonalV2Schema.extend({
  id: z.string().uuid('ID inválido'),
});

export const CierreNominaV2Schema = z.object({
  userId: z.string().uuid('ID de usuario inválido'),
  area: z.string().min(1, 'Área requerida'),
  inicio: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD requerido')
    .refine((d) => !isNaN(Date.parse(d)), 'Fecha inválida'),
  fin: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD requerido')
    .refine((d) => !isNaN(Date.parse(d)), 'Fecha inválida'),
  rows: z.array(z.any()).min(1, 'Debe haber al menos un registro'),
  pctPedro: z.coerce.number().min(0).max(100),
  pctDarinel: z.coerce.number().min(0).max(100),
  pctLaFe: z.coerce.number().min(0).max(100),
});

export const PersonalEstatusUpdateSchema = z.object({
  id: z.string().uuid('ID inválido'),
  estatus: z.enum(['ACTIVO', 'LIQUIDADO', 'INACTIVO'], {
    message: 'Estatus inválido',
  }),
});

export type PersonalV2Input = z.infer<typeof PersonalV2Schema>;
export type PersonalV2Update = z.infer<typeof PersonalV2UpdateSchema>;
export type CierreNominaV2Input = z.infer<typeof CierreNominaV2Schema>;
export type PersonalEstatusUpdate = z.infer<typeof PersonalEstatusUpdateSchema>;
