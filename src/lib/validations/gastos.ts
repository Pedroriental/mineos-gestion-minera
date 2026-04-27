/**
 * Esquemas de validación Zod para el módulo de Gastos.
 * Usados tanto en Server Actions (validación robusta) como
 * en el cliente (tipos exportados para el formulario).
 */
import { z } from 'zod';

// ── Schema base ──────────────────────────────────────────────
export const GastoSchema = z.object({
  fecha: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe estar en formato YYYY-MM-DD')
    .refine((d) => !isNaN(Date.parse(d)), 'Fecha inválida'),

  categoria_id: z
    .string()
    .uuid('Selecciona una categoría válida'),

  descripcion: z
    .string()
    .min(3,  'La descripción debe tener al menos 3 caracteres')
    .max(300, 'La descripción no puede superar 300 caracteres')
    .transform((s) => s.trim()),

  monto: z
    .number({ invalid_type_error: 'El monto debe ser un número' })
    .positive('El monto debe ser mayor que cero')
    .max(9_999_999, 'El monto parece fuera de rango'),

  proveedor: z
    .string()
    .max(150, 'Máximo 150 caracteres')
    .transform((s) => s.trim())
    .optional()
    .nullable(),

  factura_referencia: z
    .string()
    .max(100, 'Máximo 100 caracteres')
    .transform((s) => s.trim())
    .optional()
    .nullable(),

  notas: z
    .string()
    .max(500, 'Máximo 500 caracteres')
    .transform((s) => s.trim())
    .optional()
    .nullable(),

  registrado_por: z
    .string()
    .uuid()
    .optional()
    .nullable(),
});

// Para edición — el id es obligatorio
export const GastoUpdateSchema = GastoSchema.extend({
  id: z.string().uuid('ID de registro inválido'),
});

// ── Tipos inferidos ──────────────────────────────────────────
export type GastoInput  = z.infer<typeof GastoSchema>;
export type GastoUpdate = z.infer<typeof GastoUpdateSchema>;
