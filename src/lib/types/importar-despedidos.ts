// Types for the import action — no 'use server' here so it can export types freely.

export type ImportarDespedidosRow = {
  cedula: string;
  nombre: string;
  cargo: string;
  salarioSemana: number;
  diasTrabajados: number;
  cobraSemanaLibre: boolean;
  bonificaciones: number;
  despidoFecha: string;
  despidoCausa: string;
};

export type ImportarDespedidosDetalle = {
  cedula: string;
  nombre: string;
  estado: 'created' | 'updated' | 'skipped' | 'error';
  message?: string;
  matchedBy?: 'cedula' | 'nombre' | 'fuzzy-name' | 'auto-generated' | 'auto-cedula' | 'auto-nombre';
  incompleteData?: boolean;
};

export type PrevisualizarImportFila = {
  rowIndex: number;
  cedulaOriginal: string;
  nombreOriginal: string;
  cargo: string;
  diasTrabajados: number;
  bonificaciones: number;
  cobraSemanaLibre: boolean;
  despidoFecha: string;
  despidoCausa: string;
  salarioSemana: number;
  existe: boolean;
  matchedBy?: 'cedula' | 'nombre' | 'fuzzy-name' | 'auto-generated' | 'auto-cedula' | 'auto-nombre';
  cedulaEfectiva: string;
  nombreEfectivo: string;
  incompleteData: boolean;
};

export type PrevisualizarImportResult = {
  ok: boolean;
  message: string;
  filas: PrevisualizarImportFila[];
  totalExistentes: number;
  totalNuevos: number;
  totalIncompletos: number;
};

export type ImportarDespedidosResult = {
  ok: boolean;
  message: string;
  totalProcesados?: number;
  totalNoEncontrados?: number;
  totalCreados?: number;
  totalActualizados?: number;
  totalErrores?: number;
  detalle?: ImportarDespedidosDetalle[];
};
