import { z } from 'zod';
import type { BibliotecaAppSnapshot } from '@/lib/biblioteca-catalog';
import { getBibliotecaValues, loadBibliotecaAppSnapshot } from '@/lib/biblioteca-catalog';

const BibliotecaModuloEnum = z.enum(
  ['general', 'nomina', 'mina', 'planta', 'operaciones', 'admin'],
  { message: 'Módulo inválido' },
);

export const BibliotecaCategoriaSchema = z.object({
  slug: z.string().max(100).optional(),
  nombre: z.string().min(1, 'El nombre es obligatorio').max(150),
  descripcion: z.string().max(500).optional().nullable(),
  modulo: BibliotecaModuloEnum.optional().default('general'),
  orden: z.coerce.number().int().min(0).optional().default(0),
});

export const BibliotecaCategoriaUpdateSchema = BibliotecaCategoriaSchema.extend({
  id: z.string().uuid('ID de categoría inválido'),
});

export const BibliotecaVariableSchema = z.object({
  categoria_id: z.string().uuid('Categoría inválida'),
  clave: z.string().max(100).optional(),
  etiqueta: z.string().min(1, 'La etiqueta es obligatoria').max(200),
  valor: z.string().max(500).optional(),
  unidad: z.string().max(50).optional().nullable(),
  descripcion: z.string().max(1000).optional().nullable(),
  orden: z.coerce.number().int().min(0).optional().default(0),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});

export const BibliotecaVariableUpdateSchema = BibliotecaVariableSchema.extend({
  id: z.string().uuid('ID de variable inválido'),
});

export const DeleteBibliotecaCategoriaSchema = z.object({
  id: z.string().uuid('ID de categoría inválido'),
});

export const DeleteBibliotecaVariableSchema = z.object({
  id: z.string().uuid('ID de variable inválido'),
});

export type BibliotecaCategoriaInput = z.infer<typeof BibliotecaCategoriaSchema>;
export type BibliotecaCategoriaUpdate = z.infer<typeof BibliotecaCategoriaUpdateSchema>;
export type BibliotecaVariableInput = z.infer<typeof BibliotecaVariableSchema>;
export type BibliotecaVariableUpdate = z.infer<typeof BibliotecaVariableUpdateSchema>;

export async function assertBibliotecaValue(
  slug: string,
  value: string,
  label: string,
  snapshot?: BibliotecaAppSnapshot,
): Promise<void> {
  const snap = snapshot ?? (await loadBibliotecaAppSnapshot());
  const allowed = getBibliotecaValues(snap, slug);
  if (!allowed.length) return;
  if (!allowed.includes(value)) {
    throw new Error(`${label} no válido. Valores permitidos: ${allowed.join(', ')}`);
  }
}
