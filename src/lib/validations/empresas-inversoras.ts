import { z } from 'zod';

export const EmpresaInversoraSchema = z.object({
  id: z.string().uuid().optional(),
  complex_id: z.string().uuid().optional(),
  nombre: z.string().min(1, 'El nombre es obligatorio').max(100),
  nombre_corto: z
    .string()
    .min(1, 'El nombre corto es obligatorio')
    .max(20)
    .regex(/^[a-z0-9_]+$/, 'Solo letras minúsculas, números y guión bajo'),
  porcentaje_participacion: z
    .number({ message: 'El porcentaje debe ser un número' })
    .min(0, 'El porcentaje no puede ser negativo')
    .max(100, 'El porcentaje no puede ser mayor a 100'),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Color debe ser formato hexadecimal (#RRGGBB)')
    .optional()
    .nullable(),
  activo: z.boolean().default(true),
  notas: z.string().max(500, 'Máximo 500 caracteres').optional().nullable(),
});

export const GastoEmpresaSchema = z.object({
  id: z.string().uuid().optional(),
  gasto_id: z.string().uuid('ID de gasto inválido'),
  empresa_id: z.string().uuid('ID de empresa inválido'),
  monto_pagado: z
    .number({ message: 'El monto debe ser un número' })
    .min(0, 'El monto no puede ser negativo'),
  porcentaje: z
    .number({ message: 'El porcentaje debe ser un número' })
    .min(0, 'El porcentaje no puede ser negativo')
    .max(100, 'El porcentaje no puede ser mayor a 100'),
  es_pago_directo: z.boolean().default(true),
  notas: z.string().max(500, 'Máximo 500 caracteres').optional().nullable(),
});

export type EmpresaInversoraInput = z.infer<typeof EmpresaInversoraSchema>;
export type GastoEmpresaInput = z.infer<typeof GastoEmpresaSchema>;
