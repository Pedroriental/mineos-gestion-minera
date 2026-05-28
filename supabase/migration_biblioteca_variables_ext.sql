-- Extensión: más catálogos + metadata en variables existentes (esquemas / ubicaciones)

INSERT INTO biblioteca_categorias (slug, nombre, descripcion, modulo, orden) VALUES
  ('clima_guardia', 'Clima (guardia)', 'Condiciones climáticas en libro de guardia.', 'operaciones', 110),
  ('equipos_tipo', 'Tipos de equipo', 'Clasificación de equipos en mina.', 'mina', 120),
  ('equipos_estado', 'Estado de equipo', 'Estado operativo de equipos.', 'mina', 121),
  ('seguridad_tipo', 'Tipos (seguridad)', 'Tipos de registro de mejoras e incidentes.', 'mina', 130),
  ('areas_operativas', 'Áreas operativas', 'Mina, planta o general (seguridad, inventario).', 'general', 131),
  ('seguridad_prioridad', 'Prioridad (seguridad)', 'Prioridad de hallazgos de seguridad.', 'mina', 132),
  ('seguridad_estado', 'Estado (seguridad)', 'Estado del seguimiento de seguridad.', 'mina', 133),
  ('inventario_categoria', 'Categorías inventario', 'Rubros de artículos en inventario.', 'admin', 140),
  ('inventario_movimiento', 'Movimientos inventario', 'Tipos de movimiento de stock.', 'admin', 141),
  ('inventario_destino', 'Destino inventario', 'Ubicación destino de artículos.', 'admin', 142),
  ('procesamiento_tipo', 'Procesos (planta)', 'Tipos de proceso en planta.', 'planta', 150),
  ('procesamiento_estado', 'Estado procesamiento', 'Estado de lotes en procesamiento.', 'planta', 151),
  ('compras_prioridad', 'Prioridad compras', 'Prioridad de compras programadas.', 'admin', 160)
ON CONFLICT (slug) DO NOTHING;

-- Clima
INSERT INTO biblioteca_variables (categoria_id, clave, etiqueta, valor, orden, metadata)
SELECT c.id, v.clave, v.etiqueta, v.valor, v.orden, v.metadata::jsonb
FROM biblioteca_categorias c
JOIN (VALUES
  ('clima_guardia', 'despejado', 'Despejado', 'despejado', 1, '{"display_label":"☀️ Despejado"}'),
  ('clima_guardia', 'nublado', 'Nublado', 'nublado', 2, '{"display_label":"⛅ Nublado"}'),
  ('clima_guardia', 'lluvia', 'Lluvia', 'lluvia', 3, '{"display_label":"🌧️ Lluvia"}'),
  ('clima_guardia', 'tormenta', 'Tormenta', 'tormenta', 4, '{"display_label":"⛈️ Tormenta"}'),
  ('clima_guardia', 'neblina', 'Neblina', 'neblina', 5, '{"display_label":"🌫️ Neblina"}')
) AS v(cat_slug, clave, etiqueta, valor, orden, metadata) ON c.slug = v.cat_slug
ON CONFLICT (categoria_id, clave) DO NOTHING;

-- Equipos
INSERT INTO biblioteca_variables (categoria_id, clave, etiqueta, valor, orden)
SELECT c.id, v.clave, v.etiqueta, v.valor, v.orden
FROM biblioteca_categorias c
JOIN (VALUES
  ('equipos_tipo', 'compresor', 'Compresor', 'compresor', 1),
  ('equipos_tipo', 'perforadora', 'Perforadora', 'perforadora', 2),
  ('equipos_tipo', 'volqueta', 'Volqueta', 'volqueta', 3),
  ('equipos_tipo', 'bomba', 'Bomba', 'bomba', 4),
  ('equipos_tipo', 'generador', 'Generador', 'generador', 5),
  ('equipos_tipo', 'ventilador', 'Ventilador', 'ventilador', 6),
  ('equipos_tipo', 'otro', 'Otro', 'otro', 7),
  ('equipos_estado', 'operativo', 'Operativo', 'operativo', 1),
  ('equipos_estado', 'en_mantenimiento', 'Mantenimiento', 'en_mantenimiento', 2),
  ('equipos_estado', 'fuera_servicio', 'Fuera de servicio', 'fuera_servicio', 3),
  ('equipos_estado', 'en_reparacion', 'En reparación', 'en_reparacion', 4)
) AS v(cat_slug, clave, etiqueta, valor, orden) ON c.slug = v.cat_slug
ON CONFLICT (categoria_id, clave) DO NOTHING;

