// Types for the import action — no 'use server' here so it can export types freely.

export type ImportarDespedidosRow = {
  cedula: string;
  diasTrabajados: number;
  cobraSemanaLibre: boolean;
  bonificaciones: number;
  despidoFecha: string;
  despidoCausa: string;
};

export type ImportarDespedidosResult = {
  ok: boolean;
  message: string;
  totalProcesados?: number;
  totalNoEncontrados?: number;
  cedulasNoEncontradas?: string[];
};
