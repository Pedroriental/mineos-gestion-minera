// ============================================================
// MineOS - Catálogo de columnas filtrables por tabla
// Fuente de verdad única para el constructor universal de reportes
// ============================================================

export const FILTRABLE_COLUMNS = {
  reportes_produccion: {
    table: 'reportes_produccion' as const,
    columns: [
      { key: 'fecha',               type: 'date',     label: 'Fecha',          dbCol: 'fecha::date' },
      { key: 'turno',               type: 'enum',     label: 'Turno',           dbCol: 'turno',  values: ['DÍA', 'NOCHE', 'COMPLETO'] },
      { key: 'molino',              type: 'multi',    label: 'Molino',          dbCol: 'molino' },
      { key: 'material',            type: 'multi',    label: 'Material',        dbCol: 'material' },
      { key: 'material_codigo',     type: 'regex',    label: 'Código Material', dbCol: 'material_codigo' },
      { key: 'oro_recuperado_g',    type: 'range',    label: 'Oro Recuperado g', dbCol: 'oro_recuperado_g', unit: 'g' },
      { key: 'sacos',               type: 'range',    label: 'Sacos',           dbCol: 'sacos', unit: 'uds' },
      { key: 'toneladas_procesadas',type: 'range',    label: 'Toneladas',       dbCol: 'toneladas_procesadas', unit: 't' },
      { key: 'tenor_tonelada_gpt',  type: 'range',    label: 'Tenor g/t',       dbCol: 'tenor_tonelada_gpt', unit: 'g/t' },
      { key: 'merma_1_pct',         type: 'range',    label: 'Merma 1 %',       dbCol: 'merma_1_pct', unit: '%' },
      { key: 'merma_2_pct',         type: 'range',    label: 'Merma 2 %',       dbCol: 'merma_2_pct', unit: '%' },
      { key: 'responsable',         type: 'text',     label: 'Responsable',     dbCol: 'responsable' },
    ],
    defaultGroupBy: 'dia',
    groupByOptions: ['dia', 'semana', 'mes', 'molino', 'material', 'turno'],
    dateColumn: 'fecha',
  },

  reportes_extraccion: {
    table: 'reportes_extraccion' as const,
    columns: [
      { key: 'fecha',           type: 'date',  label: 'Fecha',          dbCol: 'fecha::date' },
      { key: 'turno',           type: 'enum',  label: 'Turno',           dbCol: 'turno',  values: ['DÍA', 'NOCHE', 'COMPLETO'] },
      { key: 'mina',            type: 'multi', label: 'Mina',            dbCol: 'mina' },
      { key: 'vertical',        type: 'multi', label: 'Vertical',        dbCol: 'vertical' },
      { key: 'sacos_extraidos', type: 'range', label: 'Sacos Extraídos', dbCol: 'sacos_extraidos', unit: 'uds' },
    ],
    defaultGroupBy: 'dia',
    groupByOptions: ['dia', 'semana', 'mes', 'mina', 'vertical', 'turno'],
    dateColumn: 'fecha',
  },

  reportes_quemado: {
    table: 'reportes_quemado' as const,
    columns: [
      { key: 'fecha',            type: 'date',  label: 'Fecha',            dbCol: 'fecha::date' },
      { key: 'turno',            type: 'enum',  label: 'Turno',            dbCol: 'turno',  values: ['DÍA', 'NOCHE', 'COMPLETO'] },
      { key: 'total_amalgama_g', type: 'range', label: 'Amalgama Total g', dbCol: 'total_amalgama_g', unit: 'g' },
      { key: 'total_oro_g',      type: 'range', label: 'Oro Total g',      dbCol: 'total_oro_g', unit: 'g' },
      { key: 'manto_oro_g',      type: 'range', label: 'Manto Oro g',      dbCol: 'manto_oro_g', unit: 'g' },
      { key: 'retorta_oro_g',    type: 'range', label: 'Retorta Oro g',    dbCol: 'retorta_oro_g', unit: 'g' },
    ],
    defaultGroupBy: 'dia',
    groupByOptions: ['dia', 'semana', 'mes', 'turno'],
    dateColumn: 'fecha',
  },

  reportes_voladuras: {
    table: 'reportes_voladuras' as const,
    columns: [
      { key: 'fecha',            type: 'date',  label: 'Fecha',           dbCol: 'fecha::date' },
      { key: 'turno',            type: 'enum',  label: 'Turno',            dbCol: 'turno',  values: ['DÍA', 'NOCHE', 'COMPLETO'] },
      { key: 'mina',             type: 'multi', label: 'Mina',             dbCol: 'mina' },
      { key: 'frente',           type: 'multi', label: 'Frente',           dbCol: 'frente' },
      { key: 'vertical_disparo', type: 'multi', label: 'Vertical Disparo', dbCol: 'vertical_disparo' },
      { key: 'huecos_cantidad',  type: 'range', label: 'Huecos',           dbCol: 'huecos_cantidad', unit: 'uds' },
      { key: 'chupis_cantidad',  type: 'range', label: 'Chupis',           dbCol: 'chupis_cantidad', unit: 'uds' },
      { key: 'arroz_kg',         type: 'range', label: 'Arroz kg',         dbCol: 'arroz_kg', unit: 'kg' },
      { key: 'sin_novedad',      type: 'bool',  label: 'Sin Novedad',      dbCol: 'sin_novedad' },
    ],
    defaultGroupBy: 'dia',
    groupByOptions: ['dia', 'semana', 'mes', 'mina', 'turno'],
    dateColumn: 'fecha',
  },

  gastos: {
    table: 'gastos' as const,
    columns: [
      { key: 'fecha',             type: 'date',  label: 'Fecha',            dbCol: 'g.fecha::date' },
      { key: 'categoria_id',      type: 'multi', label: 'Categoría',        dbCol: 'g.categoria_id' },
      { key: 'tipo',              type: 'enum',  label: 'Tipo',              dbCol: 'cg.tipo',  values: ['mina', 'planta', 'general', 'transporte', 'seguridad', 'administrativo'] },
      { key: 'monto',             type: 'range', label: 'Monto USD',        dbCol: 'g.monto', unit: 'USD' },
      { key: 'proveedor',         type: 'text',  label: 'Proveedor',        dbCol: 'g.proveedor' },
      { key: 'descripcion',       type: 'text',  label: 'Descripción',      dbCol: 'g.descripcion' },
      { key: 'factura_referencia',type: 'text',  label: 'Ref. Factura',     dbCol: 'g.factura_referencia' },
    ],
    defaultGroupBy: 'categoria',
    groupByOptions: ['dia', 'semana', 'mes', 'categoria', 'tipo', 'proveedor'],
    dateColumn: 'fecha',
    joinClause: 'LEFT JOIN categorias_gasto cg ON cg.id = g.categoria_id',
  },

  nomina_semanas: {
    table: 'nomina_semanas' as const,
    columns: [
      { key: 'semana_inicio', type: 'date',  label: 'Semana Inicio', dbCol: 'ns.semana_inicio::date' },
      { key: 'semana_fin',    type: 'date',  label: 'Semana Fin',    dbCol: 'ns.semana_fin::date' },
      { key: 'area',          type: 'enum',  label: 'Área',           dbCol: 'ns.area',  values: ['mina', 'planta', 'administracion', 'seguridad', 'transporte'] },
      { key: 'total_pagado',  type: 'range', label: 'Total Pagado',   dbCol: 'ns.total_pagado', unit: 'USD' },
    ],
    defaultGroupBy: 'semana',
    groupByOptions: ['semana', 'mes', 'area'],
    dateColumn: 'semana_inicio',
  },
} as const;

export type FilterableTable = keyof typeof FILTRABLE_COLUMNS;

export type FilterColumnDef = {
  key: string;
  type: 'date' | 'enum' | 'multi' | 'range' | 'regex' | 'text' | 'bool';
  label: string;
  dbCol: string;
  values?: string[];
  unit?: string;
};

export type TableFilterConfig = {
  table: string;
  columns: FilterColumnDef[];
  defaultGroupBy: string;
  groupByOptions: string[];
  dateColumn: string;
  joinClause?: string;
};
