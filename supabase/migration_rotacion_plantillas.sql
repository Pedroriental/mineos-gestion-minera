-- Sandbox de plantillas de rotación de personal (Nómina)
-- Relacional con nomina_semanas para cierre semanal auditado

CREATE TABLE IF NOT EXISTS rotacion_plantillas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre VARCHAR(150) NOT NULL,
  descripcion TEXT,
  area TEXT NOT NULL
    CHECK (area IN ('mina', 'planta', 'administracion', 'seguridad', 'transporte')),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rotacion_plantilla_semanas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plantilla_id UUID NOT NULL REFERENCES rotacion_plantillas(id) ON DELETE CASCADE,
  orden SMALLINT NOT NULL CHECK (orden >= 0 AND orden <= 12),
  nombre VARCHAR(80) NOT NULL,
  estatus_default TEXT NOT NULL DEFAULT 'trabajada_paga'
    CHECK (estatus_default IN (
      'trabajada_paga', 'libre_paga', 'libre_sin_pago',
      'no_laborada', 'reposo', 'vacaciones', 'bono_transporte_paga'
    )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (plantilla_id, orden)
);

CREATE TABLE IF NOT EXISTS rotacion_plantilla_asignaciones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plantilla_id UUID NOT NULL REFERENCES rotacion_plantillas(id) ON DELETE CASCADE,
  personal_id UUID NOT NULL REFERENCES personal(id) ON DELETE CASCADE,
  semana_id UUID NOT NULL REFERENCES rotacion_plantilla_semanas(id) ON DELETE CASCADE,
  estatus_override TEXT
    CHECK (estatus_override IS NULL OR estatus_override IN (
      'trabajada_paga', 'libre_paga', 'libre_sin_pago',
      'no_laborada', 'reposo', 'vacaciones', 'bono_transporte_paga'
    )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (plantilla_id, personal_id, semana_id)
);

-- Instancia en ejecución (ciclo activo de una plantilla)
CREATE TABLE IF NOT EXISTS rotacion_plantilla_instancias (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plantilla_id UUID NOT NULL REFERENCES rotacion_plantillas(id) ON DELETE RESTRICT,
  fecha_inicio_ciclo DATE NOT NULL,
  estado TEXT NOT NULL DEFAULT 'ACTIVA'
    CHECK (estado IN ('ACTIVA', 'COMPLETADA', 'CANCELADA')),
  semana_activa_orden SMALLINT NOT NULL DEFAULT 0,
  creado_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Semanas del ciclo enlazadas a nomina_semanas + subtotales de cierre
CREATE TABLE IF NOT EXISTS rotacion_instancia_semanas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instancia_id UUID NOT NULL REFERENCES rotacion_plantilla_instancias(id) ON DELETE CASCADE,
  plantilla_semana_id UUID NOT NULL REFERENCES rotacion_plantilla_semanas(id) ON DELETE RESTRICT,
  nomina_semana_id UUID REFERENCES nomina_semanas(id) ON DELETE SET NULL,
  orden SMALLINT NOT NULL CHECK (orden >= 0),
  semana_inicio DATE NOT NULL,
  semana_fin DATE NOT NULL,
  estado TEXT NOT NULL DEFAULT 'ABIERTA'
    CHECK (estado IN ('ABIERTA', 'CERRADA_AUDITADA', 'BLOQUEADA')),
  subtotal_usd NUMERIC(14,2) NOT NULL DEFAULT 0,
  subtotal_dias NUMERIC(8,2) NOT NULL DEFAULT 0,
  subtotal_bonos NUMERIC(14,2) NOT NULL DEFAULT 0,
  trabajadores_count INTEGER NOT NULL DEFAULT 0,
  cerrado_por UUID REFERENCES auth.users(id),
  cerrado_at TIMESTAMPTZ,
  balance_export JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (instancia_id, orden)
);

ALTER TABLE personal
  ADD COLUMN IF NOT EXISTS rotacion_plantilla_id UUID
    REFERENCES rotacion_plantillas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_rotacion_plantillas_area ON rotacion_plantillas(area);
CREATE INDEX IF NOT EXISTS idx_rotacion_plantilla_semanas_plantilla ON rotacion_plantilla_semanas(plantilla_id);
CREATE INDEX IF NOT EXISTS idx_rotacion_asignaciones_personal ON rotacion_plantilla_asignaciones(personal_id);
CREATE INDEX IF NOT EXISTS idx_rotacion_instancia_semanas_estado ON rotacion_instancia_semanas(instancia_id, estado);

ALTER TABLE rotacion_plantillas ENABLE ROW LEVEL SECURITY;
ALTER TABLE rotacion_plantilla_semanas ENABLE ROW LEVEL SECURITY;
ALTER TABLE rotacion_plantilla_asignaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE rotacion_plantilla_instancias ENABLE ROW LEVEL SECURITY;
ALTER TABLE rotacion_instancia_semanas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS auth_full_access_rotacion_plantillas ON rotacion_plantillas;
CREATE POLICY auth_full_access_rotacion_plantillas ON rotacion_plantillas FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS auth_full_access_rotacion_plantilla_semanas ON rotacion_plantilla_semanas;
CREATE POLICY auth_full_access_rotacion_plantilla_semanas ON rotacion_plantilla_semanas FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS auth_full_access_rotacion_plantilla_asignaciones ON rotacion_plantilla_asignaciones;
CREATE POLICY auth_full_access_rotacion_plantilla_asignaciones ON rotacion_plantilla_asignaciones FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS auth_full_access_rotacion_plantilla_instancias ON rotacion_plantilla_instancias;
CREATE POLICY auth_full_access_rotacion_plantilla_instancias ON rotacion_plantilla_instancias FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS auth_full_access_rotacion_instancia_semanas ON rotacion_instancia_semanas;
CREATE POLICY auth_full_access_rotacion_instancia_semanas ON rotacion_instancia_semanas FOR ALL TO authenticated USING (true) WITH CHECK (true);

COMMENT ON TABLE rotacion_plantillas IS 'Plantillas sandbox de rotación (14x14, 2x1, molino 2x2, etc.)';
COMMENT ON COLUMN rotacion_instancia_semanas.estado IS 'ABIERTA → editable; CERRADA_AUDITADA → subtotales fijos; bloquea traspaso a siguiente semana';
COMMENT ON COLUMN rotacion_instancia_semanas.balance_export IS 'JSON exportable a Balance General al cerrar semana';
