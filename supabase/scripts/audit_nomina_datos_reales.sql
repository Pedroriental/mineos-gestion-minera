-- ============================================================================
-- MineOS: auditoria no destructiva para alinear nomina con reglas reales
-- No modifica datos. Ejecutar antes de migrar/anclar rotaciones existentes.
-- ============================================================================

WITH asignaciones_validas(valor) AS (
  VALUES
    ('Vertical 1PD'),
    ('Vertical 2'),
    ('Molinos- Grupo (mixto)'),
    ('Administración'),
    ('Cocina'),
    ('Técnicos')
),
personal_audit AS (
  SELECT
    p.id,
    p.cedula,
    p.nombre_completo,
    p.area,
    p.area_detalle,
    p.cargo,
    p.perfil_compensacion_id,
    pc.nombre AS perfil_nombre,
    p.esquema_rotacion,
    pc.esquema_rotacion_default,
    p.rotacion_inicio_fecha,
    p.salario_base,
    p.salario_libre,
    p.bono_transporte,
    p.estado_laboral,
    p.activo,
    p.estatus
  FROM personal p
  LEFT JOIN perfiles_compensacion pc ON pc.id = p.perfil_compensacion_id
)
SELECT
  'PERFIL_FALTANTE' AS problema,
  *
FROM personal_audit
WHERE perfil_compensacion_id IS NULL
UNION ALL
SELECT
  'ESQUEMA_DIVERGENTE' AS problema,
  *
FROM personal_audit
WHERE perfil_compensacion_id IS NOT NULL
  AND esquema_rotacion IS DISTINCT FROM esquema_rotacion_default
UNION ALL
SELECT
  'ASIGNACION_INVALIDA' AS problema,
  *
FROM personal_audit
WHERE COALESCE(area_detalle, '') <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM asignaciones_validas av
    WHERE av.valor = personal_audit.area_detalle
  )
UNION ALL
SELECT
  'ROTACION_SIN_ANCLA' AS problema,
  *
FROM personal_audit
WHERE esquema_rotacion NOT IN ('FIJO_SEMANAL', 'MOLINO_FIJO')
  AND rotacion_inicio_fecha IS NULL
UNION ALL
SELECT
  'MOLINO_14X14_REVISAR_ANCLA_POS0' AS problema,
  *
FROM personal_audit
WHERE esquema_rotacion = 'MOLINO_14X14'
UNION ALL
SELECT
  'MINA_14X7_REVISAR_ANCLA_POS0' AS problema,
  *
FROM personal_audit
WHERE esquema_rotacion IN ('MINA_2X1', 'MINA_ROTATIVA_3G')
ORDER BY problema, area, area_detalle, nombre_completo;
