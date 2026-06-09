import { z } from 'zod';
import type { BibliotecaAppSnapshot } from '@/lib/biblioteca-catalog';
import { getBibliotecaValues, loadBibliotecaAppSnapshot } from '@/lib/biblioteca-catalog';
import { resolveBibliotecaLabel } from '@/lib/biblioteca-display';
import { normalizeString } from '@/lib/reports/report-engine';

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
): Promise<string> {
  const snap = snapshot ?? (await loadBibliotecaAppSnapshot());
  const allowed = getBibliotecaValues(snap, slug);
  if (!allowed.length) return value;
  
  const normalizedValue = normalizeString(value);
  const matched = allowed.find((allow) => normalizeString(allow) === normalizedValue);

  if (!matched) {
    const displayAllowed = Array.from(
      new Set(allowed.map((a) => resolveBibliotecaLabel(snap, slug, a)).filter(Boolean)),
    );
    throw new Error(`${label} no válido. Valores permitidos: ${displayAllowed.join(', ')}`);
  }

  return resolveBibliotecaLabel(snap, slug, matched) || matched;
}
