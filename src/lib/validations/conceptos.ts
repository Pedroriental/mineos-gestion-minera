import { z } from 'zod';

export const GastoConceptoSchema = z.object({
  id: z.string().uuid().optional(),
  descripcion: z
    .string()
    .min(3, 'La descripción debe tener al menos 3 caracteres')
    .max(300, 'La descripción no puede exceder 300 caracteres'),
  categoria_default_id: z.string().uuid().nullable().optional(),
  proveedor_sugerido: z.string().max(200).nullable().optional(),
  monto_sugerido: z.coerce.number().min(0).nullable().optional(),
  notas: z.string().max(500).nullable().optional(),
  activo: z.boolean().optional(),
});

export type GastoConceptoInput = z.infer<typeof GastoConceptoSchema>;
