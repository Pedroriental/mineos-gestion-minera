-- Asistencia por semana: días trabajados y sueldo base calculado (proporcional)
ALTER TABLE nomina_registros
  ADD COLUMN IF NOT EXISTS estado_asistencia TEXT
    CHECK (estado_asistencia IS NULL OR estado_asistencia IN ('trabajada', 'libre', 'no_laborado')),
  ADD COLUMN IF NOT EXISTS dias_trabajados SMALLINT
    CHECK (dias_trabajados IS NULL OR (dias_trabajados >= 0 AND dias_trabajados <= 7)),
  ADD COLUMN IF NOT EXISTS salario_base_calculado NUMERIC(12, 2);

UPDATE nomina_registros
SET
  estado_asistencia = COALESCE(
    estado_asistencia,
    CASE WHEN es_semana_libre THEN 'libre' ELSE 'trabajada' END
  ),
  dias_trabajados = COALESCE(
    dias_trabajados,
    CASE
      WHEN monto_pagado <= 0 AND NOT es_semana_libre THEN 0
      ELSE 7
    END
  )
WHERE estado_asistencia IS NULL OR dias_trabajados IS NULL;

COMMENT ON COLUMN nomina_registros.estado_asistencia IS 'trabajada | libre | no_laborado';
COMMENT ON COLUMN nomina_registros.dias_trabajados IS 'Días laborados en la semana (0-7), base del cálculo proporcional';
COMMENT ON COLUMN nomina_registros.salario_base_calculado IS 'Sueldo base de la semana antes de bonos y vales';
