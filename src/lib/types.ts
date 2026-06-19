// ============================================================
// MineOS - Tipos TypeScript para toda la aplicación
// ============================================================

// --- Administración ---
export interface Personal {
  id: string;
  cedula: string;
  nombre_completo: string;
  fecha_nacimiento?: string | null;
  cargo: string;
  area: 'mina' | 'planta' | 'administracion' | 'seguridad' | 'transporte';
  area_detalle: string;
  /** Sitio operativo: Mina Belén, otra mina, Molino La Fé, etc. */
  ubicacion_laboral?: string | null;
  salario_base: number;
  salario_libre: number;
  bono_transporte?: number;
  estatus: 'ACTIVO' | 'LIQUIDADO' | 'INACTIVO';
  fecha_ingreso: string;
  activo: boolean;
  telefono?: string;
  notas?: string;
  estado_laboral?: 'ACTIVO' | 'DESPEDIDO' | 'REPOSO' | 'VACACIONES' | 'REENGANCHADO';
  observacion_estado?: string | null;
  estado_inicio_fecha?: string | null;
  estado_fin_fecha?: string | null;
  estado_duracion_dias?: number | null;
  despido_fecha?: string | null;
  despido_causa?: string | null;
  reenganche_fecha?: string | null;
  reenganche_cargo?: string | null;
  reenganche_observacion?: string | null;
  ajuste_antiguedad_dias?: number | null;
  doc_cedula_url?: string | null;
  foto_carnet_url?: string | null;
  esquema_rotacion: 'FIJO_SEMANAL' | 'MINA_2X1' | 'MOLINO_FIJO' | 'MOLINO_ROTATIVO' | 'MINA_ROTATIVA_3G' | 'MOLINO_15X15' | 'MOLINO_14X14';
  rotacion_inicio_fecha?: string;
  // --- Campos V7: Perfiles de Compensación ---
  perfil_compensacion_id?: string | null;
  vertical_asignada?: string | null;
  grupo_turno?: string | null;
  created_at: string;
  updated_at: string;
}

export interface NominaPago {
  id: string;
  personal_id: string;
  fecha_pago: string;
  periodo_inicio: string;
  periodo_fin: string;
  salario_base: number;
  bonificaciones: number;
  deducciones: number;
  total_pagado: number;
  metodo_pago: string;
  observaciones?: string;
  registrado_por: string;
  created_at: string;
  personal?: Personal;
}

export interface NominaSemana {
  id: string;
  semana_inicio: string;
  semana_fin: string;
  area: string;
  total_trabajadores: number;
  total_pagado: number;
  notas?: string;
  registrado_por?: string;
  gasto_id?: string;
  periodo_id?: string | null;
  created_at: string;
}

export interface NominaRegistro {
  id: string;
  semana_id: string;
  personal_id: string;
  monto_pagado: number;
  es_semana_libre: boolean;
  bono_transporte_pagado?: number;
  estado_asistencia?: 'trabajada' | 'libre' | 'no_laborado' | null;
  dias_trabajados?: number | null;
  salario_base_calculado?: number | null;
  // --- Campos V7: Ciclos de Nómina ---
  ciclo_id?: string | null;
  posicion_en_ciclo?: number | null;
  es_finiquito?: boolean;
  perfil_compensacion_snapshot?: Record<string, any> | null;
  bonificaciones?: number;
  total_vales?: number;
  novedad_turno?: string;
  novedad_turno_obs?: string;
  origen?: string;
  periodo_id?: string | null;
  created_at: string;
  personal?: Personal;
}

// --- V7: Perfiles de Compensación y Ciclos ---

export type PoliticaDiaLibre = 'SALARIO_LIBRE' | 'TARIFA_PLANA' | 'SIN_PAGO' | 'GARANTIZADO';
export type PoliticaReposo = 'PAGO_COMPLETO' | 'PARCIAL' | 'SIN_PAGO';
export type EsquemaRotacion = 'FIJO_SEMANAL' | 'MINA_2X1' | 'MOLINO_FIJO' | 'MOLINO_ROTATIVO' | 'MINA_ROTATIVA_3G' | 'MOLINO_15X15' | 'MOLINO_14X14';

export interface BonoAutomatico {
  tipo: string;
  condicion: string;
  monto: number;
}

