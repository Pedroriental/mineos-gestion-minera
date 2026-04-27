import { z } from 'zod';

export const AreaSchema = z.enum(['administracion', 'mina', 'planta', 'seguridad', 'transporte'], {
  errorMap: () => ({ message: 'Área inválida' }),
});

export const PersonalSchema = z.object({
  cedula: z.string().min(6, 'Cédula inválida').max(20),
  nombre_completo: z.string().min(2, 'Nombre requerido').max(150),
  cargo: z.string().min(2, 'Cargo requerido').max(100),
  area: AreaSchema,
  salario_base: z.coerce.number().positive('El salario debe ser mayor a 0'),
  telefono: z.string().max(50).optional().nullable(),
  notas: z.string().max(1000).optional().nullable(),
  fecha_ingreso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD requerido'),
});

export const PersonalUpdateSchema = PersonalSchema.extend({
  id: z.string().uuid('ID inválido'),
});

export const EmpleadoParseadoSchema = z.object({
  nombre_completo: z.string().min(2, 'Nombre requerido'),
  cedula: z.string().min(6, 'Cédula requerida'),
  cargo: z.string().min(2, 'Cargo requerido'),
  area: AreaSchema,
  salario_semanal: z.coerce.number().positive('El salario debe ser mayor a 0'),
  fecha_ingreso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD requerido'),
  _valid: z.literal(true),
});

export const ImportarPersonalSchema = z.array(EmpleadoParseadoSchema).min(1, 'No hay empleados válidos para importar');

export type PersonalInput = z.infer<typeof PersonalSchema>;
export type PersonalUpdate = z.infer<typeof PersonalUpdateSchema>;
export type EmpleadoParseadoType = z.infer<typeof EmpleadoParseadoSchema>;
