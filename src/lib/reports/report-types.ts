// ============================================================
// MineOS - Tipos para el Centro de Reportes y Balances
// ============================================================

export type ReportModule =
  | 'produccion'
  | 'nomina'
  | 'voladuras'
  | 'quemado'
  | 'extraccion'
  | 'gastos'
  | 'balance'
  | 'reconciliacion';

export interface DateRange {
  from: string; // 'YYYY-MM-DD'
  to: string;   // 'YYYY-MM-DD'
}

// ── Filtros por Módulo ──────────────────────────────────────

export interface ProduccionReportFilters {
  dateRange: DateRange;
  molinos?: string[];     // Multi-select de reportes_produccion.molino
  materiales?: string[];  // Multi-select de reportes_produccion.material
  turnos?: ('dia' | 'noche' | 'completo')[];
  agruparPor?: 'dia' | 'semana' | 'mes' | 'molino' | 'material';
}

export interface NominaReportFilters {
  dateRange: DateRange;
  areas?: ('mina' | 'planta' | 'administracion' | 'seguridad' | 'transporte')[];
  cargos?: string[];       // Multi-select de personal.cargo
  personalId?: string;     // Búsqueda por trabajador específico
  agruparPor?: 'semana' | 'mes' | 'area' | 'cargo' | 'trabajador';
}

export interface VoladurasReportFilters {
  dateRange: DateRange;
  minas?: string[];        // Multi-select de reportes_voladuras.mina
  verticales?: string[];   // Multi-select de reportes_voladuras.vertical_disparo
  turnos?: ('dia' | 'noche' | 'completo')[];
  agruparPor?: 'dia' | 'semana' | 'mina';
}

export interface QuemadoReportFilters {
  dateRange: DateRange;
  turnos?: ('dia' | 'noche' | 'completo')[];
  agruparPor?: 'dia' | 'semana' | 'mes';
}

export interface ExtraccionReportFilters {
  dateRange: DateRange;
  minas?: string[];        // Multi-select de reportes_extraccion.mina
  verticales?: string[];   // Multi-select de reportes_extraccion.vertical
  turnos?: ('dia' | 'noche' | 'completo')[];
  agruparPor?: 'dia' | 'semana' | 'mina';
}

export interface GastosReportFilters {
  dateRange: DateRange;
  categorias?: string[];   // Multi-select de categoria_id
  tipos?: ('mina' | 'planta' | 'general' | 'transporte' | 'seguridad' | 'administrativo')[];
  proveedor?: string;      // Búsqueda por texto
  agruparPor?: 'dia' | 'semana' | 'mes' | 'categoria';
}

export interface BalanceReportFilters {
  dateRange: DateRange;
  agruparPor?: 'semana' | 'mes';
}

// ── Opciones de Filtros Dinámicos (Dropdowns) ───────────────

export interface FilterOptions {
  produccion: {
    molinos: string[];
    materiales: string[];
  };
  nomina: {
    cargos: string[];
    personal: { id: string; nombre_completo: string; cedula: string }[];
  };
  voladuras: {
    minas: string[];
    verticales: string[];
  };
  extraccion: {
    minas: string[];
    verticales: string[];
  };
  gastos: {
    categorias: { id: string; nombre: string; tipo: string }[];
  };
}