export interface PerfilCompensacion {
  id: string;
  nombre: string;
  descripcion?: string | null;
  esquema_rotacion_default: EsquemaRotacion;
  politica_dia_libre: PoliticaDiaLibre;
  politica_reposo: PoliticaReposo;
  duracion_ciclo_dias: number;
  semanas_trabajadas_por_ciclo: number;
  semanas_libres_por_ciclo: number;
  bonos_automaticos: BonoAutomatico[];
  multiplicadores: Record<string, number>;
  activo: boolean;
  creado_por?: string | null;
  created_at: string;
  updated_at: string;
}

export type EstadoCiclo = 'ABIERTO' | 'CERRADO' | 'REVERTIDO';

export interface NominaCiclo {
  id: string;
  label: string;
  fecha_inicio: string;
  fecha_fin: string;
  perfil_compensacion_id: string;
  area: 'mina' | 'planta' | 'administracion' | 'seguridad' | 'transporte';
  vertical?: string | null;
  total_ciclo_usd: number;
  total_trabajadores: number;
  estado: EstadoCiclo;
  notas?: string | null;
  cerrado_por?: string | null;
  cerrado_at?: string | null;
  creado_por?: string | null;
  created_at: string;
  updated_at: string;
  // Relaciones opcionales (JOINs)
  perfil_compensacion?: PerfilCompensacion;
  semanas?: NominaCicloSemana[];
}

export type RolSemana = 'libre' | 'trabajada' | 'no_laborada' | 'reposo' | 'vacaciones';

export interface NominaCicloSemana {
  ciclo_id: string;
  semana_id: string;
  posicion_en_ciclo: number;
  rol_semana: RolSemana;
  created_at: string;
  // Relaciones opcionales (JOINs)
  semana?: NominaSemana;
  registros?: NominaRegistro[];
}

export interface DetalleCicloCompleto extends NominaCiclo {
  trabajadores: {
    personal: Personal;
    registros: (NominaRegistro & { semana: NominaSemana; ciclo_semana: NominaCicloSemana })[];
    total_ciclo: number;
  }[];
}

export interface NominaCierre {
  id: string;
  semana_id: string;
  total_nomina_usd: number;
  pct_pedro: number;
  pct_darinel: number;
  pct_la_fe: number;
  monto_pedro: number;
  monto_darinel: number;
  monto_la_fe: number;
  distribucion?: Array<{
    id: string;
    nombre: string;
    porcentaje: number;
    pagoDirecto: number;
  }> | null;
  created_at: string;
}

export interface NominaVale {
  id: string;
  personal_id: string;
  monto: number;
  fecha: string;
  motivo: string;
  estado: 'PENDIENTE' | 'COBRADO';
  created_at: string;
}

export interface NominaAuditLog {
  id: string;
  accion: string;
  entidad: string;
  entidad_id?: string;
  detalle?: string;
  usuario_id?: string;
  usuario_nombre?: string;
  created_at: string;
}

export interface HistorialPagoRow {
  semana_id: string;
  semana_inicio: string;
  semana_fin: string;
  area: string;
  monto_pagado: number;
  es_semana_libre: boolean;
  bono_transporte_pagado?: number;
  created_at: string;
}

export interface TendenciaSemanalRow {
  semana_inicio: string;
  total_pagado: number;
  total_trabajadores: number;
}

export interface NominaHistoricoRow {
  semana_id: string;
  semana_inicio: string;
  semana_fin: string;
  area: string;
  total_trabajadores: number;
  total_pagado: number;
  tiene_cierre: boolean;
  monto_pedro: number;
  monto_darinel: number;
  monto_la_fe: number;
}

// Pre-nómina draft row (client-side only)
export interface PreNominaRow {
  personal: Personal;
  esSemanaLibre: boolean;
  bonoTransporte: number;
  total: number;
  bonificaciones?: number;
  totalVales?: number;
  estadoAsistencia?: 'trabajada' | 'libre' | 'no_laborado';
  diasTrabajados?: number;
  salarioBaseCalculado?: number;
  novedadTurno?: string;
  novedadTurnoObs?: string;
  reposoCondicion?: PoliticaReposo | 'PAGO_UNICO' | null;
  reposoDiasPagados?: number;
  reposoCompensacionMonto?: number;
}

export interface CategoriaGasto {
  id: string;
  nombre: string;
  tipo: 'mina' | 'planta' | 'general' | 'transporte' | 'seguridad' | 'administrativo';
  descripcion?: string;
  activo: boolean;
}

export interface Gasto {
  id: string;
  fecha: string;
  categoria_id: string;
  descripcion: string;
  monto: number;
  monto_gramos_oro?: number | null;
  precio_oro_usd_gramo?: number | null;
  proveedor?: string;
  factura_referencia?: string;
  notas?: string;
  registrado_por: string;
  created_at: string;
  updated_at: string;
  categorias_gasto?: CategoriaGasto;
}

