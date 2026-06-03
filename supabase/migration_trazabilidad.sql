-- ============================================================
-- MineOS: Conexiones de trazabilidad — reportes ↔ cadena producción
-- Añade FKs opcionales para poder rastrear cada reporte hasta su
-- recepción/procesamiento de origen.
-- Columnas NULLables: compatibles con datos históricos existentes.
-- ============================================================

BEGIN;

-- 1. reportes_extraccion → recepcion_material
--    Los sacos extraídos llegan a recepción
ALTER TABLE reportes_extraccion
  ADD COLUMN IF NOT EXISTS recepcion_id UUID REFERENCES recepcion_material(id);

-- 2. reportes_voladuras → recepcion_material
--    Cada voladura genera material que se recibe en planta
ALTER TABLE reportes_voladuras
  ADD COLUMN IF NOT EXISTS recepcion_id UUID REFERENCES recepcion_material(id);

-- 3. reportes_produccion → procesamiento_planta
--    La producción (molienda) es el resultado del procesamiento
ALTER TABLE reportes_produccion
  ADD COLUMN IF NOT EXISTS procesamiento_id UUID REFERENCES procesamiento_planta(id);

-- 4. reportes_quemado → procesamiento_planta
--    El quemado/retorta es el paso final del procesamiento
ALTER TABLE reportes_quemado
  ADD COLUMN IF NOT EXISTS procesamiento_id UUID REFERENCES procesamiento_planta(id);

-- ============================================================
-- Conexiones producción ↔ finanzas
-- ============================================================

-- 5. venta_arenas → procesamiento_planta
--    Las arenas vendidas provienen de un procesamiento específico
ALTER TABLE venta_arenas
  ADD COLUMN IF NOT EXISTS procesamiento_id UUID REFERENCES procesamiento_planta(id);

-- 6. Índices para las nuevas FKs
CREATE INDEX IF NOT EXISTS idx_reportes_ext_recepcion ON reportes_extraccion(recepcion_id);
CREATE INDEX IF NOT EXISTS idx_reportes_vol_recepcion ON reportes_voladuras(recepcion_id);
CREATE INDEX IF NOT EXISTS idx_reportes_prod_procesamiento ON reportes_produccion(procesamiento_id);
CREATE INDEX IF NOT EXISTS idx_reportes_quem_procesamiento ON reportes_quemado(procesamiento_id);
CREATE INDEX IF NOT EXISTS idx_venta_arenas_procesamiento ON venta_arenas(procesamiento_id);

COMMIT;

-- ============================================================
-- RESULTADO: Ahora es posible trazar el ciclo completo:
--
--   reportes_voladuras ──► recepcion_material ──► procesamiento_planta
--   reportes_extraccion ──┘                             │
--                                                       ├──► reportes_produccion
--                                                       ├──► reportes_quemado
--                                                       └──► venta_arenas
-- ============================================================
