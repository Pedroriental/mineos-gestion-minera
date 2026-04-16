-- ============================================================
-- MineOS: Esquema de Base de Datos Completo
-- Ejecutar en Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- ============================================================

-- 0. Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- MÓDULO: ADMINISTRACIÓN E INVENTARIO
-- ============================================================

-- Personal / Nómina
CREATE TABLE personal (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cedula VARCHAR(20) UNIQUE NOT NULL,
    nombre_completo VARCHAR(150) NOT NULL,
    cargo VARCHAR(100) NOT NULL,
    area VARCHAR(50) NOT NULL CHECK (area IN ('mina', 'planta', 'administracion', 'seguridad', 'transporte')),
    salario_base NUMERIC(12,2) NOT NULL DEFAULT 0,
    fecha_ingreso DATE NOT NULL DEFAULT CURRENT_DATE,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    telefono VARCHAR(20),
    notas TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Pagos de Nómina
CREATE TABLE nomina_pagos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    personal_id UUID NOT NULL REFERENCES personal(id) ON DELETE RESTRICT,
    fecha_pago DATE NOT NULL,
    periodo_inicio DATE NOT NULL,
    periodo_fin DATE NOT NULL,
    salario_base NUMERIC(12,2) NOT NULL,
    bonificaciones NUMERIC(12,2) NOT NULL DEFAULT 0,
    deducciones NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_pagado NUMERIC(12,2) NOT NULL,
    metodo_pago VARCHAR(50) DEFAULT 'transferencia',
    observaciones TEXT,
    registrado_por UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Categorías de Gasto
CREATE TABLE categorias_gasto (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(100) NOT NULL UNIQUE,
    tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('mina', 'planta', 'general', 'transporte', 'seguridad', 'administrativo')),
    descripcion TEXT,
    activo BOOLEAN NOT NULL DEFAULT TRUE
);

-- Gastos Operativos
CREATE TABLE gastos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    categoria_id UUID NOT NULL REFERENCES categorias_gasto(id),
    descripcion VARCHAR(300) NOT NULL,
    monto NUMERIC(14,2) NOT NULL CHECK (monto > 0),
    proveedor VARCHAR(200),
    factura_referencia VARCHAR(100),
    notas TEXT,
    registrado_por UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Items de Inventario
CREATE TABLE inventario_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo VARCHAR(50) UNIQUE NOT NULL,
    nombre VARCHAR(200) NOT NULL,
    categoria VARCHAR(80) NOT NULL CHECK (categoria IN ('explosivos', 'combustible', 'herramientas', 'epp', 'quimicos', 'repuestos', 'otros')),
    unidad_medida VARCHAR(30) NOT NULL,
    stock_actual NUMERIC(12,3) NOT NULL DEFAULT 0,
    stock_minimo NUMERIC(12,3) NOT NULL DEFAULT 0,
    costo_unitario_promedio NUMERIC(14,4) NOT NULL DEFAULT 0,
    ubicacion VARCHAR(100),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Movimientos de Inventario
CREATE TABLE inventario_movimientos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID NOT NULL REFERENCES inventario_items(id) ON DELETE RESTRICT,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    tipo_movimiento VARCHAR(20) NOT NULL CHECK (tipo_movimiento IN ('entrada', 'salida', 'ajuste')),
    cantidad NUMERIC(12,3) NOT NULL,
    costo_unitario NUMERIC(14,4),
    costo_total NUMERIC(14,2),
    referencia VARCHAR(200),
    destino_area VARCHAR(50) CHECK (destino_area IN ('mina', 'planta', 'general')),
    observaciones TEXT,
    registrado_por UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Compras Programadas
CREATE TABLE compras_programadas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID REFERENCES inventario_items(id),
    descripcion VARCHAR(300) NOT NULL,
    cantidad_requerida NUMERIC(12,3) NOT NULL,
    unidad_medida VARCHAR(30) NOT NULL,
    fecha_requerida DATE NOT NULL,
    prioridad VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (prioridad IN ('baja', 'normal', 'alta', 'urgente')),
    estado VARCHAR(30) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobada', 'en_proceso', 'completada', 'cancelada')),
    proveedor_sugerido VARCHAR(200),
    costo_estimado NUMERIC(14,2),
    costo_real NUMERIC(14,2),
    aprobado_por UUID REFERENCES auth.users(id),
    notas TEXT,
    registrado_por UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- MÓDULO: MINA (EXTRACCIÓN)
-- ============================================================

