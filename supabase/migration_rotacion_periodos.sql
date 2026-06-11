-- Periodos operativos en instancias de rotación (aislar Mayo histórico vs Junio activo)

ALTER TABLE rotacion_plantilla_instancias
  ADD COLUMN IF NOT EXISTS periodo_operativo_label TEXT,
  ADD COLUMN IF NOT EXISTS periodo_operativo_inicio DATE,
  ADD COLUMN IF NOT EXISTS periodo_operativo_fin DATE;

COMMENT ON COLUMN rotacion_plantilla_instancias.periodo_operativo_label IS
  'Etiqueta humana del periodo operativo (ej. Junio 2026)';
COMMENT ON COLUMN rotacion_plantilla_instancias.periodo_operativo_inicio IS
  'Inicio del periodo donde aplica proyección por plantilla';
COMMENT ON COLUMN rotacion_plantilla_instancias.periodo_operativo_fin IS
  'Fin del periodo operativo (cargas históricas fuera de este rango no usan plantilla)';
