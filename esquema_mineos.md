# Esquema de Base de Datos — MineOS

> Generado: Junio 2026
> Base de datos: PostgreSQL vía Supabase
> Total: **35 tablas** en esquema `public` + `auth.users` (Supabase Auth)

---

## Índice

- [Vista General](#vista-general)
- [Convenciones](#convenciones)
- [Módulo: Nómina y Personal](#módulo-nómina-y-personal)
- [Módulo: Gastos](#módulo-gastos)
- [Módulo: Producción (Mina y Planta)](#módulo-producción-mina-y-planta)
- [Módulo: Finanzas](#módulo-finanzas)
- [Módulo: Inventario y Compras](#módulo-inventario-y-compras)
- [Módulo: Equipos y Seguridad](#módulo-equipos-y-seguridad)
- [Módulo: Fiscal / Plataforma](#módulo-fiscal--plataforma)
- [Módulo: Biblioteca de Variables](#módulo-biblioteca-de-variables)
- [Módulo: Libro de Guardia](#módulo-libro-de-guardia)
- [Diagrama de Relaciones](#diagrama-de-relaciones)
- [Foreign Keys a `auth.users`](#foreign-keys-a-authusers)

---

## Vista General

| Métrica | Valor |
|---|---|
| Tablas totales | 35 |
| Foreign Keys entre tablas del negocio | 25 |
| Foreign Keys hacia `auth.users` (autoría) | 18 |
| Columnas totales | ~540 |
| Módulos representados | 9 |

### Listado completo de tablas

| # | Tabla | Módulo | Propósito |
|---|-------|--------|-----------|
| 1 | `personal` | Nómina | Maestro de trabajadores |
| 2 | `nomina_periodos` | Nómina | Períodos de nómina |
| 3 | `nomina_periodo_semanas` | Nómina | Join períodos ↔ semanas |
| 4 | `nomina_semanas` | Nómina | Semanas de nómina procesadas |
| 5 | `nomina_registros` | Nómina | Montos pagados por trabajador/semana |
| 6 | `nomina_vales` | Nómina | Adelantos y vales |
| 7 | `nomina_pagos` | Nómina | Pagos realizados |
| 8 | `nomina_cierres` | Nómina | Distribución de costos por socio |
| 9 | `nomina_audit_log` | Nómina | Auditoría de cambios |
| 10 | `categorias_gasto` | Gastos | Categorías de gasto |
| 11 | `gastos` | Gastos | Registros de gasto |
| 12 | `gasto_conceptos` | Gastos | Conceptos/plantillas de gasto |
| 13 | `recepcion_material` | Producción | Recepción de material en planta |
| 14 | `procesamiento_planta` | Producción | Procesamiento (molienda, etc.) |
| 15 | `reportes_voladuras` | Producción | Reportes operativos de voladuras |
| 16 | `reportes_extraccion` | Producción | Reportes operativos de extracción |
| 17 | `reportes_produccion` | Producción | Reportes diarios de molinos |
| 18 | `reportes_quemado` | Producción | Reportes de retorta/quemado |
| 19 | `compras_programadas` | Inventario | Compras/insumos planificados |
| 20 | `inventario_items` | Inventario | Items de inventario |
| 21 | `inventario_movimientos` | Inventario | Movimientos de inventario |
| 22 | `venta_arenas` | Finanzas | Ventas de arenas/colas |
| 23 | `precio_oro_cache` | Finanzas | Cache del precio del oro |
| 24 | `balance_diario` | Finanzas | Balance financiero diario |
| 25 | `equipos` | Equipos | Estado de equipos |
| 26 | `equipos_historial` | Equipos | Historial de eventos de equipos |
| 27 | `mejoras_seguridad` | Equipos | Incidentes, mejoras y seguridad |
| 28 | `libro_guardia` | Operaciones | Libro de guardia digital |
| 29 | `fiscal_entidades` | Fiscal | Entidades fiscales (empresas) |
| 30 | `fiscal_representantes` | Fiscal | Representantes legales |
| 31 | `fiscal_cuentas_bancarias` | Fiscal | Cuentas bancarias |
| 32 | `fiscal_textos_legales` | Fiscal | Plantillas de texto legal |
| 33 | `fiscal_parametros` | Fiscal | Parámetros tributarios |
| 34 | `biblioteca_categorias` | Biblioteca | Categorías de variables |
| 35 | `biblioteca_variables` | Biblioteca | Variables configurables |

---

## Convenciones

- **PK:** `id UUID PRIMARY KEY DEFAULT uuid_generate_v4()`
- **FK:** `columna UUID REFERENCES tabla(columna)`
- **Timestamps:** `created_at TIMESTAMPTZ DEFAULT NOW()`, `updated_at TIMESTAMPTZ DEFAULT NOW()`
- **Nullabilidad:** se indica con `NULL` o `NOT NULL`
- **Autoría:** `registrado_por UUID REFERENCES auth.users(id)` (usuario que creó/registró el registro)
- **RLS:** Row Level Security habilitado en todas las tablas, policy `auth_full_access` para `auth.role() = 'authenticated'`

---

## Módulo: Nómina y Personal

### `personal`

Maestro de trabajadores. Contiene datos personales, laborales, salariales, estado, y documentación.

| Columna | Tipo | Nulo | Descripción |
|---------|------|------|-------------|
| `id` | `uuid` | NO | PK |
| `cedula` | `varchar(20)` | NO | Cédula de identidad (UNIQUE) |
| `nombre_completo` | `varchar(150)` | NO | Nombre completo |
| `fecha_nacimiento` | `date` | SÍ | Fecha de nacimiento |
| `cargo` | `varchar(100)` | NO | Cargo actual |
| `area` | `varchar(50)` | NO | Área: `mina`, `planta`, `administracion`, `seguridad`, `transporte` |
| `area_detalle` | `text` | SÍ | Sub-área o detalle |
| `ubicacion_laboral` | `varchar` | SÍ | Sitio operativo (Mina Belén, Molino La Fé, etc.) |
| `salario_base` | `numeric(12,2)` | NO | Salario base semanal |
| `salario_libre` | `numeric` | SÍ | Salario para semana libre |
| `bono_transporte` | `numeric` | SÍ | Bono de transporte semanal |
| `fecha_ingreso` | `date` | NO | Fecha de ingreso |
| `activo` | `boolean` | NO | ¿Está activo en el sistema? |
| `estatus` | `text` | SÍ | `ACTIVO`, `LIQUIDADO`, `INACTIVO` |
| `estado_laboral` | `varchar` | SÍ | `ACTIVO`, `DESPEDIDO`, `REPOSO`, `VACACIONES`, `REENGANCHADO` |
| `observacion_estado` | `text` | SÍ | Observación del estado laboral |
| `estado_inicio_fecha` | `date` | SÍ | Fecha inicio del estado actual |
| `estado_fin_fecha` | `date` | SÍ | Fecha fin del estado actual |
| `estado_duracion_dias` | `integer` | SÍ | Duración en días del estado |
| `despido_fecha` | `date` | SÍ | Fecha de despido |
| `despido_causa` | `text` | SÍ | Causa del despido |
| `reenganche_fecha` | `date` | SÍ | Fecha de reenganche |
| `reenganche_cargo` | `text` | SÍ | Cargo al reenganchar |
| `reenganche_observacion` | `text` | SÍ | Observación del reenganche |
| `ajuste_antiguedad_dias` | `integer` | SÍ | Ajuste manual de antigüedad |
| `esquema_rotacion` | `text` | SÍ | `FIJO_SEMANAL`, `MINA_2X1`, `MOLINO_FIJO`, `MOLINO_ROTATIVO`, `MINA_ROTATIVA_3G`, `MOLINO_15X15` |
| `rotacion_inicio_fecha` | `date` | SÍ | Fecha inicio del esquema de rotación |
| `telefono` | `varchar(20)` | SÍ | Teléfono de contacto |
| `notas` | `text` | SÍ | Notas generales |
| `doc_cedula_url` | `text` | SÍ | URL del documento de cédula |
| `foto_carnet_url` | `text` | SÍ | URL de la foto carnet |
| `estado_manual_override` | `boolean` | SÍ | ¿Estado laboral forzado manualmente? |
| `ultimo_update_estado_at` | `timestamptz` | SÍ | Última actualización de estado |
| `created_at` | `timestamptz` | NO | Fecha de creación |
| `updated_at` | `timestamptz` | NO | Fecha de última modificación |

**FKs:** Ninguna (tabla raíz del módulo)

---

### `nomina_periodos`

Períodos de nómina. Un período agrupa varias semanas.

| Columna | Tipo | Nulo |
|---------|------|------|
| `id` | `uuid` | NO | PK |
| `label` | `text` | NO | Nombre del período |
| `range_start` | `date` | NO | Fecha inicio |
| `range_end` | `date` | NO | Fecha fin |
| `total_usd` | `numeric` | NO | Total pagado en USD |
| `origen` | `text` | NO | Manual o generado automáticamente |
| `metadata` | `jsonb` | NO | Metadatos adicionales |
| `created_by` | `uuid` | SÍ | → `auth.users(id)` |
| `created_at` | `timestamptz` | NO | |

**FKs:**
- `created_by` → `auth.users(id)`

---

### `nomina_periodo_semanas`

Tabla de relación muchos-a-muchos entre períodos y semanas.

| Columna | Tipo | Nulo |
|---------|------|------|
| `periodo_id` | `uuid` | NO | → `nomina_periodos(id)` |
| `semana_id` | `uuid` | NO | → `nomina_semanas(id)` |

**FKs:**
- `periodo_id` → `nomina_periodos(id)`
- `semana_id` → `nomina_semanas(id)`

---

### `nomina_semanas`

Semanas de nómina procesadas. Una semana agrupa los pagos de todos los trabajadores de un área.

| Columna | Tipo | Nulo | Descripción |
|---------|------|------|-------------|
| `id` | `uuid` | NO | PK |
| `semana_inicio` | `date` | NO | Fecha inicio de la semana (UNIQUE) |
| `semana_fin` | `date` | NO | Fecha fin de la semana |
| `area` | `text` | NO | Área a la que pertenece |
| `total_trabajadores` | `integer` | NO | Cantidad de trabajadores en la semana |
| `total_pagado` | `numeric(14,2)` | NO | Total pagado en USD |
| `origen` | `text` | NO | Origen de los datos |
| `notas` | `text` | SÍ | Notas |
| `registrado_por` | `uuid` | SÍ | → `auth.users(id)` |
| `gasto_id` | `uuid` | SÍ | → `gastos(id)` (enlace nómina → gasto) |
| `periodo_id` | `uuid` | SÍ | → `nomina_periodos(id)` |
| `created_at` | `timestamptz` | NO | |

**FKs:**
- `registrado_por` → `auth.users(id)`
- `gasto_id` → `gastos(id)`
- `periodo_id` → `nomina_periodos(id)`

---

### `nomina_registros`

Registro individual del monto pagado a cada trabajador en una semana específica.

| Columna | Tipo | Nulo | Descripción |
|---------|------|------|-------------|
| `id` | `uuid` | NO | PK |
| `semana_id` | `uuid` | NO | → `nomina_semanas(id)` |
| `personal_id` | `uuid` | NO | → `personal(id)` |
| `periodo_id` | `uuid` | SÍ | → `nomina_periodos(id)` |
| `monto_pagado` | `numeric` | NO | Monto pagado |
| `es_semana_libre` | `boolean` | NO | ¿Semana libre? |
| `bono_transporte_pagado` | `numeric` | NO | Bono de transporte pagado |
| `salario_base_calculado` | `numeric` | SÍ | Salario base según rotación |
| `bonificaciones` | `numeric` | NO | Bonificaciones adicionales |
| `total_vales` | `numeric` | NO | Total de vales/adelantos descontados |
| `estado_asistencia` | `text` | SÍ | `trabajada`, `libre`, `no_laborado` |
| `dias_trabajados` | `smallint` | SÍ | Días efectivamente trabajados |
| `novedad_turno` | `text` | NO | Novedad de turno |
| `novedad_turno_obs` | `text` | NO | Observación de novedad |
| `personal_snapshot` | `jsonb` | SÍ | Snapshot de datos del trabajador al momento del pago |
| `origen` | `text` | NO | Origen del registro |
| `created_at` | `timestamptz` | NO | |

**FKs:**
- `semana_id` → `nomina_semanas(id)`
- `personal_id` → `personal(id)`
- `periodo_id` → `nomina_periodos(id)`

---

### `nomina_vales`

Adelantos o vales otorgados a trabajadores.

| Columna | Tipo | Nulo |
|---------|------|------|
| `id` | `uuid` | NO | PK |
| `personal_id` | `uuid` | NO | → `personal(id)` |
| `semana_id` | `uuid` | YES | → `nomina_semanas(id)` |
| `monto` | `numeric` | NO | Monto del vale |
| `fecha` | `date` | NO | Fecha |
| `motivo` | `text` | NO | Motivo |
| `estado` | `text` | NO | `PENDIENTE`, `COBRADO` |
| `created_at` | `timestamptz` | NO | |

**FKs:**
- `personal_id` → `personal(id)`
- `semana_id` → `nomina_semanas(id)`

---

### `nomina_pagos`

Registro de pagos realizados a trabajadores.

| Columna | Tipo | Nulo |
|---------|------|------|
| `id` | `uuid` | NO | PK |
| `personal_id` | `uuid` | NO | → `personal(id)` |
| `fecha_pago` | `date` | NO | |
| `periodo_inicio` | `date` | NO | |
| `periodo_fin` | `date` | NO | |
| `salario_base` | `numeric(12,2)` | NO | |
| `bonificaciones` | `numeric(12,2)` | NO | |
| `deducciones` | `numeric(12,2)` | NO | |
| `total_pagado` | `numeric(12,2)` | NO | |
| `metodo_pago` | `varchar(50)` | SÍ | |
| `observaciones` | `text` | SÍ | |
| `registrado_por` | `uuid` | SÍ | → `auth.users(id)` |
| `created_at` | `timestamptz` | NO | |

**FKs:**
- `personal_id` → `personal(id)`
- `registrado_por` → `auth.users(id)`

---

### `nomina_cierres`

Cierre semanal con distribución de costos entre socios (Pedro, Darinel, La Fe).

| Columna | Tipo | Nulo |
|---------|------|------|
| `id` | `uuid` | NO | PK |
| `semana_id` | `uuid` | NO | → `nomina_semanas(id)` |
| `total_nomina_usd` | `numeric` | NO | |
| `pct_pedro` | `numeric` | NO | Porcentaje Pedro |
| `pct_darinel` | `numeric` | NO | Porcentaje Darinel |
| `pct_la_fe` | `numeric` | NO | Porcentaje La Fe |
| `monto_pedro` | `numeric` | NO | Monto Pedro |
| `monto_darinel` | `numeric` | NO | Monto Darinel |
| `monto_la_fe` | `numeric` | NO | Monto La Fe |
| `distribucion` | `jsonb` | SÍ | Distribución detallada (array de objetos) |
| `created_at` | `timestamptz` | NO | |

**FKs:**
- `semana_id` → `nomina_semanas(id)`

---

### `nomina_audit_log`

Auditoría de todas las operaciones sobre entidades de nómina.

| Columna | Tipo | Nulo |
|---------|------|------|
| `id` | `uuid` | NO | PK |
| `accion` | `text` | NO | Acción realizada (INSERT, UPDATE, DELETE) |
| `entidad` | `text` | NO | Nombre de la tabla afectada |
| `entidad_id` | `text` | SÍ | ID del registro afectado |
| `detalle` | `text` | SÍ | Detalle del cambio |
| `usuario_id` | `uuid` | SÍ | → `auth.users(id)` |
| `usuario_nombre` | `text` | SÍ | Nombre del usuario |
| `ip_address` | `text` | SÍ | Dirección IP |
| `created_at` | `timestamptz` | NO | |

**FKs:**
- `usuario_id` → `auth.users(id)`

---

## Módulo: Gastos

### `categorias_gasto`

Catálogo de categorías de gasto operativo.

| Columna | Tipo | Nulo |
|---------|------|------|
| `id` | `uuid` | NO | PK |
| `nombre` | `varchar(100)` | NO | UNIQUE |
| `tipo` | `varchar(50)` | NO | `mina`, `planta`, `general`, `transporte`, `seguridad`, `administrativo` |
| `descripcion` | `text` | SÍ | |
| `activo` | `boolean` | NO | |

---

### `gastos`

Registros de gastos operativos.

| Columna | Tipo | Nulo |
|---------|------|------|
| `id` | `uuid` | NO | PK |
| `fecha` | `date` | NO | |
| `categoria_id` | `uuid` | NO | → `categorias_gasto(id)` |
| `descripcion` | `varchar(300)` | NO | |
| `monto` | `numeric(14,2)` | NO | Monto > 0 |
| `proveedor` | `varchar(200)` | SÍ | |
| `factura_referencia` | `varchar(100)` | SÍ | |
| `notas` | `text` | SÍ | |
| `registrado_por` | `uuid` | NO | → `auth.users(id)` |
| `created_at` | `timestamptz` | NO | |
| `updated_at` | `timestamptz` | NO | |

**FKs:**
- `categoria_id` → `categorias_gasto(id)`
- `registrado_por` → `auth.users(id)`

---

### `gasto_conceptos`

Plantillas de conceptos de gasto con valores sugeridos.

| Columna | Tipo | Nulo |
|---------|------|------|
| `id` | `uuid` | NO | PK |
| `descripcion` | `varchar` | NO | |
| `categoria_default_id` | `uuid` | SÍ | → `categorias_gasto(id)` |
| `proveedor_sugerido` | `varchar` | SÍ | |
| `monto_sugerido` | `numeric` | SÍ | |
| `notas` | `text` | SÍ | |
| `activo` | `boolean` | NO | |
| `created_at` | `timestamptz` | NO | |
| `updated_at` | `timestamptz` | NO | |

**FKs:**
- `categoria_default_id` → `categorias_gasto(id)`

---

## Módulo: Producción (Mina y Planta)

### `recepcion_material`

Registro de recepción de material en planta (proveniente de mina).

| Columna | Tipo | Nulo |
|---------|------|------|
| `id` | `uuid` | NO | PK |
| `fecha` | `date` | NO | |
| `turno` | `varchar(20)` | NO | `dia`, `noche`, `completo` |
| `origen` | `varchar(150)` | NO | Origen del material |
| `sacos_recibidos` | `integer` | NO | > 0 |
| `peso_estimado_kg` | `numeric(12,2)` | SÍ | Peso estimado en kg |
| `tipo_material` | `varchar(80)` | SÍ | Tipo de material |
| `tenor_estimado_gpt` | `numeric(8,4)` | SÍ | Tenor estimado (gramos/tonelada) |
| `transportista` | `varchar(150)` | SÍ | |
| `observaciones` | `text` | SÍ | |
| `registrado_por` | `uuid` | NO | → `auth.users(id)` |
| `created_at` | `timestamptz` | NO | |
| `updated_at` | `timestamptz` | NO | |

**FKs:**
- `registrado_por` → `auth.users(id)`

---

### `procesamiento_planta`

Procesamiento de material (molienda, concentración, amalgamación, etc.).

| Columna | Tipo | Nulo |
|---------|------|------|
| `id` | `uuid` | NO | PK |
| `fecha` | `date` | NO | |
| `recepcion_id` | `uuid` | SÍ | → `recepcion_material(id)` |
| `sacos_vaciados` | `integer` | NO | > 0 |
| `peso_procesado_kg` | `numeric(12,2)` | NO | |
| `tenor_real_gpt` | `numeric(8,4)` | SÍ | |
| `proceso` | `varchar(80)` | NO | `molienda`, `concentracion`, `amalgamacion`, `cianuracion`, `flotacion`, `otro` |
| `horas_proceso` | `numeric(6,2)` | SÍ | |
| `quimicos_utilizados` | `text` | SÍ | |
| `estado` | `varchar(30)` | NO | `en_proceso`, `completado`, `enviado_a_quemada` |
| `observaciones` | `text` | SÍ | |
| `registrado_por` | `uuid` | NO | → `auth.users(id)` |
| `created_at` | `timestamptz` | NO | |
| `updated_at` | `timestamptz` | NO | |

**FKs:**
- `recepcion_id` → `recepcion_material(id)`
- `registrado_por` → `auth.users(id)`

---

### `reportes_voladuras`

Reportes operativos de voladuras (barrenado y disparo en mina).

| Columna | Tipo | Nulo |
|---------|------|------|
| `id` | `uuid` | NO | PK |
| `fecha` | `date` | NO | |
| `turno` | `varchar(20)` | NO | `dia`, `noche`, `completo` |
| `mina` | `text` | SÍ | Mina |
| `frente` | `text` | SÍ | Frente de trabajo |
| `orientacion` | `text` | SÍ | Orientación |
| `numero_frente` | `text` | SÍ | Número de frente |
| `hora_inicio_barrenado` | `time` | SÍ | |
| `hora_fin_barrenado` | `time` | SÍ | |
| `pausas_barrenado` | `jsonb` | SÍ | Array de pausas |
| `numero_disparo` | `text` | SÍ | |
| `hora_disparo` | `time` | SÍ | |
| `vertical_disparo` | `text` | SÍ | |
| `sin_novedad` | `boolean` | NO | ¿Sin novedad? |
| `huecos_cantidad` | `integer` | NO | |
| `huecos_pies` | `integer` | NO | |
| `chupis_cantidad` | `integer` | NO | |
| `chupis_pies` | `integer` | NO | |
| `fosforos_lp` | `integer` | NO | |
| `espaguetis` | `integer` | NO | |
| `vitamina_e` | `integer` | NO | |
| `trenza_metros` | `numeric` | NO | |
| `arroz_kg` | `numeric` | NO | |
| `observaciones_disparo` | `text` | SÍ | |
| `observaciones` | `text` | SÍ | |
| `responsable` | `text` | SÍ | |
| `registrado_por` | `uuid` | SÍ | → `auth.users(id)` |
| `recepcion_id` | `uuid` | SÍ | → `recepcion_material(id)` (trazabilidad) |
| `created_at` | `timestamptz` | NO | |

**FKs:**
- `registrado_por` → `auth.users(id)`
- `recepcion_id` → `recepcion_material(id)`

---

### `reportes_extraccion`

Reportes operativos de extracción en mina.

| Columna | Tipo | Nulo |
|---------|------|------|
| `id` | `uuid` | NO | PK |
| `fecha` | `date` | NO | |
| `turno` | `varchar(20)` | NO | `dia`, `noche`, `completo` |
| `vertical` | `text` | SÍ | Vertical de extracción |
| `mina` | `text` | SÍ | |
| `responsable` | `text` | SÍ | |
| `hora_inicio` | `time` | SÍ | |
| `hora_fin` | `time` | SÍ | |
| `eventos` | `jsonb` | SÍ | Array de eventos |
| `sacos_extraidos` | `integer` | NO | |
| `numero_disparo` | `text` | SÍ | |
| `observaciones` | `text` | SÍ | |
| `registrado_por` | `uuid` | SÍ | → `auth.users(id)` |
| `recepcion_id` | `uuid` | SÍ | → `recepcion_material(id)` (trazabilidad) |
| `created_at` | `timestamptz` | NO | |

**FKs:**
- `registrado_por` → `auth.users(id)`
- `recepcion_id` → `recepcion_material(id)`

---

### `reportes_produccion`

Reportes diarios de producción de molinos.

| Columna | Tipo | Nulo |
|---------|------|------|
| `id` | `uuid` | NO | PK |
| `fecha` | `date` | NO | |
| `turno` | `varchar(20)` | NO | `dia`, `noche`, `completo` |
| `molino` | `varchar(150)` | NO | |
| `material` | `varchar(150)` | NO | |
| `material_codigo` | `varchar(50)` | SÍ | |
| `amalgama_1_g` | `numeric(10,4)` | SÍ | |
| `amalgama_2_g` | `numeric(10,4)` | SÍ | |
| `oro_recuperado_g` | `numeric(10,4)` | NO | ≥ 0 |
| `merma_1_pct` | `numeric(6,2)` | SÍ | |
| `merma_2_pct` | `numeric(6,2)` | SÍ | |
| `sacos` | `integer` | NO | |
| `toneladas_procesadas` | `numeric(8,4)` | SÍ | |
| `tenor_tonelada_gpt` | `numeric(8,4)` | SÍ | |
| `tenor_saco_gps` | `numeric(8,4)` | SÍ | |
| `responsable` | `varchar(150)` | SÍ | |
| `observaciones` | `text` | SÍ | |
| `registrado_por` | `uuid` | SÍ | → `auth.users(id)` |
| `procesamiento_id` | `uuid` | SÍ | → `procesamiento_planta(id)` (trazabilidad) |
| `created_at` | `timestamptz` | NO | |
| `updated_at` | `timestamptz` | NO | |

**FKs:**
- `registrado_por` → `auth.users(id)`
- `procesamiento_id` → `procesamiento_planta(id)`

---

### `reportes_quemado`

Reportes de retorta y quemado (fundición de amalgama).

| Columna | Tipo | Nulo |
|---------|------|------|
| `id` | `uuid` | NO | PK |
| `fecha` | `date` | NO | |
| `turno` | `varchar(20)` | NO | `dia`, `noche`, `completo` |
| `numero_quemada` | `text` | SÍ | |
| `planchas` | `jsonb` | NO | Array de `PlanchaItem` |
| `manto_amalgama_g` | `numeric` | SÍ | |
| `manto_oro_g` | `numeric` | SÍ | |
| `retorta_oro_g` | `numeric` | SÍ | |
| `total_amalgama_g` | `numeric` | NO | |
| `total_oro_g` | `numeric` | NO | |
| `responsable` | `text` | SÍ | |
| `observaciones` | `text` | SÍ | |
| `registrado_por` | `uuid` | SÍ | → `auth.users(id)` |
| `procesamiento_id` | `uuid` | SÍ | → `procesamiento_planta(id)` (trazabilidad) |
| `created_at` | `timestamptz` | NO | |
| `updated_at` | `timestamptz` | NO | |

**FKs:**
- `registrado_por` → `auth.users(id)`
- `procesamiento_id` → `procesamiento_planta(id)`

---

## Módulo: Finanzas

### `venta_arenas`

Ventas de arenas/colas de proceso.

| Columna | Tipo | Nulo |
|---------|------|------|
| `id` | `uuid` | NO | PK |
| `fecha` | `date` | NO | |
| `comprador` | `varchar(200)` | NO | |
| `cantidad_kg` | `numeric(12,2)` | NO | > 0 |
| `precio_por_kg` | `numeric(10,2)` | NO | |
| `total_venta` | `numeric(14,2)` | NO | |
| `factura_referencia` | `varchar(100)` | SÍ | |
| `negociacion` | `text` | SÍ | |
| `humedad_pct` | `numeric` | SÍ | |
| `pct_recuperacion_planta` | `numeric` | SÍ | |
| `pct_molino` | `numeric` | SÍ | |
| `observaciones` | `text` | SÍ | |
| `registrado_por` | `uuid` | NO | → `auth.users(id)` |
| `procesamiento_id` | `uuid` | SÍ | → `procesamiento_planta(id)` (trazabilidad) |
| `created_at` | `timestamptz` | NO | |

**FKs:**
- `registrado_por` → `auth.users(id)`
- `procesamiento_id` → `procesamiento_planta(id)`

---

### `precio_oro_cache`

Cache del precio del oro obtenido de API externa.

| Columna | Tipo | Nulo |
|---------|------|------|
| `id` | `uuid` | NO | PK |
| `fecha` | `date` | NO | UNIQUE(fecha, fuente) |
| `precio_usd_por_onza` | `numeric(12,4)` | NO | |
| `precio_usd_por_gramo` | `numeric(12,6)` | NO | |
| `fuente` | `varchar(100)` | NO | |
| `moneda_base` | `varchar(10)` | NO | |
| `consultado_at` | `timestamptz` | NO | |

---

### `balance_diario`

Balance financiero diario que integra producción, ingresos y gastos.

| Columna | Tipo | Nulo |
|---------|------|------|
| `id` | `uuid` | NO | PK |
| `fecha` | `date` | NO | UNIQUE |
| `gramos_oro_recuperado_total` | `numeric(12,4)` | NO | |
| `precio_oro_usd_gramo` | `numeric(12,6)` | NO | |
| `precio_oro_usd_onza` | `numeric(12,4)` | NO | |
| `ingreso_bruto_oro_usd` | `numeric(14,2)` | NO | |
| `ingreso_venta_arenas_usd` | `numeric(14,2)` | NO | |
| `ingreso_total_usd` | `numeric(14,2)` | NO | |
| `gasto_nomina_usd` | `numeric(14,2)` | NO | |
| `gasto_insumos_usd` | `numeric(14,2)` | NO | |
| `gasto_operativo_usd` | `numeric(14,2)` | NO | |
| `gasto_total_usd` | `numeric(14,2)` | NO | |
| `rentabilidad_usd` | `numeric(14,2)` | NO | |
| `margen_porcentaje` | `numeric(6,2)` | SÍ | |
| `notas` | `text` | SÍ | |
| `generado_at` | `timestamptz` | NO | |
| `actualizado_at` | `timestamptz` | NO | |

---

## Módulo: Inventario y Compras

### `inventario_items`

Items de inventario (explosivos, combustibles, herramientas, EPP, químicos, repuestos).

| Columna | Tipo | Nulo |
|---------|------|------|
| `id` | `uuid` | NO | PK |
| `codigo` | `varchar(50)` | NO | UNIQUE |
| `nombre` | `varchar(200)` | NO | |
| `categoria` | `varchar(80)` | NO | `explosivos`, `combustible`, `herramientas`, `epp`, `quimicos`, `repuestos`, `otros` |
| `unidad_medida` | `varchar(30)` | NO | |
| `stock_actual` | `numeric(12,3)` | NO | |
| `stock_minimo` | `numeric(12,3)` | NO | |
| `costo_unitario_promedio` | `numeric(14,4)` | NO | |
| `ubicacion` | `varchar(100)` | SÍ | |
| `activo` | `boolean` | NO | |
| `created_at` | `timestamptz` | NO | |
| `updated_at` | `timestamptz` | NO | |

---

### `inventario_movimientos`

Movimientos de inventario (entradas, salidas, ajustes). Dispara trigger que actualiza stock automáticamente.

| Columna | Tipo | Nulo |
|---------|------|------|
| `id` | `uuid` | NO | PK |
| `item_id` | `uuid` | NO | → `inventario_items(id)` |
| `fecha` | `date` | NO | |
| `tipo_movimiento` | `varchar(20)` | NO | `entrada`, `salida`, `ajuste` |
| `cantidad` | `numeric(12,3)` | NO | |
| `costo_unitario` | `numeric(14,4)` | SÍ | |
| `costo_total` | `numeric(14,2)` | SÍ | |
| `referencia` | `varchar(200)` | SÍ | |
| `destino_area` | `varchar(50)` | SÍ | `mina`, `planta`, `general` |
| `observaciones` | `text` | SÍ | |
| `registrado_por` | `uuid` | NO | → `auth.users(id)` |
| `created_at` | `timestamptz` | NO | |

**FKs:**
- `item_id` → `inventario_items(id)`
- `registrado_por` → `auth.users(id)`

**Trigger:** `trigger_actualizar_stock` → AFTER INSERT on inventario_movimientos, actualiza `inventario_items.stock_actual`.

---

### `compras_programadas`

Compras o insumos planificados con fechas requeridas.

| Columna | Tipo | Nulo |
|---------|------|------|
| `id` | `uuid` | NO | PK |
| `item_id` | `uuid` | SÍ | → `inventario_items(id)` |
| `descripcion` | `varchar(300)` | NO | |
| `cantidad_requerida` | `numeric(12,3)` | NO | |
| `unidad_medida` | `varchar(30)` | NO | |
| `fecha_requerida` | `date` | NO | |
| `prioridad` | `varchar(20)` | NO | `baja`, `normal`, `alta`, `urgente` |
| `estado` | `varchar(30)` | NO | `pendiente`, `aprobada`, `en_proceso`, `completada`, `cancelada` |
| `proveedor_sugerido` | `varchar(200)` | SÍ | |
| `costo_estimado` | `numeric(14,2)` | SÍ | |
| `costo_real` | `numeric(14,2)` | SÍ | |
| `aprobado_por` | `uuid` | SÍ | → `auth.users(id)` |
| `notas` | `text` | SÍ | |
| `registrado_por` | `uuid` | NO | → `auth.users(id)` |
| `created_at` | `timestamptz` | NO | |
| `updated_at` | `timestamptz` | NO | |

**FKs:**
- `item_id` → `inventario_items(id)`
- `aprobado_por` → `auth.users(id)`
- `registrado_por` → `auth.users(id)`

---

## Módulo: Equipos y Seguridad

### `equipos`

Registro maestro de equipos de mina/planta.

| Columna | Tipo | Nulo |
|---------|------|------|
| `id` | `uuid` | NO | PK |
| `codigo` | `varchar(50)` | NO | UNIQUE |
| `nombre` | `varchar(150)` | NO | |
| `tipo` | `varchar(80)` | NO | `compresor`, `perforadora`, `volqueta`, `bomba`, `generador`, `ventilador`, `otro` |
| `ubicacion` | `varchar(100)` | SÍ | |
| `estado` | `varchar(30)` | NO | `operativo`, `en_mantenimiento`, `fuera_servicio`, `en_reparacion` |
| `fecha_ultimo_mantenimiento` | `date` | SÍ | |
| `proximo_mantenimiento` | `date` | SÍ | |
| `horas_operacion` | `numeric(10,1)` | SÍ | |
| `observaciones` | `text` | SÍ | |
| `activo` | `boolean` | NO | |
| `created_at` | `timestamptz` | NO | |
| `updated_at` | `timestamptz` | NO | |

---

### `equipos_historial`

Historial de eventos de equipos (mantenimiento, reparación, falla, inspección).

| Columna | Tipo | Nulo |
|---------|------|------|
| `id` | `uuid` | NO | PK |
| `equipo_id` | `uuid` | NO | → `equipos(id)` |
| `fecha` | `date` | NO | |
| `tipo_evento` | `varchar(50)` | NO | `mantenimiento`, `reparacion`, `falla`, `inspeccion` |
| `descripcion` | `text` | NO | |
| `costo` | `numeric(14,2)` | SÍ | |
| `tecnico` | `varchar(150)` | SÍ | |
| `registrado_por` | `uuid` | SÍ | → `auth.users(id)` |
| `created_at` | `timestamptz` | NO | |

**FKs:**
- `equipo_id` → `equipos(id)`
- `registrado_por` → `auth.users(id)`

---

### `mejoras_seguridad`

Registro de mejoras de infraestructura, procesos, incidentes, inspecciones y capacitaciones.

| Columna | Tipo | Nulo |
|---------|------|------|
| `id` | `uuid` | NO | PK |
| `fecha` | `date` | NO | |
| `tipo` | `varchar(50)` | NO | `mejora_infraestructura`, `mejora_proceso`, `incidente`, `inspeccion`, `capacitacion` |
| `titulo` | `varchar(200)` | NO | |
| `descripcion` | `text` | NO | |
| `area` | `varchar(50)` | NO | `mina`, `planta`, `general` |
| `prioridad` | `varchar(20)` | SÍ | `baja`, `normal`, `alta`, `critica` |
| `estado` | `varchar(30)` | NO | `reportado`, `en_proceso`, `completado`, `descartado` |
| `costo_estimado` | `numeric(14,2)` | SÍ | |
| `costo_real` | `numeric(14,2)` | SÍ | |
| `responsable` | `varchar(150)` | SÍ | |
| `registrado_por` | `uuid` | NO | → `auth.users(id)` |
| `created_at` | `timestamptz` | NO | |
| `updated_at` | `timestamptz` | NO | |

**FKs:**
- `registrado_por` → `auth.users(id)`

---

## Módulo: Libro de Guardia

### `libro_guardia`

Registro digital del libro de guardia (traspaso de turno).

| Columna | Tipo | Nulo |
|---------|------|------|
| `id` | `uuid` | NO | PK |
| `fecha` | `date` | NO | |
| `turno` | `varchar(20)` | NO | `dia`, `noche` |
| `hora_entrega` | `time` | SÍ | |
| `jefe_saliente` | `varchar(150)` | NO | |
| `jefe_entrante` | `varchar(150)` | NO | |
| `personal_mina` | `integer` | SÍ | |
| `personal_planta` | `integer` | SÍ | |
| `personal_otros` | `integer` | SÍ | |
| `estado_equipos` | `text` | SÍ | |
| `novedades_operativas` | `text` | NO | |
| `condiciones_seguridad` | `text` | SÍ | |
| `incidentes` | `text` | SÍ | |
| `pendientes` | `text` | SÍ | |
| `observaciones` | `text` | SÍ | |
| `clima` | `varchar(50)` | SÍ | |
| `registrado_por` | `uuid` | NO | → `auth.users(id)` |
| `created_at` | `timestamptz` | NO | |

**FKs:**
- `registrado_por` → `auth.users(id)`

---

## Módulo: Fiscal / Plataforma

### `fiscal_entidades`

Entidades fiscales (empresas emisoras de documentos).

| Columna | Tipo | Nulo |
|---------|------|------|
| `id` | `uuid` | NO | PK |
| `nombre_comercial` | `varchar` | NO | |
| `razon_social` | `varchar` | NO | |
| `rif` | `varchar` | NO | |
| `direccion_fiscal` | `text` | NO | |
| `direccion_operativa` | `text` | SÍ | |
| `ciudad` | `varchar` | SÍ | |
| `estado_region` | `varchar` | SÍ | |
| `codigo_postal` | `varchar` | SÍ | |
| `pais` | `varchar` | NO | |
| `telefono` | `varchar` | SÍ | |
| `email` | `varchar` | SÍ | |
| `sitio_web` | `varchar` | SÍ | |
| `actividad_economica` | `text` | SÍ | |
| `es_emisor_principal` | `boolean` | NO | |
| `notas` | `text` | SÍ | |
| `activo` | `boolean` | NO | |
| `created_at` | `timestamptz` | NO | |
| `updated_at` | `timestamptz` | NO | |

---

### `fiscal_representantes`

Representantes legales de entidades fiscales.

| Columna | Tipo | Nulo |
|---------|------|------|
| `id` | `uuid` | NO | PK |
| `entidad_id` | `uuid` | NO | → `fiscal_entidades(id)` |
| `nombre_completo` | `varchar` | NO | |
| `cedula` | `varchar` | SÍ | |
| `cargo` | `varchar` | NO | |
| `telefono` | `varchar` | SÍ | |
| `email` | `varchar` | SÍ | |
| `es_principal` | `boolean` | NO | |
| `created_at` | `timestamptz` | NO | |
| `updated_at` | `timestamptz` | NO | |

**FKs:**
- `entidad_id` → `fiscal_entidades(id)`

---

### `fiscal_cuentas_bancarias`

Cuentas bancarias de entidades fiscales.

| Columna | Tipo | Nulo |
|---------|------|------|
| `id` | `uuid` | NO | PK |
| `entidad_id` | `uuid` | NO | → `fiscal_entidades(id)` |
| `banco` | `varchar` | NO | |
| `tipo_cuenta` | `varchar` | NO | |
| `numero_cuenta` | `varchar` | NO | |
| `titular` | `varchar` | SÍ | |
| `moneda` | `varchar` | NO | |
| `es_principal` | `boolean` | NO | |
| `created_at` | `timestamptz` | NO | |
| `updated_at` | `timestamptz` | NO | |

**FKs:**
- `entidad_id` → `fiscal_entidades(id)`

---

### `fiscal_textos_legales`

Plantillas de texto legal (factura, balance, planilla, etc.).

| Columna | Tipo | Nulo |
|---------|------|------|
| `id` | `uuid` | NO | PK |
| `slug` | `varchar` | NO | |
| `titulo` | `varchar` | NO | |
| `categoria` | `varchar` | NO | `factura`, `balance`, `planilla`, `general` |
| `contenido` | `text` | NO | |
| `activo` | `boolean` | NO | |
| `created_at` | `timestamptz` | NO | |
| `updated_at` | `timestamptz` | NO | |

---

### `fiscal_parametros`

Parámetros de configuración fiscal/tributaria.

| Columna | Tipo | Nulo |
|---------|------|------|
| `id` | `uuid` | NO | PK |
| `clave` | `varchar` | NO | |
| `etiqueta` | `varchar` | NO | |
| `valor` | `text` | NO | |
| `grupo` | `varchar` | NO | `tributario`, `documento`, `numeracion`, `otro` |
| `created_at` | `timestamptz` | NO | |
| `updated_at` | `timestamptz` | NO | |

---

## Módulo: Biblioteca de Variables

### `biblioteca_categorias`

Categorías que agrupan variables configurables por módulo.

| Columna | Tipo | Nulo |
|---------|------|------|
| `id` | `uuid` | NO | PK |
| `slug` | `varchar` | NO | |
| `nombre` | `varchar` | NO | |
| `descripcion` | `text` | SÍ | |
| `modulo` | `varchar` | NO | `general`, `nomina`, `mina`, `planta`, `operaciones`, `admin` |
| `orden` | `integer` | NO | |
| `activo` | `boolean` | NO | |
| `created_at` | `timestamptz` | NO | |
| `updated_at` | `timestamptz` | NO | |

---

### `biblioteca_variables`

Variables configurables del sistema (tasas, parámetros, etc.).

| Columna | Tipo | Nulo |
|---------|------|------|
| `id` | `uuid` | NO | PK |
| `categoria_id` | `uuid` | NO | → `biblioteca_categorias(id)` |
| `clave` | `varchar` | NO | |
| `etiqueta` | `varchar` | NO | |
| `valor` | `text` | NO | |
| `unidad` | `varchar` | SÍ | |
| `descripcion` | `text` | SÍ | |
| `orden` | `integer` | NO | |
| `activo` | `boolean` | NO | |
| `metadata` | `jsonb` | NO | Metadatos adicionales |
| `created_at` | `timestamptz` | NO | |
| `updated_at` | `timestamptz` | NO | |

**FKs:**
- `categoria_id` → `biblioteca_categorias(id)`

---

## Diagrama de Relaciones

### Flujo de Producción (cadena principal)

```
reportes_voladuras ──► recepcion_material ──► procesamiento_planta
reportes_extraccion ─┘                              │
                                                    ├──► reportes_produccion
                                                    ├──► reportes_quemado
                                                    └──► venta_arenas
```

### Flujo de Nómina

```
personal ◄── nomina_registros ◄── nomina_semanas ──► gastos
              nomina_vales       nomina_semanas ──► nomina_cierres
              nomina_pagos       nomina_periodos ──┤
                                                    nomina_semanas ◄── nomina_periodo_semanas ──► nomina_periodos
```

### Flujo de Gastos

```
categorias_gasto ◄── gastos ◄── nomina_semanas (vía gasto_id)
categorias_gasto ◄── gasto_conceptos
```

### Flujo de Inventario

```
inventario_items ◄── inventario_movimientos
                 ◄── compras_programadas
```

### Fiscal / Plataforma

```
fiscal_entidades ◄── fiscal_representantes
                 ◄── fiscal_cuentas_bancarias
```

### Biblioteca

```
biblioteca_categorias ◄── biblioteca_variables
```

---

## Foreign Keys a `auth.users`

Todas las columnas de autoría (`registrado_por`, `aprobado_por`, `created_by`, `usuario_id`) referencian `auth.users(id)` de Supabase Auth (no una tabla `public`).

| Tabla | Columna | Nulable |
|-------|---------|---------|
| `compras_programadas` | `registrado_por` | NO |
| `compras_programadas` | `aprobado_por` | SÍ |
| `equipos_historial` | `registrado_por` | SÍ |
| `gastos` | `registrado_por` | NO |
| `inventario_movimientos` | `registrado_por` | NO |
| `libro_guardia` | `registrado_por` | NO |
| `mejoras_seguridad` | `registrado_por` | NO |
| `nomina_audit_log` | `usuario_id` | SÍ |
| `nomina_pagos` | `registrado_por` | SÍ |
| `nomina_periodos` | `created_by` | SÍ |
| `nomina_semanas` | `registrado_por` | SÍ |
| `procesamiento_planta` | `registrado_por` | NO |
| `recepcion_material` | `registrado_por` | NO |
| `reportes_extraccion` | `registrado_por` | SÍ |
| `reportes_produccion` | `registrado_por` | SÍ |
| `reportes_quemado` | `registrado_por` | SÍ |
| `reportes_voladuras` | `registrado_por` | SÍ |
| `venta_arenas` | `registrado_por` | NO |

**Total: 18 FKs hacia `auth.users(id)`**
