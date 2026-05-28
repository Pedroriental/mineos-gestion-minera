-- Biblioteca de variables reutilizables (catálogos centralizados)

CREATE TABLE IF NOT EXISTS biblioteca_categorias (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug VARCHAR(64) NOT NULL UNIQUE,
  nombre VARCHAR(120) NOT NULL,
  descripcion TEXT,
  modulo VARCHAR(32) NOT NULL DEFAULT 'general'
    CHECK (modulo IN ('general', 'nomina', 'mina', 'planta', 'operaciones', 'admin')),
  orden INT NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS biblioteca_variables (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  categoria_id UUID NOT NULL REFERENCES biblioteca_categorias(id) ON DELETE CASCADE,
  clave VARCHAR(80) NOT NULL,
  etiqueta VARCHAR(150) NOT NULL,
  valor TEXT NOT NULL DEFAULT '',
  unidad VARCHAR(40),
  descripcion TEXT,
  orden INT NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (categoria_id, clave)
);

CREATE INDEX IF NOT EXISTS idx_biblioteca_variables_categoria ON biblioteca_variables(categoria_id);
CREATE INDEX IF NOT EXISTS idx_biblioteca_variables_activo ON biblioteca_variables(activo);
CREATE INDEX IF NOT EXISTS idx_biblioteca_categorias_modulo ON biblioteca_categorias(modulo);

ALTER TABLE biblioteca_categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE biblioteca_variables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_full_access" ON biblioteca_categorias FOR ALL
  USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_full_access" ON biblioteca_variables FOR ALL
  USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

CREATE TRIGGER set_updated_at BEFORE UPDATE ON biblioteca_categorias
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON biblioteca_variables
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Catálogos iniciales (editables desde la app)
INSERT INTO biblioteca_categorias (slug, nombre, descripcion, modulo, orden) VALUES
  ('areas_nomina', 'Áreas de nómina', 'Módulos de nómina: mina, planta, administración, etc.', 'nomina', 10),
  ('cargos', 'Cargos', 'Puestos de trabajo reutilizables en personal y nómina.', 'nomina', 20),
  ('asignacion_nomina', 'Asignación nómina', 'Verticales, sectores o PD asignados en nómina.', 'nomina', 30),
  ('ubicaciones_laborales', 'Ubicaciones laborales', 'Sitio físico donde labora el trabajador.', 'nomina', 40),
  ('esquemas_rotacion', 'Esquemas de rotación', 'Patrones de asistencia y rotación de personal.', 'nomina', 50),
  ('minas', 'Minas', 'Unidades mineras de la operación.', 'mina', 60),
  ('verticales_voladura', 'Verticales (voladuras)', 'Verticales para reportes de disparo.', 'mina', 70),
  ('turnos', 'Turnos', 'Turnos operativos (día, noche, completo).', 'mina', 80),
  ('condimentos_voladura', 'Condimentos (voladuras)', 'Insumos de voladura registrados en reportes.', 'mina', 90),
  ('molinos', 'Molinos / planta', 'Instalaciones de procesamiento.', 'planta', 100)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO biblioteca_variables (categoria_id, clave, etiqueta, valor, unidad, orden)
SELECT c.id, v.clave, v.etiqueta, v.valor, v.unidad, v.orden
FROM biblioteca_categorias c
JOIN (VALUES
  ('areas_nomina', 'mina', 'Mina', 'mina', '', 1),
  ('areas_nomina', 'planta', 'Molinos / Planta', 'planta', '', 2),
  ('areas_nomina', 'administracion', 'Administración', 'administracion', '', 3),
  ('areas_nomina', 'seguridad', 'Seguridad', 'seguridad', '', 4),
  ('areas_nomina', 'transporte', 'Transporte', 'transporte', '', 5)
) AS v(cat_slug, clave, etiqueta, valor, unidad, orden) ON c.slug = v.cat_slug
ON CONFLICT (categoria_id, clave) DO NOTHING;

INSERT INTO biblioteca_variables (categoria_id, clave, etiqueta, valor, unidad, orden)
SELECT c.id, v.clave, v.etiqueta, v.valor, v.unidad, v.orden
FROM biblioteca_categorias c
JOIN (VALUES
  ('cargos', 'capataz', 'Capataz', '', '', 1),
  ('cargos', 'palero', 'Palero', '', '', 2),
  ('cargos', 'cocinero', 'Cocinero', '', '', 3),
  ('cargos', 'operador', 'Operador', '', '', 4),
  ('cargos', 'ayudante', 'Ayudante', '', '', 5)
) AS v(cat_slug, clave, etiqueta, valor, unidad, orden) ON c.slug = v.cat_slug
ON CONFLICT (categoria_id, clave) DO NOTHING;

INSERT INTO biblioteca_variables (categoria_id, clave, etiqueta, valor, unidad, orden)
SELECT c.id, v.clave, v.etiqueta, v.valor, v.unidad, v.orden
FROM biblioteca_categorias c
JOIN (VALUES
  ('asignacion_nomina', 'vertical_1', 'Vertical 1', 'Vertical 1', '', 1),
  ('asignacion_nomina', 'vertical_2', 'Vertical 2', 'Vertical 2', '', 2),
  ('asignacion_nomina', 'vertical_3', 'Vertical 3', 'Vertical 3', '', 3),
  ('asignacion_nomina', 'vertical_1pd', 'Vertical 1PD', 'Vertical 1PD', '', 4)
) AS v(cat_slug, clave, etiqueta, valor, unidad, orden) ON c.slug = v.cat_slug
ON CONFLICT (categoria_id, clave) DO NOTHING;

INSERT INTO biblioteca_variables (categoria_id, clave, etiqueta, valor, unidad, orden)
SELECT c.id, v.clave, v.etiqueta, v.valor, v.unidad, v.orden
FROM biblioteca_categorias c
JOIN (VALUES
  ('ubicaciones_laborales', 'mina_belen', 'Mina Belén', 'Mina Belén', '', 1),
  ('ubicaciones_laborales', 'mina_la_fe', 'Mina La Fé', 'Mina La Fé', '', 2),
  ('ubicaciones_laborales', 'molino_la_fe', 'Molino La Fé', 'Molino La Fé', '', 3),
  ('ubicaciones_laborales', 'administracion', 'Administración', 'Administración', '', 4),
  ('ubicaciones_laborales', 'oficina_central', 'Oficina central', 'Oficina central', '', 5)
) AS v(cat_slug, clave, etiqueta, valor, unidad, orden) ON c.slug = v.cat_slug
ON CONFLICT (categoria_id, clave) DO NOTHING;

INSERT INTO biblioteca_variables (categoria_id, clave, etiqueta, valor, unidad, orden)
SELECT c.id, v.clave, v.etiqueta, v.valor, v.unidad, v.orden
FROM biblioteca_categorias c
JOIN (VALUES
  ('esquemas_rotacion', 'FIJO_SEMANAL', 'Fijo semanal', 'FIJO_SEMANAL', 'días', 1),
  ('esquemas_rotacion', 'MINA_2X1', 'Mina 2×1', 'MINA_2X1', 'días', 2),
  ('esquemas_rotacion', 'MINA_ROTATIVA_3G', 'Mina 3G', 'MINA_ROTATIVA_3G', 'días', 3),
  ('esquemas_rotacion', 'MOLINO_FIJO', 'Molino fijo', 'MOLINO_FIJO', 'días', 4),
  ('esquemas_rotacion', 'MOLINO_ROTATIVO', 'Molino rotativo', 'MOLINO_ROTATIVO', 'días', 5),
  ('esquemas_rotacion', 'MOLINO_15X15', 'Molino 15×15', 'MOLINO_15X15', 'días', 6)
) AS v(cat_slug, clave, etiqueta, valor, unidad, orden) ON c.slug = v.cat_slug
ON CONFLICT (categoria_id, clave) DO NOTHING;

INSERT INTO biblioteca_variables (categoria_id, clave, etiqueta, valor, unidad, orden)
SELECT c.id, v.clave, v.etiqueta, v.valor, v.unidad, v.orden
FROM biblioteca_categorias c
JOIN (VALUES
  ('minas', 'mina_belen', 'Mina Belén', 'mina_belen', '', 1),
  ('minas', 'mina_la_fe', 'Mina La Fé', 'mina_la_fe', '', 2)
) AS v(cat_slug, clave, etiqueta, valor, unidad, orden) ON c.slug = v.cat_slug
ON CONFLICT (categoria_id, clave) DO NOTHING;

INSERT INTO biblioteca_variables (categoria_id, clave, etiqueta, valor, unidad, orden)
SELECT c.id, v.clave, v.etiqueta, v.valor, v.unidad, v.orden
FROM biblioteca_categorias c
JOIN (VALUES
  ('verticales_voladura', 'vertical_1', 'Vertical 1', 'Vertical 1', '', 1),
  ('verticales_voladura', 'vertical_2', 'Vertical 2', 'Vertical 2', '', 2),
  ('verticales_voladura', 'vertical_3', 'Vertical 3', 'Vertical 3', '', 3)
) AS v(cat_slug, clave, etiqueta, valor, unidad, orden) ON c.slug = v.cat_slug
ON CONFLICT (categoria_id, clave) DO NOTHING;

INSERT INTO biblioteca_variables (categoria_id, clave, etiqueta, valor, unidad, orden)
SELECT c.id, v.clave, v.etiqueta, v.valor, v.unidad, v.orden
FROM biblioteca_categorias c
JOIN (VALUES
  ('turnos', 'dia', 'Día', 'dia', '', 1),
  ('turnos', 'noche', 'Noche', 'noche', '', 2),
  ('turnos', 'completo', 'Completo', 'completo', '', 3)
) AS v(cat_slug, clave, etiqueta, valor, unidad, orden) ON c.slug = v.cat_slug
ON CONFLICT (categoria_id, clave) DO NOTHING;

INSERT INTO biblioteca_variables (categoria_id, clave, etiqueta, valor, unidad, orden)
SELECT c.id, v.clave, v.etiqueta, v.valor, v.unidad, v.orden
FROM biblioteca_categorias c
JOIN (VALUES
  ('condimentos_voladura', 'fosforos_lp', 'Fósforos LP', 'fosforos_lp', 'unid.', 1),
  ('condimentos_voladura', 'espaguetis', 'Espaguetis', 'espaguetis', 'unid.', 2),
  ('condimentos_voladura', 'vitamina_e', 'Vitamina E', 'vitamina_e', 'unid.', 3),
  ('condimentos_voladura', 'trenza', 'Trenza', 'trenza_metros', 'm', 4),
  ('condimentos_voladura', 'arroz', 'Arroz', 'arroz_kg', 'kg', 5)
) AS v(cat_slug, clave, etiqueta, valor, unidad, orden) ON c.slug = v.cat_slug
ON CONFLICT (categoria_id, clave) DO NOTHING;

INSERT INTO biblioteca_variables (categoria_id, clave, etiqueta, valor, unidad, orden)
SELECT c.id, v.clave, v.etiqueta, v.valor, v.unidad, v.orden
FROM biblioteca_categorias c
JOIN (VALUES
  ('molinos', 'molino_la_fe', 'Molino La Fé', 'molino_la_fe', '', 1)
) AS v(cat_slug, clave, etiqueta, valor, unidad, orden) ON c.slug = v.cat_slug
ON CONFLICT (categoria_id, clave) DO NOTHING;
