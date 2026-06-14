-- Permite estatus bono_transporte_paga en semanas de plantilla (columna solo bono, estilo Excel)

ALTER TABLE rotacion_plantilla_semanas
  DROP CONSTRAINT IF EXISTS rotacion_plantilla_semanas_estatus_default_check;

ALTER TABLE rotacion_plantilla_semanas
  ADD CONSTRAINT rotacion_plantilla_semanas_estatus_default_check
  CHECK (estatus_default IN (
    'trabajada_paga',
    'libre_paga',
    'libre_sin_pago',
    'no_laborada',
    'reposo',
    'vacaciones',
    'bono_transporte_paga'
  ));

ALTER TABLE rotacion_plantilla_asignaciones
  DROP CONSTRAINT IF EXISTS rotacion_plantilla_asignaciones_estatus_override_check;

ALTER TABLE rotacion_plantilla_asignaciones
  ADD CONSTRAINT rotacion_plantilla_asignaciones_estatus_override_check
  CHECK (
    estatus_override IS NULL
    OR estatus_override IN (
      'trabajada_paga',
      'libre_paga',
      'libre_sin_pago',
      'no_laborada',
      'reposo',
      'vacaciones',
      'bono_transporte_paga'
    )
  );

COMMENT ON CONSTRAINT rotacion_plantilla_semanas_estatus_default_check ON rotacion_plantilla_semanas IS
  'Incluye bono_transporte_paga: semana calendario dedicada al bono de transporte (sueldo en otra columna).';
