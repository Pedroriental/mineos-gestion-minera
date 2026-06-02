-- ============================================================
-- MineOS - Migración para Módulo de Extracción y Auditoría de Nóminas
-- ============================================================

-- Alterar la tabla personal para manejar la prevalencia cronológica y control manual
ALTER TABLE public.personal
ADD COLUMN IF NOT EXISTS estado_manual_override BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ultimo_update_estado_at TIMESTAMP WITH TIME ZONE;

-- Corregir y ampliar el check constraint de estado_laboral para permitir el estado 'HISTORICO'
ALTER TABLE public.personal
  DROP CONSTRAINT IF EXISTS personal_estado_laboral_check;

ALTER TABLE public.personal
  ADD CONSTRAINT personal_estado_laboral_check
  CHECK (estado_laboral IN ('ACTIVO', 'DESPEDIDO', 'REPOSO', 'VACACIONES', 'REENGANCHADO', 'HISTORICO'));

-- Tabla para almacenar los metadatos de las nóminas cargadas y auditadas
CREATE TABLE IF NOT EXISTS public.nominas_cargadas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    periodo_inicio DATE NOT NULL,
    periodo_fin DATE NOT NULL,
    nombre_archivo VARCHAR(255) NOT NULL,
    fecha_carga TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    total_archivo NUMERIC(12, 2) NOT NULL,
    total_calculado NUMERIC(12, 2) NOT NULL,
    estado_auditoria VARCHAR(50) NOT NULL CHECK (estado_auditoria IN ('VALIDATED', 'DISCREPANCY')),
    discrepancias_log JSONB,
    registrado_por UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabla para registrar el detalle extraído de cada empleado, con referencia a su fila original
CREATE TABLE IF NOT EXISTS public.detalles_nomina (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nomina_id UUID NOT NULL REFERENCES public.nominas_cargadas(id) ON DELETE CASCADE,
    identificador_empleado VARCHAR(100), -- Cédula de identidad
    nombre VARCHAR(255) NOT NULL,
    sueldo_base NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    deducciones NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    neto NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    fila_origen_index INTEGER NOT NULL,
    personal_id UUID REFERENCES public.personal(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índices de alto rendimiento para auditorías e informes históricos
CREATE INDEX IF NOT EXISTS idx_nominas_cargadas_fechas ON public.nominas_cargadas(periodo_inicio, periodo_fin);
CREATE INDEX IF NOT EXISTS idx_detalles_nomina_nomina_id ON public.detalles_nomina(nomina_id);
CREATE INDEX IF NOT EXISTS idx_detalles_nomina_personal_id ON public.detalles_nomina(personal_id);
CREATE INDEX IF NOT EXISTS idx_detalles_nomina_identificador ON public.detalles_nomina(identificador_empleado);

-- Función PostgreSQL para actualizar de forma segura el estado de un trabajador respetando prioridades cronológicas y manuales
CREATE OR REPLACE FUNCTION public.fn_update_personal_state_from_import(
    p_personal_id UUID,
    p_nuevo_estado VARCHAR(50),
    p_nuevo_estatus VARCHAR(50),
    p_fecha_nomina TIMESTAMP WITH TIME ZONE
) RETURNS VOID AS $$
DECLARE
    v_override BOOLEAN;
    v_ultimo_update TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Obtener flags actuales del trabajador
    SELECT estado_manual_override, ultimo_update_estado_at
    INTO v_override, v_ultimo_update
    FROM public.personal
    WHERE id = p_personal_id;

    -- Si no existe el personal o tiene override manual activo, abortar actualización automática de estado
    IF NOT FOUND OR COALESCE(v_override, false) = true THEN
        RETURN;
    END IF;

    -- Si la fecha de la nómina es posterior (o igual) a la última registrada, actualizar estado
    IF v_ultimo_update IS NULL OR p_fecha_nomina >= v_ultimo_update THEN
        UPDATE public.personal
        SET 
            estado_laboral = p_nuevo_estado::public.personal.estado_laboral%TYPE,
            estatus = p_nuevo_estatus::public.personal.estatus%TYPE,
            ultimo_update_estado_at = p_fecha_nomina,
            activo = CASE WHEN p_nuevo_estatus = 'ACTIVO' THEN true ELSE false END
        WHERE id = p_personal_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