export interface GastoConcepto {
  id: string;
  descripcion: string;
  categoria_default_id?: string | null;
  proveedor_sugerido?: string | null;
  monto_sugerido?: number | null;
  notas?: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
  categorias_gasto?: CategoriaGasto;
}


export interface InventarioItem {
  id: string;
  codigo: string;
  nombre: string;
  categoria: 'explosivos' | 'combustible' | 'herramientas' | 'epp' | 'quimicos' | 'repuestos' | 'otros';
  unidad_medida: string;
  stock_actual: number;
  stock_minimo: number;
  costo_unitario_promedio: number;
  ubicacion?: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface InventarioMovimiento {
  id: string;
  item_id: string;
  fecha: string;
  tipo_movimiento: 'entrada' | 'salida' | 'ajuste';
  cantidad: number;
  costo_unitario?: number;
  costo_total?: number;
  referencia?: string;
  destino_area?: 'mina' | 'planta' | 'general';
  observaciones?: string;
  registrado_por: string;
  created_at: string;
  inventario_items?: InventarioItem;
}

export interface CompraProgramada {
  id: string;
  item_id?: string;
  descripcion: string;
  cantidad_requerida: number;
  unidad_medida: string;
  fecha_requerida: string;
  prioridad: 'baja' | 'normal' | 'alta' | 'urgente';
  estado: 'pendiente' | 'aprobada' | 'en_proceso' | 'completada' | 'cancelada';
  proveedor_sugerido?: string;
  costo_estimado?: number;
  costo_real?: number;
  aprobado_por?: string;
  notas?: string;
  registrado_por: string;
  created_at: string;
  updated_at: string;
  inventario_items?: InventarioItem;
}

// --- Mina ---
export interface PausaBarrenado {
  hora_inicio: string;
  hora_fin: string;
  motivo: string;
}

export type TipoHuecoVoladura = 'hueco' | 'hueco_salida';

export interface LineaHuecoVoladura {
  tipo: TipoHuecoVoladura;
  cantidad: number;
  pies: number;
}

export interface LineaChupiVoladura {
  cantidad: number;
  pies: number;
}

export interface ReporteVoladura {
  id: string;
  fecha: string;
  turno: 'dia' | 'noche' | 'completo';
  mina?: string;
  frente?: string;
  orientacion?: string;
  numero_frente?: string;
  hora_inicio_barrenado?: string;
  hora_fin_barrenado?: string;
  numero_disparo?: string;
  hora_disparo?: string;
  vertical_disparo?: string;
  sin_novedad: boolean;
  huecos_cantidad: number;
  huecos_pies: number;
  chupis_cantidad: number;
  chupis_pies: number;
  huecos_lineas?: LineaHuecoVoladura[];
  chupis_lineas?: LineaChupiVoladura[];
  fosforos_lp: number;
  espaguetis: number;
  vitamina_e: number;
  trenza_metros: number;
  arroz_kg: number;
  pausas_barrenado?: PausaBarrenado[];
  observaciones_disparo?: string;
  observaciones?: string;
  responsable?: string;
  registrado_por?: string;
  recepcion_id?: string;
  created_at: string;
}

export interface EventoExtraccion {
  hora: string;
  descripcion: string;
}

export interface ReporteExtraccion {
  id: string;
  fecha: string;
  turno: 'dia' | 'noche' | 'completo';
  vertical?: string;
  mina?: string;
  responsable?: string;
  hora_inicio?: string;
  hora_fin?: string;
  eventos?: EventoExtraccion[];
  sacos_extraidos: number;
  numero_disparo?: string;
  observaciones?: string;
  registrado_por?: string;
  recepcion_id?: string;
  created_at: string;
}
export interface Equipo {
  id: string;
  codigo: string;
  nombre: string;
  tipo: 'compresor' | 'perforadora' | 'volqueta' | 'bomba' | 'generador' | 'ventilador' | 'otro';
  ubicacion?: string;
  estado: 'operativo' | 'en_mantenimiento' | 'fuera_servicio' | 'en_reparacion';
  fecha_ultimo_mantenimiento?: string;
  proximo_mantenimiento?: string;
  horas_operacion: number;
  observaciones?: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface MejoraSeguridad {
  id: string;
  fecha: string;
  tipo: 'mejora_infraestructura' | 'mejora_proceso' | 'incidente' | 'inspeccion' | 'capacitacion';
  titulo: string;
  descripcion: string;
  area: 'mina' | 'planta' | 'general';
  prioridad: 'baja' | 'normal' | 'alta' | 'critica';
  estado: 'reportado' | 'en_proceso' | 'completado' | 'descartado';
  costo_estimado?: number;
  costo_real?: number;
  responsable?: string;
  registrado_por: string;
  created_at: string;
  updated_at: string;
}

// --- Planta ---
export interface RecepcionMaterial {
  id: string;
  fecha: string;
  turno: 'dia' | 'noche' | 'completo';
  origen: string;
  sacos_recibidos: number;
  peso_estimado_kg?: number;
  tipo_material: string;
  tenor_estimado_gpt?: number;
  transportista?: string;
  observaciones?: string;
  registrado_por: string;
  created_at: string;
  updated_at: string;
}

export interface LineaAcarreo {
  sacos: number;
  vertical?: string;
  disparo?: string;
}

export interface ReporteAcarreo {
  id: string;
  fecha: string;
  turno: 'dia' | 'noche' | 'completo';
  mina: string;
  molino: string;
  lineas: LineaAcarreo[];
  carga_total: number;
  sacos_libres: number;
  observaciones?: string;
  fotos?: string[];
  registrado_por?: string;
  recepcion_id?: string;
  created_at: string;
  updated_at: string;
}

export interface ProcesamientoPlanta {
  id: string;
  fecha: string;
  recepcion_id?: string;
  sacos_vaciados: number;
  peso_procesado_kg: number;
  tenor_real_gpt?: number;
  proceso: 'molienda' | 'concentracion' | 'amalgamacion' | 'cianuracion' | 'flotacion' | 'otro';
  horas_proceso?: number;
  quimicos_utilizados?: string;
  estado: 'en_proceso' | 'completado' | 'enviado_a_quemada';
  observaciones?: string;
  registrado_por: string;
  created_at: string;
  updated_at: string;
  recepcion_material?: RecepcionMaterial;
}

// --- Quemado de Planchas ---
export interface PlanchaItem {
  amalgama_g: number;
  oro_recuperado_g: number;
}

export interface ReporteQuemado {
  id: string;
  fecha: string;
  turno: 'dia' | 'noche' | 'completo';
  numero_quemada?: string;
  planchas: PlanchaItem[];
  manto_amalgama_g?: number;
  manto_oro_g?: number;
  retorta_oro_g?: number;
  total_amalgama_g: number;
  total_oro_g: number;
  responsable?: string;
  observaciones?: string;
  registrado_por?: string;
  procesamiento_id?: string;
  created_at: string;
  updated_at: string;
}

export interface VentaArenas {
  id: string;
  fecha: string;
  comprador: string;
  cantidad_kg: number;        // almacena TONELADAS (campo renombrado en UI)
  precio_por_kg: number;      // almacena PRECIO/TON (campo renombrado en UI)
  total_venta: number;
  factura_referencia?: string; // usado como "negociación"
  negociacion?: string;
  humedad_pct?: number;
  pct_recuperacion_planta?: number;
  pct_molino?: number;
  observaciones?: string;
  registrado_por: string;
  procesamiento_id?: string;
  created_at: string;
}

// --- Producción ---
export interface Molino {
  id: string;
  nombre: string;
  tipo: 'operativo' | 'continuo' | 'varios';
  linea?: string;
  estado: 'activo' | 'inactivo' | 'mantenimiento';
  created_at: string;
}

export interface MaterialMina {
  id: string;
  nombre: string;
  codigo?: string;
  tipo: 'mineral_bruto' | 'repaso' | 'mantenimiento' | 'otros';
  activo: boolean;
  created_at: string;
}

export interface ReporteProduccion {
  id: string;
  fecha: string;
  turno: 'dia' | 'noche' | 'completo';
  molino: string;
  material: string;
  material_codigo?: string;
  amalgama_1_g?: number;
  amalgama_2_g?: number;
  oro_recuperado_g: number;
  merma_1_pct?: number;
  merma_2_pct?: number;
  sacos: number;
  toneladas_procesadas?: number;
  tenor_tonelada_gpt?: number;
  tenor_saco_gps?: number;
  responsable?: string;
  observaciones?: string;
  registrado_por?: string;
  procesamiento_id?: string;
  created_at: string;
  updated_at: string;
}

// --- Libro de Guardia ---
export interface LibroGuardia {
  id: string;
  fecha: string;
  turno: 'dia' | 'noche';
  hora_entrega?: string;
  jefe_saliente: string;
  jefe_entrante: string;
  personal_mina: number;
  personal_planta: number;
  personal_otros: number;
  estado_equipos?: string;
  novedades_operativas: string;
  condiciones_seguridad?: string;
  incidentes?: string;
  pendientes?: string;
  observaciones?: string;
  clima?: string;
  registrado_por: string;
  created_at: string;
}

// --- Dashboard ---
export interface PrecioOroCache {
  id: string;
  fecha: string;
  precio_usd_por_onza: number;
  precio_usd_por_gramo: number;
  fuente: string;
  moneda_base: string;
  consultado_at: string;
}

export interface BalanceDiario {
  id: string;
  fecha: string;
  gramos_oro_recuperado_total: number;
  precio_oro_usd_gramo: number;
  precio_oro_usd_onza: number;
  ingreso_bruto_oro_usd: number;
  ingreso_venta_arenas_usd: number;
  ingreso_total_usd: number;
  gasto_nomina_usd: number;
  gasto_insumos_usd: number;
  gasto_operativo_usd: number;
  gasto_total_usd: number;
  rentabilidad_usd: number;
  margen_porcentaje?: number;
  notas?: string;
  generado_at: string;
  actualizado_at: string;
}

// --- Gold Price API Response ---
export interface GoldPriceResponse {
  precio_usd_gramo: number;
  precio_usd_onza: number;
  fuente: 'cache' | 'api';
  fecha: string;
}

// --- Datos fiscales / legales (plataforma) ---
export type FiscalTextoCategoria = 'factura' | 'balance' | 'planilla' | 'general';
export type FiscalParametroGrupo = 'tributario' | 'documento' | 'numeracion' | 'otro';

export interface FiscalEntidad {
  id: string;
  nombre_comercial: string;
  razon_social: string;
  rif: string;
  direccion_fiscal: string;
  direccion_operativa?: string | null;
  ciudad?: string | null;
  estado_region?: string | null;
  codigo_postal?: string | null;
  pais: string;
  telefono?: string | null;
  email?: string | null;
  sitio_web?: string | null;
  actividad_economica?: string | null;
  es_emisor_principal: boolean;
  notas?: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface FiscalRepresentante {
  id: string;
  entidad_id: string;
  nombre_completo: string;
  cedula?: string | null;
  cargo: string;
  telefono?: string | null;
  email?: string | null;
  es_principal: boolean;
  created_at: string;
  updated_at: string;
}

export interface FiscalCuentaBancaria {
  id: string;
  entidad_id: string;
  banco: string;
  tipo_cuenta: string;
  numero_cuenta: string;
  titular?: string | null;
  moneda: string;
  es_principal: boolean;
  created_at: string;
  updated_at: string;
}

export interface FiscalTextoLegal {
  id: string;
  slug: string;
  titulo: string;
  categoria: FiscalTextoCategoria;
  contenido: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface FiscalParametro {
  id: string;
  clave: string;
  etiqueta: string;
  valor: string;
  grupo: FiscalParametroGrupo;
  created_at: string;
  updated_at: string;
}

export interface FiscalEntidadCompleta extends FiscalEntidad {
  representantes: FiscalRepresentante[];
  cuentas: FiscalCuentaBancaria[];
}

export interface FiscalDocumentoBundle {
  emisor: FiscalEntidadCompleta | null;
  textos: FiscalTextoLegal[];
  parametros: Record<string, string>;
}

// --- Biblioteca de variables (plataforma) ---
export type BibliotecaModulo = 'general' | 'nomina' | 'mina' | 'planta' | 'operaciones' | 'admin';

export interface BibliotecaCategoria {
  id: string;
  slug: string;
  nombre: string;
  descripcion?: string | null;
  modulo: BibliotecaModulo;
  orden: number;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface BibliotecaVariable {
  id: string;
  categoria_id: string;
  clave: string;
  etiqueta: string;
  valor: string;
  unidad?: string | null;
  descripcion?: string | null;
  orden: number;
  activo: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface BibliotecaCategoriaCompleta extends BibliotecaCategoria {
  variables: BibliotecaVariable[];
}

// --- RBAC ---
export type UserRole = 'admin_developer' | 'admin' | 'mining_supervisor' | 'mill_supervisor' | 'guest';

export interface UserProfile {
  id: string;
  display_name: string;
  role: UserRole;
  complex_id: string | null;
  active: boolean;
}

export interface Complex {
  id: string;
  name: string;
  slug: string;
  active: boolean;
}

// --- Sidebar Navigation ---
export interface NavItem {
  label: string;
  href: string;
  icon: string;
  children?: NavItem[];
}

export interface NavSection {
  title: string;
  icon: string;
  items: NavItem[];
}