-- Cronograma de Disparos
CREATE TABLE cronograma_disparos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    turno VARCHAR(20) NOT NULL CHECK (turno IN ('dia', 'noche', 'completo')),
    zona_mina VARCHAR(100) NOT NULL,
    nivel VARCHAR(50),
    numero_huecos INTEGER NOT NULL CHECK (numero_huecos > 0),
    profundidad_promedio_m NUMERIC(6,2),
    explosivo_tipo VARCHAR(100) NOT NULL,
    explosivo_cantidad_kg NUMERIC(10,3) NOT NULL,
    fulminantes_usados INTEGER NOT NULL DEFAULT 0,
    mecha_metros NUMERIC(8,2) NOT NULL DEFAULT 0,
    sacos_obtenidos INTEGER NOT NULL DEFAULT 0,
    estado VARCHAR(30) NOT NULL DEFAULT 'programado' CHECK (estado IN ('programado', 'ejecutado', 'cancelado', 'parcial')),
    hora_disparo TIME,
    responsable VARCHAR(150),
    observaciones TEXT,
    registrado_por UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Detalle de Disparos
CREATE TABLE disparos_detalle (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cronograma_id UUID NOT NULL REFERENCES cronograma_disparos(id) ON DELETE CASCADE,
    numero_disparo INTEGER NOT NULL,
    hora TIME,
    huecos INTEGER NOT NULL,
    explosivo_kg NUMERIC(10,3) NOT NULL,
    sacos_obtenidos INTEGER NOT NULL DEFAULT 0,
    resultado VARCHAR(100),
    observaciones TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Estado de Equipos
CREATE TABLE equipos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo VARCHAR(50) UNIQUE NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    tipo VARCHAR(80) NOT NULL CHECK (tipo IN ('compresor', 'perforadora', 'volqueta', 'bomba', 'generador', 'ventilador', 'otro')),
    ubicacion VARCHAR(100),
    estado VARCHAR(30) NOT NULL DEFAULT 'operativo' CHECK (estado IN ('operativo', 'en_mantenimiento', 'fuera_servicio', 'en_reparacion')),
    fecha_ultimo_mantenimiento DATE,
    proximo_mantenimiento DATE,
    horas_operacion NUMERIC(10,1) DEFAULT 0,
    observaciones TEXT,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Historial de Equipos
CREATE TABLE equipos_historial (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    equipo_id UUID NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    tipo_evento VARCHAR(50) NOT NULL CHECK (tipo_evento IN ('mantenimiento', 'reparacion', 'falla', 'inspeccion')),
    descripcion TEXT NOT NULL,
    costo NUMERIC(14,2) DEFAULT 0,
    tecnico VARCHAR(150),
    registrado_por UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Mejoras y Seguridad
CREATE TABLE mejoras_seguridad (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('mejora_infraestructura', 'mejora_proceso', 'incidente', 'inspeccion', 'capacitacion')),
    titulo VARCHAR(200) NOT NULL,
    descripcion TEXT NOT NULL,
    area VARCHAR(50) NOT NULL CHECK (area IN ('mina', 'planta', 'general')),
    prioridad VARCHAR(20) DEFAULT 'normal' CHECK (prioridad IN ('baja', 'normal', 'alta', 'critica')),
    estado VARCHAR(30) NOT NULL DEFAULT 'reportado' CHECK (estado IN ('reportado', 'en_proceso', 'completado', 'descartado')),
    costo_estimado NUMERIC(14,2),
    costo_real NUMERIC(14,2),
    responsable VARCHAR(150),
    registrado_por UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- MÓDULO: PLANTA (RECUPERACIÓN)
-- ============================================================

-- Recepción de Material
CREATE TABLE recepcion_material (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    turno VARCHAR(20) NOT NULL CHECK (turno IN ('dia', 'noche', 'completo')),
    origen VARCHAR(150) NOT NULL,
    disparo_id UUID REFERENCES cronograma_disparos(id),
    sacos_recibidos INTEGER NOT NULL CHECK (sacos_recibidos > 0),
    peso_estimado_kg NUMERIC(12,2),
    tipo_material VARCHAR(80) DEFAULT 'mineral_bruto',
    tenor_estimado_gpt NUMERIC(8,4),
    transportista VARCHAR(150),
    observaciones TEXT,
    registrado_por UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Procesamiento en Planta
CREATE TABLE procesamiento_planta (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    recepcion_id UUID REFERENCES recepcion_material(id),
    sacos_vaciados INTEGER NOT NULL CHECK (sacos_vaciados > 0),
    peso_procesado_kg NUMERIC(12,2) NOT NULL,
    tenor_real_gpt NUMERIC(8,4),
    proceso VARCHAR(80) NOT NULL CHECK (proceso IN ('molienda', 'concentracion', 'amalgamacion', 'cianuracion', 'flotacion', 'otro')),
    horas_proceso NUMERIC(6,2),
    quimicos_utilizados TEXT,
    estado VARCHAR(30) NOT NULL DEFAULT 'en_proceso' CHECK (estado IN ('en_proceso', 'completado', 'enviado_a_quemada')),
    observaciones TEXT,
    registrado_por UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ★★★ QUEMADA DE PLANCHA — Tabla crítica del negocio ★★★
CREATE TABLE quemada_plancha (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    procesamiento_id UUID REFERENCES procesamiento_planta(id),
    numero_quemada VARCHAR(50) NOT NULL,

    -- ★ CAMPO OBLIGATORIO: Gramos de oro puro recuperado ★
    gramos_oro_puro_recuperado NUMERIC(10,4) NOT NULL CHECK (gramos_oro_puro_recuperado >= 0),

    gramos_oro_bruto NUMERIC(10,4),
    porcentaje_pureza NUMERIC(5,2) CHECK (porcentaje_pureza BETWEEN 0 AND 100),
    temperatura_quemada NUMERIC(6,1),
    duracion_horas NUMERIC(5,2),
    responsable VARCHAR(150) NOT NULL,
    testigos TEXT,
    foto_referencia VARCHAR(500),
    observaciones TEXT,
    registrado_por UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Venta de Arenas
CREATE TABLE venta_arenas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    comprador VARCHAR(200) NOT NULL,
    cantidad_kg NUMERIC(12,2) NOT NULL CHECK (cantidad_kg > 0),
    precio_por_kg NUMERIC(10,2) NOT NULL,
    total_venta NUMERIC(14,2) NOT NULL,
    factura_referencia VARCHAR(100),
    observaciones TEXT,
    registrado_por UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- MÓDULO: DASHBOARD / BALANCE DIARIO
-- ============================================================

-- Cache del precio del oro
CREATE TABLE precio_oro_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fecha DATE NOT NULL,
    precio_usd_por_onza NUMERIC(12,4) NOT NULL,
    precio_usd_por_gramo NUMERIC(12,6) NOT NULL,
    fuente VARCHAR(100) NOT NULL DEFAULT 'goldapi',
    moneda_base VARCHAR(10) NOT NULL DEFAULT 'USD',
    consultado_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(fecha, fuente)
);

-- Balance Diario
CREATE TABLE balance_diario (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fecha DATE NOT NULL UNIQUE,

    -- Producción
    gramos_oro_recuperado_total NUMERIC(12,4) NOT NULL DEFAULT 0,

    -- Precio del oro del día
    precio_oro_usd_gramo NUMERIC(12,6) NOT NULL,
    precio_oro_usd_onza NUMERIC(12,4) NOT NULL,

    -- Ingresos
    ingreso_bruto_oro_usd NUMERIC(14,2) NOT NULL DEFAULT 0,
    ingreso_venta_arenas_usd NUMERIC(14,2) NOT NULL DEFAULT 0,
    ingreso_total_usd NUMERIC(14,2) NOT NULL DEFAULT 0,

    -- Gastos
    gasto_nomina_usd NUMERIC(14,2) NOT NULL DEFAULT 0,
    gasto_insumos_usd NUMERIC(14,2) NOT NULL DEFAULT 0,
    gasto_operativo_usd NUMERIC(14,2) NOT NULL DEFAULT 0,
    gasto_total_usd NUMERIC(14,2) NOT NULL DEFAULT 0,

    -- Resultado
    rentabilidad_usd NUMERIC(14,2) NOT NULL DEFAULT 0,
    margen_porcentaje NUMERIC(6,2),

    notas TEXT,
    generado_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES DE RENDIMIENTO
-- ============================================================

CREATE INDEX idx_gastos_fecha ON gastos(fecha);
CREATE INDEX idx_gastos_categoria ON gastos(categoria_id);
CREATE INDEX idx_inventario_mov_fecha ON inventario_movimientos(fecha);
CREATE INDEX idx_inventario_mov_item ON inventario_movimientos(item_id);
CREATE INDEX idx_cronograma_fecha ON cronograma_disparos(fecha);
CREATE INDEX idx_recepcion_fecha ON recepcion_material(fecha);
CREATE INDEX idx_procesamiento_fecha ON procesamiento_planta(fecha);
CREATE INDEX idx_quemada_fecha ON quemada_plancha(fecha);
CREATE INDEX idx_balance_fecha ON balance_diario(fecha);
CREATE INDEX idx_precio_oro_fecha ON precio_oro_cache(fecha);
CREATE INDEX idx_nomina_pagos_personal ON nomina_pagos(personal_id);
CREATE INDEX idx_nomina_pagos_fecha ON nomina_pagos(fecha_pago);
CREATE INDEX idx_compras_estado ON compras_programadas(estado);
CREATE INDEX idx_equipos_estado ON equipos(estado);
CREATE INDEX idx_venta_arenas_fecha ON venta_arenas(fecha);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- Solo usuarios autenticados tienen acceso completo (4 jefes)
-- ============================================================

ALTER TABLE personal ENABLE ROW LEVEL SECURITY;
ALTER TABLE nomina_pagos ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias_gasto ENABLE ROW LEVEL SECURITY;
ALTER TABLE gastos ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventario_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventario_movimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE compras_programadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE cronograma_disparos ENABLE ROW LEVEL SECURITY;
ALTER TABLE disparos_detalle ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipos ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipos_historial ENABLE ROW LEVEL SECURITY;
ALTER TABLE mejoras_seguridad ENABLE ROW LEVEL SECURITY;
ALTER TABLE recepcion_material ENABLE ROW LEVEL SECURITY;
ALTER TABLE procesamiento_planta ENABLE ROW LEVEL SECURITY;
ALTER TABLE quemada_plancha ENABLE ROW LEVEL SECURITY;
ALTER TABLE venta_arenas ENABLE ROW LEVEL SECURITY;
ALTER TABLE precio_oro_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE balance_diario ENABLE ROW LEVEL SECURITY;

-- Políticas: acceso total para autenticados
CREATE POLICY "auth_full_access" ON personal FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_full_access" ON nomina_pagos FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_full_access" ON categorias_gasto FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_full_access" ON gastos FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_full_access" ON inventario_items FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_full_access" ON inventario_movimientos FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_full_access" ON compras_programadas FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_full_access" ON cronograma_disparos FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_full_access" ON disparos_detalle FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_full_access" ON equipos FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_full_access" ON equipos_historial FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_full_access" ON mejoras_seguridad FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_full_access" ON recepcion_material FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_full_access" ON procesamiento_planta FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_full_access" ON quemada_plancha FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_full_access" ON venta_arenas FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_full_access" ON precio_oro_cache FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_full_access" ON balance_diario FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- ============================================================
-- FUNCIONES Y TRIGGERS
-- ============================================================

-- Auto-actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON personal FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON gastos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON inventario_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON compras_programadas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON cronograma_disparos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON equipos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON mejoras_seguridad FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON recepcion_material FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON procesamiento_planta FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON quemada_plancha FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON balance_diario FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-actualizar stock del inventario en movimientos
CREATE OR REPLACE FUNCTION actualizar_stock_inventario()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.tipo_movimiento = 'entrada' THEN
        UPDATE inventario_items SET stock_actual = stock_actual + NEW.cantidad WHERE id = NEW.item_id;
    ELSIF NEW.tipo_movimiento = 'salida' THEN
        UPDATE inventario_items SET stock_actual = stock_actual - NEW.cantidad WHERE id = NEW.item_id;
    ELSIF NEW.tipo_movimiento = 'ajuste' THEN
        UPDATE inventario_items SET stock_actual = NEW.cantidad WHERE id = NEW.item_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_actualizar_stock
    AFTER INSERT ON inventario_movimientos
    FOR EACH ROW EXECUTE FUNCTION actualizar_stock_inventario();

-- ============================================================
-- DATOS INICIALES: Categorías de Gasto
-- ============================================================

INSERT INTO categorias_gasto (nombre, tipo, descripcion) VALUES
    ('Explosivos y detonadores', 'mina', 'Dinamita, ANFO, fulminantes, mechas'),
    ('Combustible y lubricantes', 'general', 'Diesel, gasolina, aceites'),
    ('Mantenimiento de equipos', 'mina', 'Repuestos y servicio técnico'),
    ('Transporte de material', 'general', 'Fletes, combustible de volquetas'),
    ('Nómina operativa', 'general', 'Sueldos del personal de mina y planta'),
    ('Químicos de procesamiento', 'planta', 'Cianuro, mercurio, ácidos, reactivos'),
    ('Energía eléctrica', 'general', 'Factura de luz, generadores'),
    ('Alimentación', 'general', 'Comida del personal en mina'),
    ('Herramientas y EPP', 'mina', 'Equipos de protección personal y herramientas menores'),
    ('Gastos administrativos', 'administrativo', 'Contabilidad, permisos, impuestos'),
    ('Seguridad y vigilancia', 'seguridad', 'Personal de seguridad, cámaras'),
    ('Mejoras de infraestructura', 'mina', 'Fortificación, ventilación, drenaje');
