-- Banco de datos fiscales / legales para facturas, balances y planillas

CREATE TABLE IF NOT EXISTS fiscal_entidades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre_comercial VARCHAR(180) NOT NULL,
  razon_social VARCHAR(220) NOT NULL,
  rif VARCHAR(32) NOT NULL,
  direccion_fiscal TEXT NOT NULL,
  direccion_operativa TEXT,
  ciudad VARCHAR(80),
  estado_region VARCHAR(80),
  codigo_postal VARCHAR(20),
  pais VARCHAR(80) NOT NULL DEFAULT 'Venezuela',
  telefono VARCHAR(40),
  email VARCHAR(120),
  sitio_web VARCHAR(180),
  actividad_economica TEXT,
  es_emisor_principal BOOLEAN NOT NULL DEFAULT FALSE,
  notas TEXT,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fiscal_representantes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entidad_id UUID NOT NULL REFERENCES fiscal_entidades(id) ON DELETE CASCADE,
  nombre_completo VARCHAR(150) NOT NULL,
  cedula VARCHAR(20),
  cargo VARCHAR(100) NOT NULL DEFAULT 'Representante Legal',
  telefono VARCHAR(40),
  email VARCHAR(120),
  es_principal BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fiscal_cuentas_bancarias (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entidad_id UUID NOT NULL REFERENCES fiscal_entidades(id) ON DELETE CASCADE,
  banco VARCHAR(120) NOT NULL,
  tipo_cuenta VARCHAR(40) NOT NULL DEFAULT 'Corriente',
  numero_cuenta VARCHAR(64) NOT NULL,
  titular VARCHAR(180),
  moneda VARCHAR(8) NOT NULL DEFAULT 'USD',
  es_principal BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fiscal_textos_legales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug VARCHAR(80) NOT NULL UNIQUE,
  titulo VARCHAR(150) NOT NULL,
  categoria VARCHAR(32) NOT NULL DEFAULT 'general'
    CHECK (categoria IN ('factura', 'balance', 'planilla', 'general')),
  contenido TEXT NOT NULL DEFAULT '',
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fiscal_parametros (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clave VARCHAR(80) NOT NULL UNIQUE,
  etiqueta VARCHAR(150) NOT NULL,
  valor TEXT NOT NULL DEFAULT '',
  grupo VARCHAR(32) NOT NULL DEFAULT 'tributario'
    CHECK (grupo IN ('tributario', 'documento', 'numeracion', 'otro')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fiscal_entidades_emisor ON fiscal_entidades(es_emisor_principal);
CREATE INDEX IF NOT EXISTS idx_fiscal_representantes_entidad ON fiscal_representantes(entidad_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_cuentas_entidad ON fiscal_cuentas_bancarias(entidad_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_textos_categoria ON fiscal_textos_legales(categoria);

ALTER TABLE fiscal_entidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_representantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_cuentas_bancarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_textos_legales ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_parametros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_full_access" ON fiscal_entidades FOR ALL
  USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_full_access" ON fiscal_representantes FOR ALL
  USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_full_access" ON fiscal_cuentas_bancarias FOR ALL
  USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_full_access" ON fiscal_textos_legales FOR ALL
  USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_full_access" ON fiscal_parametros FOR ALL
  USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

CREATE TRIGGER set_updated_at BEFORE UPDATE ON fiscal_entidades
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON fiscal_representantes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON fiscal_cuentas_bancarias
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON fiscal_textos_legales
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON fiscal_parametros
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
