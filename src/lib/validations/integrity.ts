import { z } from 'zod';

export const IntegrityDiscrepancySchema = z.object({
  modulo: z.enum(['nomina', 'gastos', 'produccion', 'balance']),
  severidad: z.enum(['CRITICO', 'ADVERTENCIA']),
  mensaje: z.string(),
  fecha_ref: z.string().nullable(),
  valor_esper: z.number().nullable(),
  valor_real: z.number().nullable(),
  diferencia: z.number(),
});

export const VerificationResultSchema = z.object({
  ok: z.boolean(),
  totalDiscrepancias: z.number(),
  criticas: z.number(),
  advertencias: z.number(),
  discrepancias: z.array(IntegrityDiscrepancySchema),
  verificadoEn: z.string(),
});

export type IntegrityDiscrepancy = z.infer<typeof IntegrityDiscrepancySchema>;
export type VerificationResult = z.infer<typeof VerificationResultSchema>;
