// ============================================================
// MineOS - Tipos TypeScript para toda la aplicación
// ============================================================

// --- Administración ---
export interface Personal {
  id: string;
  cedula: string;
  nombre_completo: string;
  cargo: string;
  area: 'mina' | 'planta' | 'administracion' | 'seguridad' | 'transporte';
  salario_base: number;
  fecha_ingreso: string;
  activo: boolean;
  telefono?: string;
  notas?: string;
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
  proveedor?: string;
  factura_referencia?: string;
  notas?: string;
  registrado_por: string;
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
export interface CronogramaDisparo {
  id: string;
  fecha: string;
  turno: 'dia' | 'noche' | 'completo';
  zona_mina: string;
  nivel?: string;
  numero_huecos: number;
  profundidad_promedio_m?: number;
  explosivo_tipo: string;
  explosivo_cantidad_kg: number;
  fulminantes_usados: number;
  mecha_metros: number;
  sacos_obtenidos: number;
  estado: 'programado' | 'ejecutado' | 'cancelado' | 'parcial';
  hora_disparo?: string;
  responsable?: string;
  observaciones?: string;
  registrado_por: string;
  created_at: string;
  updated_at: string;
}

export interface PausaBarrenado {
  hora_inicio: string;
  hora_fin: string;
  motivo: string;
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
  created_at: string;
}

export interface DisparoDetalle {
  id: string;
  cronograma_id: string;
  numero_disparo: number;
  hora?: string;
  huecos: number;
  explosivo_kg: number;
  sacos_obtenidos: number;
  resultado?: string;
  observaciones?: string;
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
  disparo_id?: string;
  sacos_recibidos: number;
  peso_estimado_kg?: number;
  tipo_material: string;
  tenor_estimado_gpt?: number;
  transportista?: string;
  observaciones?: string;
  registrado_por: string;
  created_at: string;
  updated_at: string;
  cronograma_disparos?: CronogramaDisparo;
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

export interface QuemadaPlancha {
  id: string;
  fecha: string;
  procesamiento_id?: string;
  numero_quemada: string;
  gramos_oro_puro_recuperado: number;
  gramos_oro_bruto?: number;
  porcentaje_pureza?: number;
  temperatura_quemada?: number;
  duracion_horas?: number;
  responsable: string;
  testigos?: string;
  foto_referencia?: string;
  observaciones?: string;
  registrado_por: string;
  created_at: string;
  updated_at: string;
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
