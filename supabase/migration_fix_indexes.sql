-- =============================================================
-- MineOS - Migration: Índices faltantes
--
-- Agrega índices en columnas FK y de filtrado frecuente
-- que mejoran el rendimiento de las consultas.
-- =============================================================

-- Índices en FK a auth.users (consultas de "registrado por")
CREATE INDEX IF NOT EXISTS idx_nomina_pagos_registrado_por ON nomina_pagos(registrado_por);
CREATE INDEX IF NOT EXISTS idx_gastos_registrado_por ON gastos(registrado_por);
CREATE INDEX IF NOT EXISTS idx_inventario_movimientos_registrado_por ON inventario_movimientos(registrado_por);
CREATE INDEX IF NOT EXISTS idx_compras_registrado_por ON compras_programadas(registrado_por);
CREATE INDEX IF NOT EXISTS idx_cronograma_registrado_por ON cronograma_disparos(registrado_por);
CREATE INDEX IF NOT EXISTS idx_equipos_historial_registrado_por ON equipos_historial(registrado_por);
CREATE INDEX IF NOT EXISTS idx_mejoras_registrado_por ON mejoras_seguridad(registrado_por);
CREATE INDEX IF NOT EXISTS idx_recepcion_registrado_por ON recepcion_material(registrado_por);
CREATE INDEX IF NOT EXISTS idx_procesamiento_registrado_por ON procesamiento_planta(registrado_por);
CREATE INDEX IF NOT EXISTS idx_quemada_plancha_registrado_por ON quemada_plancha(registrado_por);
CREATE INDEX IF NOT EXISTS idx_venta_arenas_registrado_por ON venta_arenas(registrado_por);
CREATE INDEX IF NOT EXISTS idx_nomina_semanas_registrado_por ON nomina_semanas(registrado_por);
CREATE INDEX IF NOT EXISTS idx_nomina_periodos_created_by ON nomina_periodos(created_by);

-- Índices en columnas de estado y filtrado
CREATE INDEX IF NOT EXISTS idx_cronograma_estado ON cronograma_disparos(estado);
CREATE INDEX IF NOT EXISTS idx_cronograma_fecha_estado ON cronograma_disparos(fecha, estado);
CREATE INDEX IF NOT EXISTS idx_mejoras_tipo ON mejoras_seguridad(tipo);
CREATE INDEX IF NOT EXISTS idx_mejoras_area ON mejoras_seguridad(area);
CREATE INDEX IF NOT EXISTS idx_mejoras_prioridad ON mejoras_seguridad(prioridad);
CREATE INDEX IF NOT EXISTS idx_mejoras_estado ON mejoras_seguridad(estado);
CREATE INDEX IF NOT EXISTS idx_mejoras_fecha ON mejoras_seguridad(fecha);
CREATE INDEX IF NOT EXISTS idx_equipos_historial_fecha ON equipos_historial(fecha);
CREATE INDEX IF NOT EXISTS idx_reportes_extraccion_fecha ON reportes_extraccion(fecha);

-- Índices compuestos para queries comunes
CREATE INDEX IF NOT EXISTS idx_inventario_movimientos_fecha_tipo ON inventario_movimientos(fecha, tipo_movimiento);
CREATE INDEX IF NOT EXISTS idx_inventario_items_categoria ON inventario_items(categoria);
CREATE INDEX IF NOT EXISTS idx_inventario_items_activo ON inventario_items(activo);
CREATE INDEX IF NOT EXISTS idx_procesamiento_fecha_proceso ON procesamiento_planta(fecha, proceso);

-- Índices en FK de detalle (JOIN performance)
CREATE INDEX IF NOT EXISTS idx_disparos_detalle_cronograma ON disparos_detalle(cronograma_id);
CREATE INDEX IF NOT EXISTS idx_recepcion_material_disparo ON recepcion_material(disparo_id);
CREATE INDEX IF NOT EXISTS idx_procesamiento_recepcion ON procesamiento_planta(recepcion_id);
CREATE INDEX IF NOT EXISTS idx_quemada_plancha_procesamiento ON quemada_plancha(procesamiento_id);
CREATE INDEX IF NOT EXISTS idx_nomina_periodo_semanas_periodo ON nomina_periodo_semanas(periodo_id);
CREATE INDEX IF NOT EXISTS idx_nomina_periodo_semanas_semana ON nomina_periodo_semanas(semana_id);
