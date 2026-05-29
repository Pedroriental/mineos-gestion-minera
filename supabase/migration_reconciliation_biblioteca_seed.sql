-- Seed categorías y variables para reconciliación / balance operativo

INSERT INTO biblioteca_categorias (slug, nombre, descripcion, modulo, orden, activo)
VALUES
  ('metas_produccion', 'Metas de producción', 'Metas para reconciliación y cumplimiento', 'operaciones', 200, true),
  ('tolerancias_reconciliacion', 'Tolerancias reconciliación', 'Umbrales de desvío entre fuentes', 'operaciones', 201, true),
  ('parametros_balance', 'Parámetros de balance', 'Precio oro y costos de referencia', 'operaciones', 202, true)
ON CONFLICT (slug) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  descripcion = EXCLUDED.descripcion,
  modulo = EXCLUDED.modulo,
  orden = EXCLUDED.orden,
  activo = true;

INSERT INTO biblioteca_variables (categoria_id, clave, etiqueta, valor, unidad, orden, activo, metadata)
SELECT c.id, v.clave, v.etiqueta, v.valor, v.unidad, v.orden, true, v.metadata::jsonb
FROM biblioteca_categorias c
CROSS JOIN (VALUES
  ('metas_produccion', 'meta_oro_g_dia', 'Meta oro (g/día)', '15', 'g', 1, '{}'),
  ('metas_produccion', 'meta_sacos_dia', 'Meta sacos (día)', '0', 'sacos', 2, '{}'),
  ('metas_produccion', 'meta_margen_pct', 'Meta margen %', '10', '%', 3, '{}'),
  ('metas_produccion', 'meta_recovery_pct', 'Meta recovery %', '60', '%', 4, '{}'),
  ('metas_produccion', 'meta_utilidad_min_usd', 'Utilidad mínima periodo USD', '0', 'USD', 5, '{}'),
  ('tolerancias_reconciliacion', 'tol_sacos_mina_planta_pct', 'Tolerancia sacos mina→planta', '8', '%', 1, '{}'),
  ('tolerancias_reconciliacion', 'tol_oro_planta_quemado_pct', 'Tolerancia oro planta→quemado', '5', '%', 2, '{}'),
  ('tolerancias_reconciliacion', 'tol_nomina_vs_semanas_pct', 'Tolerancia nómina registros vs semanas', '2', '%', 3, '{}'),
  ('tolerancias_reconciliacion', 'tol_rpc_ingreso_pct', 'Tolerancia ingreso motor vs RPC', '3', '%', 4, '{}'),
  ('parametros_balance', 'precio_oro_fuente', 'Fuente precio oro', 'cache', '', 1, '{}'),
  ('parametros_balance', 'precio_oro_manual_usd', 'Precio oro manual USD/g', '75', 'USD/g', 2, '{}'),
  ('parametros_balance', 'meta_costo_por_gramo_usd', 'Meta costo por gramo USD', '0', 'USD/g', 3, '{}'),
  ('parametros_balance', 'nomina_divisiones_json', 'Reparto nómina (JSON)', '[]', '', 4, '{}')
) AS v(cat_slug, clave, etiqueta, valor, unidad, orden, metadata)
WHERE c.slug = v.cat_slug
ON CONFLICT (categoria_id, clave) DO UPDATE SET
  etiqueta = EXCLUDED.etiqueta,
  valor = EXCLUDED.valor,
  unidad = EXCLUDED.unidad,
  orden = EXCLUDED.orden,
  activo = true;