-- Seguridad
INSERT INTO biblioteca_variables (categoria_id, clave, etiqueta, valor, orden)
SELECT c.id, v.clave, v.etiqueta, v.valor, v.orden
FROM biblioteca_categorias c
JOIN (VALUES
  ('seguridad_tipo', 'mejora_infraestructura', 'Infraestructura', 'mejora_infraestructura', 1),
  ('seguridad_tipo', 'mejora_proceso', 'Proceso', 'mejora_proceso', 2),
  ('seguridad_tipo', 'incidente', 'Incidente', 'incidente', 3),
  ('seguridad_tipo', 'inspeccion', 'Inspección', 'inspeccion', 4),
  ('seguridad_tipo', 'capacitacion', 'Capacitación', 'capacitacion', 5),
  ('areas_operativas', 'mina', 'Mina', 'mina', 1),
  ('areas_operativas', 'planta', 'Planta', 'planta', 2),
  ('areas_operativas', 'general', 'General', 'general', 3),
  ('seguridad_prioridad', 'baja', 'Baja', 'baja', 1),
  ('seguridad_prioridad', 'normal', 'Normal', 'normal', 2),
  ('seguridad_prioridad', 'alta', 'Alta', 'alta', 3),
  ('seguridad_prioridad', 'critica', 'Crítica', 'critica', 4),
  ('seguridad_estado', 'reportado', 'Reportado', 'reportado', 1),
  ('seguridad_estado', 'en_proceso', 'En proceso', 'en_proceso', 2),
  ('seguridad_estado', 'completado', 'Completado', 'completado', 3),
  ('seguridad_estado', 'descartado', 'Descartado', 'descartado', 4)
) AS v(cat_slug, clave, etiqueta, valor, orden) ON c.slug = v.cat_slug
ON CONFLICT (categoria_id, clave) DO NOTHING;

-- Inventario
INSERT INTO biblioteca_variables (categoria_id, clave, etiqueta, valor, orden, metadata)
SELECT c.id, v.clave, v.etiqueta, v.valor, v.orden, v.metadata::jsonb
FROM biblioteca_categorias c
JOIN (VALUES
  ('inventario_categoria', 'explosivos', 'Explosivos', 'explosivos', 1, '{}'),
  ('inventario_categoria', 'combustible', 'Combustible', 'combustible', 2, '{}'),
  ('inventario_categoria', 'herramientas', 'Herramientas', 'herramientas', 3, '{}'),
  ('inventario_categoria', 'epp', 'EPP', 'epp', 4, '{}'),
  ('inventario_categoria', 'quimicos', 'Químicos', 'quimicos', 5, '{}'),
  ('inventario_categoria', 'repuestos', 'Repuestos', 'repuestos', 6, '{}'),
  ('inventario_categoria', 'otros', 'Otros', 'otros', 7, '{}'),
  ('inventario_movimiento', 'entrada', 'Entrada', 'entrada', 1, '{"display_label":"⬆ Entrada"}'),
  ('inventario_movimiento', 'salida', 'Salida', 'salida', 2, '{"display_label":"⬇ Salida"}'),
  ('inventario_movimiento', 'ajuste', 'Ajuste', 'ajuste', 3, '{"display_label":"↔ Ajuste"}'),
  ('inventario_destino', 'sin_ubicacion', 'Sin ubicación', '', 0, '{}'),
  ('inventario_destino', 'mina', 'Mina', 'mina', 1, '{}'),
  ('inventario_destino', 'planta', 'Planta', 'planta', 2, '{}'),
  ('inventario_destino', 'general', 'General', 'general', 3, '{}')
) AS v(cat_slug, clave, etiqueta, valor, orden, metadata) ON c.slug = v.cat_slug
ON CONFLICT (categoria_id, clave) DO NOTHING;

