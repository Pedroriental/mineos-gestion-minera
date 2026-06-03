-- ============================================================
-- MineOS: Migración CRÍTICA — Foreign Keys de Integridad Referencial
-- Corrige FKs huérfanas definidas en schema.sql pero nunca aplicadas
-- Ejecutar en: Supabase Dashboard > SQL Editor > New Query
-- ============================================================
-- Validación previa: 0 registros huérfanos en todas las tablas.
-- Todos los UUIDs en registrado_por/aprobado_por/created_by/usuario_id
-- existen en auth.users. Esta migración es segura.
-- ============================================================

BEGIN;

-- ============================================================
-- BLOQUE 1: FKs definidas en schema.sql NUNCA aplicadas (11 tablas)
-- ============================================================

-- 1. nomina_pagos (nullable en schema.sql:42)
ALTER TABLE nomina_pagos
  ADD CONSTRAINT nomina_pagos_registrado_por_fkey
  FOREIGN KEY (registrado_por) REFERENCES auth.users(id);

-- 2. gastos (NOT NULL en schema.sql:65)
ALTER TABLE gastos
  ADD CONSTRAINT gastos_registrado_por_fkey
  FOREIGN KEY (registrado_por) REFERENCES auth.users(id);

-- 3. inventario_movimientos (NOT NULL en schema.sql:98)
ALTER TABLE inventario_movimientos
  ADD CONSTRAINT inventario_movimientos_registrado_por_fkey
  FOREIGN KEY (registrado_por) REFERENCES auth.users(id);

-- 4. compras_programadas.registrado_por (NOT NULL en schema.sql:117)
ALTER TABLE compras_programadas
  ADD CONSTRAINT compras_programadas_registrado_por_fkey
  FOREIGN KEY (registrado_por) REFERENCES auth.users(id);

-- 5. compras_programadas.aprobado_por (nullable en schema.sql:115)
ALTER TABLE compras_programadas
  ADD CONSTRAINT compras_programadas_aprobado_por_fkey
  FOREIGN KEY (aprobado_por) REFERENCES auth.users(id);

-- 6. cronograma_disparos (NOT NULL en schema.sql:144)
ALTER TABLE cronograma_disparos
  ADD CONSTRAINT cronograma_disparos_registrado_por_fkey
  FOREIGN KEY (registrado_por) REFERENCES auth.users(id);

-- 7. equipos_historial (nullable en schema.sql:189)
ALTER TABLE equipos_historial
  ADD CONSTRAINT equipos_historial_registrado_por_fkey
  FOREIGN KEY (registrado_por) REFERENCES auth.users(id);

-- 8. mejoras_seguridad (NOT NULL en schema.sql:206)
ALTER TABLE mejoras_seguridad
  ADD CONSTRAINT mejoras_seguridad_registrado_por_fkey
  FOREIGN KEY (registrado_por) REFERENCES auth.users(id);

-- 9. recepcion_material (NOT NULL en schema.sql:228)
ALTER TABLE recepcion_material
  ADD CONSTRAINT recepcion_material_registrado_por_fkey
  FOREIGN KEY (registrado_por) REFERENCES auth.users(id);

-- 10. procesamiento_planta (NOT NULL en schema.sql:246)
ALTER TABLE procesamiento_planta
  ADD CONSTRAINT procesamiento_planta_registrado_por_fkey
  FOREIGN KEY (registrado_por) REFERENCES auth.users(id);

-- 11. quemada_plancha (NOT NULL en schema.sql:269)
ALTER TABLE quemada_plancha
  ADD CONSTRAINT quemada_plancha_registrado_por_fkey
  FOREIGN KEY (registrado_por) REFERENCES auth.users(id);

-- 12. venta_arenas (NOT NULL en schema.sql:284)
ALTER TABLE venta_arenas
  ADD CONSTRAINT venta_arenas_registrado_por_fkey
  FOREIGN KEY (registrado_por) REFERENCES auth.users(id);

-- ============================================================
-- BLOQUE 2: FKs definidas en migraciones individuales NUNCA aplicadas
-- ============================================================

-- 13. nomina_semanas (nullable en migration_nomina_importacion.sql:14)
ALTER TABLE nomina_semanas
  ADD CONSTRAINT nomina_semanas_registrado_por_fkey
  FOREIGN KEY (registrado_por) REFERENCES auth.users(id);

-- 14. libro_guardia (NOT NULL en migration_libro_guardia.sql:23)
ALTER TABLE libro_guardia
  ADD CONSTRAINT libro_guardia_registrado_por_fkey
  FOREIGN KEY (registrado_por) REFERENCES auth.users(id);

-- 15. reportes_produccion (nullable en migration_produccion.sql:40)
ALTER TABLE reportes_produccion
  ADD CONSTRAINT reportes_produccion_registrado_por_fkey
  FOREIGN KEY (registrado_por) REFERENCES auth.users(id);

-- 16. reportes_extraccion (nullable en migration_extraccion.sql:15)
ALTER TABLE reportes_extraccion
  ADD CONSTRAINT reportes_extraccion_registrado_por_fkey
  FOREIGN KEY (registrado_por) REFERENCES auth.users(id);

