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
  matchedBy?: 'cedula' | 'nombre' | 'fuzzy-name';
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
