-- Cierre de mes de nómina: agrupa ciclos consolidados (cantidad libre, no 4 semanas fijas)

ALTER TABLE nomina_periodos
  DROP CONSTRAINT IF EXISTS nomina_periodos_origen_check;

ALTER TABLE nomina_periodos
  ADD CONSTRAINT nomina_periodos_origen_check
  CHECK (origen IN (
    'import_historico',
    'consolidacion_manual',
    'cierre_operativo',
    'cierre_mes'
  ));

CREATE TABLE IF NOT EXISTS nomina_mes_periodos (
  mes_periodo_id UUID NOT NULL REFERENCES nomina_periodos(id) ON DELETE CASCADE,
  ciclo_periodo_id UUID NOT NULL REFERENCES nomina_periodos(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (mes_periodo_id, ciclo_periodo_id),
  CONSTRAINT nomina_mes_periodos_ciclo_unique UNIQUE (ciclo_periodo_id)
);

CREATE INDEX IF NOT EXISTS idx_nomina_mes_periodos_mes ON nomina_mes_periodos(mes_periodo_id);

ALTER TABLE nomina_mes_periodos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS auth_full_access_nomina_mes_periodos ON nomina_mes_periodos;
CREATE POLICY auth_full_access_nomina_mes_periodos
  ON nomina_mes_periodos FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

COMMENT ON TABLE nomina_mes_periodos IS
  'Vincula un periodo cierre_mes con los ciclos consolidados incluidos (cada ciclo solo en un mes).';