-- Procesamiento / compras
INSERT INTO biblioteca_variables (categoria_id, clave, etiqueta, valor, orden)
SELECT c.id, v.clave, v.etiqueta, v.valor, v.orden
FROM biblioteca_categorias c
JOIN (VALUES
  ('procesamiento_tipo', 'molienda', 'Molienda', 'molienda', 1),
  ('procesamiento_tipo', 'concentracion', 'Concentración', 'concentracion', 2),
  ('procesamiento_tipo', 'amalgamacion', 'Amalgamación', 'amalgamacion', 3),
  ('procesamiento_tipo', 'cianuracion', 'Cianuración', 'cianuracion', 4),
  ('procesamiento_tipo', 'flotacion', 'Flotación', 'flotacion', 5),
  ('procesamiento_tipo', 'otro', 'Otro', 'otro', 6),
  ('procesamiento_estado', 'en_proceso', 'En proceso', 'en_proceso', 1),
  ('procesamiento_estado', 'completado', 'Completado', 'completado', 2),
  ('procesamiento_estado', 'enviado_a_quemada', 'Enviado a quemada', 'enviado_a_quemada', 3),
  ('compras_prioridad', 'baja', 'Baja', 'baja', 1),
  ('compras_prioridad', 'normal', 'Normal', 'normal', 2),
  ('compras_prioridad', 'alta', 'Alta', 'alta', 3),
  ('compras_prioridad', 'urgente', 'Urgente', 'urgente', 4)
) AS v(cat_slug, clave, etiqueta, valor, orden) ON c.slug = v.cat_slug
ON CONFLICT (categoria_id, clave) DO NOTHING;

-- Metadata esquemas de rotación (si ya existen filas sin metadata)
UPDATE biblioteca_variables v SET metadata = '{"areas":["mina","planta","administracion","seguridad","transporte"]}'::jsonb
FROM biblioteca_categorias c WHERE v.categoria_id = c.id AND c.slug = 'esquemas_rotacion' AND v.clave = 'FIJO_SEMANAL';

UPDATE biblioteca_variables v SET metadata = '{"areas":["mina"],"default_for_area":"mina"}'::jsonb
FROM biblioteca_categorias c WHERE v.categoria_id = c.id AND c.slug = 'esquemas_rotacion' AND v.clave = 'MINA_2X1';

UPDATE biblioteca_variables v SET metadata = '{"areas":["mina"]}'::jsonb
FROM biblioteca_categorias c WHERE v.categoria_id = c.id AND c.slug = 'esquemas_rotacion' AND v.clave IN ('MINA_ROTATIVA_3G');

UPDATE biblioteca_variables v SET metadata = '{"areas":["planta"]}'::jsonb
FROM biblioteca_categorias c WHERE v.categoria_id = c.id AND c.slug = 'esquemas_rotacion' AND v.clave = 'MOLINO_FIJO';

UPDATE biblioteca_variables v SET metadata = '{"areas":["planta"],"default_for_area":"planta"}'::jsonb
FROM biblioteca_categorias c WHERE v.categoria_id = c.id AND c.slug = 'esquemas_rotacion' AND v.clave = 'MOLINO_ROTATIVO';

UPDATE biblioteca_variables v SET metadata = '{"areas":["planta"]}'::jsonb
FROM biblioteca_categorias c WHERE v.categoria_id = c.id AND c.slug = 'esquemas_rotacion' AND v.clave = 'MOLINO_15X15';
