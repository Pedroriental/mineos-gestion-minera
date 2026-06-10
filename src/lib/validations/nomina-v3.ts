import { z } from 'zod';
import { ASIGNACION_NOMINA_OPCIONES } from '@/lib/personal-master';

const asignacionNominaSchema = z.enum(ASIGNACION_NOMINA_OPCIONES, {
  error: 'Selecciona una asignación nómina válida (vertical/sector).',
});

export const PersonalV3Schema = z.object({
  cedula: z.string().min(6, 'Cédula inválida').max(20),
  nombre_completo: z.string().min(2, 'Nombre requerido').max(150),
  cargo: z.string().min(2, 'Cargo requerido').max(100),
  area: z.string().min(1, 'Área requerida'),
  area_detalle: asignacionNominaSchema,
  perfil_compensacion_id: z.string().uuid('El perfil de compensación es obligatorio'),
  salario_base: z.coerce.number().positive('El sueldo base semanal debe ser mayor a 0'),
  salario_libre: z.coerce.number().min(0, 'Salario libre no puede ser negativo').optional().default(0),
  bono_transporte: z.coerce.number().min(0, 'Bono de transporte no puede ser negativo'),
  telefono: z.string().max(50).optional().default(''),
  notas: z.string().max(1000).optional().default(''),
  fecha_ingreso: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD requerido')
    .refine((d) => !isNaN(Date.parse(d)), 'Fecha inválida'),
  esquema_rotacion: z.string().max(50).optional(),
  rotacion_inicio_fecha: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD requerido')
    .refine((d) => !isNaN(Date.parse(d)), 'Fecha inválida')
    .optional()
    .nullable()
    .default(null),
});

export const PersonalV3UpdateSchema = PersonalV3Schema.extend({
  id: z.string().uuid('ID inválido'),
});

export const AssignToNominaAreaSchema = z.object({
  personalId: z.string().uuid('ID de personal inválido'),
  targetArea: z.string().min(1, 'Área destino requerida'),
  areaDetalle: z.string().max(200).optional().nullable(),
});

export const CrearValeSchema = z.object({
  personalId: z.string().uuid('ID de personal inválido'),
  monto: z.coerce.number().positive('El monto debe ser mayor a 0'),
  motivo: z.string().min(1, 'Motivo requerido').max(300),
  fecha: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD requerido')
    .refine((d) => !isNaN(Date.parse(d)), 'Fecha inválida')
    .optional()
    .nullable(),
});

export type PersonalV3Input = z.infer<typeof PersonalV3Schema>;
export type PersonalV3Update = z.infer<typeof PersonalV3UpdateSchema>;
export type AssignToNominaAreaInput = z.infer<typeof AssignToNominaAreaSchema>;
export type CrearValeInput = z.infer<typeof CrearValeSchema>;
