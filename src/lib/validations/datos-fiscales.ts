import { z } from 'zod';

export const FiscalEntidadSchema = z.object({
  nombre_comercial: z.string().min(1, 'Nombre comercial requerido').max(200),
  razon_social: z.string().min(1, 'Razón social requerida').max(300),
  rif: z.string().min(1, 'RIF requerido').max(20),
  direccion_fiscal: z.string().min(1, 'Dirección fiscal requerida').max(500),
  direccion_operativa: z.string().max(500).optional().nullable(),
  ciudad: z.string().max(100).optional().nullable(),
  estado_region: z.string().max(100).optional().nullable(),
  codigo_postal: z.string().max(20).optional().nullable(),
  pais: z.string().max(100).optional().default('Venezuela'),
  telefono: z.string().max(50).optional().nullable(),
  email: z.string().email('Email inválido').max(200).optional().nullable().or(z.literal('')),
  sitio_web: z.string().max(200).optional().nullable(),
  actividad_economica: z.string().max(300).optional().nullable(),
  es_emisor_principal: z.coerce.boolean().optional().default(false),
  notas: z.string().max(1000).optional().nullable(),
});

export const FiscalEntidadUpdateSchema = FiscalEntidadSchema.extend({
  id: z.string().uuid('ID de entidad inválido'),
});

export const FiscalRepresentanteSchema = z.object({
  entidad_id: z.string().uuid('Entidad inválida'),
  nombre_completo: z.string().min(1, 'Nombre requerido').max(200),
  cedula: z.string().max(20).optional().nullable(),
  cargo: z.string().max(200).optional().default('Representante Legal'),
  telefono: z.string().max(50).optional().nullable(),
  email: z.string().email('Email inválido').max(200).optional().nullable().or(z.literal('')),
  es_principal: z.coerce.boolean().optional().default(false),
});

export const FiscalRepresentanteUpdateSchema = FiscalRepresentanteSchema.extend({
  id: z.string().uuid('ID de representante inválido'),
});

const TipoCuentaEnum = z.enum(['Corriente', 'Ahorros', 'CORRIENTE', 'AHORROS'], {
  message: 'Tipo de cuenta inválido',
});

export const FiscalCuentaBancariaSchema = z.object({
  entidad_id: z.string().uuid('Entidad inválida'),
  banco: z.string().min(1, 'Banco requerido').max(150),
  tipo_cuenta: TipoCuentaEnum.optional().default('Corriente'),
  numero_cuenta: z.string().min(1, 'Número de cuenta requerido').max(50),
  titular: z.string().max(200).optional().nullable(),
  moneda: z.string().max(10).optional().default('USD'),
  es_principal: z.coerce.boolean().optional().default(false),
});

export const FiscalCuentaBancariaUpdateSchema = FiscalCuentaBancariaSchema.extend({
  id: z.string().uuid('ID de cuenta inválido'),
});

export const FiscalTextoCategoriaEnum = z.enum(
  ['factura', 'balance', 'planilla', 'general'],
  { message: 'Categoría de texto inválida' },
);

export const FiscalTextoLegalSchema = z.object({
  slug: z.string().min(1, 'Slug requerido').max(100),
  titulo: z.string().min(1, 'Título requerido').max(300),
  categoria: FiscalTextoCategoriaEnum,
  contenido: z.string().min(1, 'Contenido requerido'),
});

export const FiscalTextoLegalUpdateSchema = FiscalTextoLegalSchema.extend({
  id: z.string().uuid('ID de texto inválido'),
});

export const FiscalParametroGrupoEnum = z.enum(
  ['tributario', 'documento', 'numeracion', 'otro'],
  { message: 'Grupo de parámetro inválido' },
);

export const FiscalParametroSchema = z.object({
  clave: z.string().min(1, 'Clave requerida').max(100),
  etiqueta: z.string().min(1, 'Etiqueta requerida').max(200),
  valor: z.string().min(1, 'Valor requerido'),
  grupo: FiscalParametroGrupoEnum,
});

export const FiscalParametroUpdateSchema = FiscalParametroSchema.extend({
  id: z.string().uuid('ID de parámetro inválido'),
});

export type FiscalEntidadInput = z.infer<typeof FiscalEntidadSchema>;
export type FiscalEntidadUpdate = z.infer<typeof FiscalEntidadUpdateSchema>;
export type FiscalRepresentanteInput = z.infer<typeof FiscalRepresentanteSchema>;
export type FiscalRepresentanteUpdate = z.infer<typeof FiscalRepresentanteUpdateSchema>;
export type FiscalCuentaBancariaInput = z.infer<typeof FiscalCuentaBancariaSchema>;
export type FiscalCuentaBancariaUpdate = z.infer<typeof FiscalCuentaBancariaUpdateSchema>;
export type FiscalTextoLegalInput = z.infer<typeof FiscalTextoLegalSchema>;
export type FiscalTextoLegalUpdate = z.infer<typeof FiscalTextoLegalUpdateSchema>;
export type FiscalParametroInput = z.infer<typeof FiscalParametroSchema>;
export type FiscalParametroUpdate = z.infer<typeof FiscalParametroUpdateSchema>;
