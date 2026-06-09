-- ============================================================================
-- MIGRACIÓN: Seed Data — Perfiles de compensación y bonos iniciales
-- Propósito: Poblar catálogos con datos reales de la mina
-- ============================================================================

-- ============================================================================
-- 1. PERFILES DE COMPENSACIÓN
-- ============================================================================

INSERT INTO perfiles_compensacion (
    nombre, descripcion,
    esquema_rotacion_default,
    politica_dia_libre, politica_reposo,
    duracion_ciclo_dias, semanas_trabajadas_por_ciclo, semanas_libres_por_ciclo,
    bonos_automaticos, multiplicadores
) VALUES

-- Operativo Mina 14x7 (Vertical 1, 2, 3)
(
    'Operativo Mina 14x7',
    'Personal operativo de mina con rotación 2 semanas trabajo + 1 semana libre. Cobra tarifa plana en semana libre.',
    'MINA_2X1',
    'TARIFA_PLANA',
    'PAGO_COMPLETO',
    21, 2, 1,
    '[]'::JSONB,
    '{}'::JSONB
),

-- Operativo Mina 3 Grupos (rotación escalonada)
(
    'Operativo Mina 3 Grupos',
    'Personal de mina con rotación escalonada de 3 grupos (14x7).',
    'MINA_ROTATIVA_3G',
    'TARIFA_PLANA',
    'PAGO_COMPLETO',
    21, 2, 1,
    '[]'::JSONB,
    '{}'::JSONB
),

-- Molino Rotativo (7x7)
(
    'Molino Rotativo',
    'Personal de molino con rotación 1 semana trabajo + 1 semana libre.',
    'MOLINO_ROTATIVO',
    'SALARIO_LIBRE',
    'PARCIAL',
    14, 1, 1,
    '[]'::JSONB,
    '{}'::JSONB
),

-- Molino 15x15
(
    'Molino 15x15',
    'Personal de molino con ciclo de 4 semanas: 2 trabajadas + 1 libre + 1 no laborada. Bono transporte en posición 1.',
    'MOLINO_15X15',
    'SALARIO_LIBRE',
    'PARCIAL',
    28, 2, 1,
    '[{"tipo": "TRANSPORTE", "condicion": "POSICION_1", "monto": 30}]'::JSONB,
    '{}'::JSONB
),

-- Molino Fijo
(
    'Molino Fijo',
    'Personal fijo de molino, trabaja todas las semanas.',
    'MOLINO_FIJO',
    'SIN_PAGO',
    'PARCIAL',
    7, 1, 0,
    '[]'::JSONB,
    '{}'::JSONB
),

-- Administrativo / Fijo
(
    'Administrativo / Fijo',
    'Personal administrativo y de soporte. Flujo lineal semanal sin rotación.',
    'FIJO_SEMANAL',
    'SIN_PAGO',
    'PARCIAL',
    7, 1, 0,
    '[]'::JSONB,
    '{}'::JSONB
),

-- Cargos Especiales (Cocinera, Grupo Mixto, etc.)
(
    'Cargos Especiales',
    'Cargos con tarifas diferenciadas: Cocinera, Técnico Operador, Ayudante Barrenador, Grupo Mixto.',
    'FIJO_SEMANAL',
    'GARANTIZADO',
    'PAGO_COMPLETO',
    7, 1, 0,
    '[]'::JSONB,
    '{}'::JSONB
)

ON CONFLICT (nombre) DO NOTHING;

-- ============================================================================
-- 2. CATÁLOGO DE BONOS
-- ============================================================================

INSERT INTO nomina_bonos_catalogo (codigo, nombre, descripcion, monto_default, tipo_aplicacion) VALUES

('TRANSPORTE', 'Bono de Transporte', 'Bono por transporte al sitio de trabajo', 30.00, 'CONDICIONAL'),
('ALIMENTACION', 'Bono de Alimentación', 'Bono por alimentación durante el turno', 0.00, 'MANUAL'),
('PELIGROSIDAD', 'Bono de Peligrosidad', 'Recargo por trabajo en condiciones peligrosas', 0.00, 'MANUAL'),
('NOCTURNIDAD', 'Recargo Nocturno', 'Recargo por turno nocturno', 0.00, 'AUTOMATICO'),
('EXTRA', 'Bono Extra', 'Bono no catalogado, asignado manualmente', 0.00, 'MANUAL')

ON CONFLICT (codigo) DO NOTHING;

-- ============================================================================
-- 3. BACKFILL: Asignar perfiles a trabajadores existentes
-- ============================================================================

-- Operativos de mina con rotación 14x7
UPDATE personal
SET perfil_compensacion_id = (
    SELECT id FROM perfiles_compensacion WHERE nombre = 'Operativo Mina 14x7'
)
WHERE esquema_rotacion = 'MINA_2X1'
AND perfil_compensacion_id IS NULL;

-- Operativos de mina con rotación 3 grupos
UPDATE personal
SET perfil_compensacion_id = (
    SELECT id FROM perfiles_compensacion WHERE nombre = 'Operativo Mina 3 Grupos'
)
WHERE esquema_rotacion = 'MINA_ROTATIVA_3G'
AND perfil_compensacion_id IS NULL;

-- Molino rotativo
UPDATE personal
SET perfil_compensacion_id = (
    SELECT id FROM perfiles_compensacion WHERE nombre = 'Molino Rotativo'
)
WHERE esquema_rotacion = 'MOLINO_ROTATIVO'
AND perfil_compensacion_id IS NULL;

-- Molino 15x15
UPDATE personal
SET perfil_compensacion_id = (
    SELECT id FROM perfiles_compensacion WHERE nombre = 'Molino 15x15'
)
WHERE esquema_rotacion = 'MOLINO_15X15'
AND perfil_compensacion_id IS NULL;

-- Molino fijo
UPDATE personal
SET perfil_compensacion_id = (
    SELECT id FROM perfiles_compensacion WHERE nombre = 'Molino Fijo'
)
WHERE esquema_rotacion = 'MOLINO_FIJO'
AND perfil_compensacion_id IS NULL;

-- Administrativos y fijos semanales
UPDATE personal
SET perfil_compensacion_id = (
    SELECT id FROM perfiles_compensacion WHERE nombre = 'Administrativo / Fijo'
)
WHERE esquema_rotacion = 'FIJO_SEMANAL'
AND perfil_compensacion_id IS NULL;

-- Asignar vertical_asignada desde area_detalle si contiene "Vertical"
UPDATE personal
SET vertical_asignada = area_detalle
WHERE area_detalle ILIKE '%vertical%'
AND vertical_asignada IS NULL;