-- ============================================================
-- BLOQUE 3: Tablas con registrado_por SIN FK definida en ningún SQL
-- ============================================================

-- 17. reportes_voladuras (nunca tuvo FK; column existe como uuid)
ALTER TABLE reportes_voladuras
  ADD CONSTRAINT reportes_voladuras_registrado_por_fkey
  FOREIGN KEY (registrado_por) REFERENCES auth.users(id);

-- 18. reportes_quemado (nunca tuvo FK; column existe como uuid)
ALTER TABLE reportes_quemado
  ADD CONSTRAINT reportes_quemado_registrado_por_fkey
  FOREIGN KEY (registrado_por) REFERENCES auth.users(id);

-- 19. nominas_cargadas (nunca tuvo FK; column existe como uuid)
ALTER TABLE nominas_cargadas
  ADD CONSTRAINT nominas_cargadas_registrado_por_fkey
  FOREIGN KEY (registrado_por) REFERENCES auth.users(id);

-- ============================================================
-- BLOQUE 4: Otras columnas de autoría sin FK
-- ============================================================

-- 20. nomina_periodos.created_by → auth.users(id)
ALTER TABLE nomina_periodos
  ADD CONSTRAINT nomina_periodos_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id);

-- 21. nomina_audit_log.usuario_id → cambiar tipo TEXT → UUID + FK
--     Validación: los 34 valores no-nulos son UUIDs válidos que existen en auth.users
ALTER TABLE nomina_audit_log
  ALTER COLUMN usuario_id TYPE UUID USING usuario_id::uuid;

ALTER TABLE nomina_audit_log
  ADD CONSTRAINT nomina_audit_log_usuario_id_fkey
  FOREIGN KEY (usuario_id) REFERENCES auth.users(id);

-- ============================================================
-- ÍNDICES para las nuevas FKs (optimización de JOINs)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_nomina_pagos_registrado_por ON nomina_pagos(registrado_por);
CREATE INDEX IF NOT EXISTS idx_gastos_registrado_por ON gastos(registrado_por);
CREATE INDEX IF NOT EXISTS idx_inventario_mov_registrado_por ON inventario_movimientos(registrado_por);
CREATE INDEX IF NOT EXISTS idx_compras_registrado_por ON compras_programadas(registrado_por);
CREATE INDEX IF NOT EXISTS idx_cronograma_registrado_por ON cronograma_disparos(registrado_por);
CREATE INDEX IF NOT EXISTS idx_equipos_hist_registrado_por ON equipos_historial(registrado_por);
CREATE INDEX IF NOT EXISTS idx_mejoras_registrado_por ON mejoras_seguridad(registrado_por);
CREATE INDEX IF NOT EXISTS idx_recepcion_registrado_por ON recepcion_material(registrado_por);
CREATE INDEX IF NOT EXISTS idx_procesamiento_registrado_por ON procesamiento_planta(registrado_por);
CREATE INDEX IF NOT EXISTS idx_quemada_registrado_por ON quemada_plancha(registrado_por);
CREATE INDEX IF NOT EXISTS idx_venta_arenas_registrado_por ON venta_arenas(registrado_por);
CREATE INDEX IF NOT EXISTS idx_nomina_semanas_registrado_por ON nomina_semanas(registrado_por);
CREATE INDEX IF NOT EXISTS idx_libro_guardia_registrado_por ON libro_guardia(registrado_por);
CREATE INDEX IF NOT EXISTS idx_reportes_prod_registrado_por ON reportes_produccion(registrado_por);
CREATE INDEX IF NOT EXISTS idx_reportes_ext_registrado_por ON reportes_extraccion(registrado_por);
CREATE INDEX IF NOT EXISTS idx_reportes_vol_registrado_por ON reportes_voladuras(registrado_por);
CREATE INDEX IF NOT EXISTS idx_reportes_quem_registrado_por ON reportes_quemado(registrado_por);
CREATE INDEX IF NOT EXISTS idx_nominas_cargadas_registrado_por ON nominas_cargadas(registrado_por);
CREATE INDEX IF NOT EXISTS idx_nomina_periodos_created_by ON nomina_periodos(created_by);
CREATE INDEX IF NOT EXISTS idx_nomina_audit_log_usuario_id ON nomina_audit_log(usuario_id);

COMMIT;

-- ============================================================
-- VERIFICACIÓN POST-MIGRACIÓN (ejecutar después del COMMIT)
-- ============================================================

-- Para verificar que las FKs se crearon correctamente:
-- SELECT tc.table_name, kcu.column_name, tc.constraint_name
-- FROM information_schema.table_constraints tc
-- JOIN information_schema.key_column_usage kcu USING (constraint_name)
-- WHERE tc.constraint_type = 'FOREIGN KEY'
--   AND kcu.column_name IN ('registrado_por', 'aprobado_por', 'created_by', 'usuario_id')
-- ORDER BY tc.table_name;
--
-- Debe arrojar 21 filas.
