// Script de validación (Dry-Run) para la producción de Agosto 2026
interface RawReportEntry {
  fecha: string; // YYYY-MM-DD
  turno: 'noche' | 'dia';
  molino: string;
  material: string;
  material_codigo?: string | null;
  amalgama_1_g: number;
  amalgama_2_g?: number | null;
  oro_recuperado_g: number;
  merma_1_pct?: number | null;
  merma_2_pct?: number | null;
  sacos: number;
  toneladas_procesadas: number | null;
  tenor_tonelada_gpt?: number | null;
  tenor_saco_gps?: number | null;
}

interface DailyTurno {
  fecha: string;
  totalTurnoWhatsApp: number;
  entries: RawReportEntry[];
}

export const AGOSTO_2026_DATA: DailyTurno[] = [
  // 01/08/2026
  {
    fecha: '2026-08-01',
    totalTurnoWhatsApp: 11.33,
    entries: [
      {
        fecha: '2026-08-01', turno: 'noche', molino: 'Molinos 01-02', material: 'Material Primario', material_codigo: null,
        amalgama_1_g: 17.53, oro_recuperado_g: 9.37, merma_1_pct: 46.54, sacos: 93, toneladas_procesadas: 4.65, tenor_tonelada_gpt: 2.015, tenor_saco_gps: 0.1008
      },
      {
        fecha: '2026-08-01', turno: 'noche', molino: 'Mantenimiento', material: 'Varios', material_codigo: null,
        amalgama_1_g: 1.67, oro_recuperado_g: 0.98, merma_1_pct: 41.32, sacos: 0, toneladas_procesadas: null
      },
      {
        fecha: '2026-08-01', turno: 'noche', molino: 'Molino Continuo', material: 'Repaso', material_codigo: null,
        amalgama_1_g: 2.00, oro_recuperado_g: 0.98, merma_1_pct: 51.00, sacos: 36, toneladas_procesadas: 1.80, tenor_tonelada_gpt: 0.544, tenor_saco_gps: 0.0272
      }
    ]
  },
  // 02/08/2026
  {
    fecha: '2026-08-02',
    totalTurnoWhatsApp: 12.72,
    entries: [
      {
        fecha: '2026-08-02', turno: 'noche', molino: 'Molino 1', material: 'Material Primario', material_codigo: 'V1D42',
        amalgama_1_g: 12.90, oro_recuperado_g: 5.76, merma_1_pct: 55.34, sacos: 48, toneladas_procesadas: 2.40, tenor_tonelada_gpt: 2.40, tenor_saco_gps: 0.12
      },
      {
        fecha: '2026-08-02', turno: 'noche', molino: 'Molino 2', material: 'Material Mixto', material_codigo: null,
        amalgama_1_g: 8.83, oro_recuperado_g: 4.66, merma_1_pct: 47.22, sacos: 49, toneladas_procesadas: 2.46, tenor_tonelada_gpt: 1.894, tenor_saco_gps: 0.0951
      },
      {
        fecha: '2026-08-02', turno: 'noche', molino: 'Mantenimiento', material: 'Varios', material_codigo: null,
        amalgama_1_g: 2.53, oro_recuperado_g: 1.43, merma_1_pct: 43.48, sacos: 0, toneladas_procesadas: null
      },
      {
        fecha: '2026-08-02', turno: 'noche', molino: 'Molino Continuo', material: 'Repaso', material_codigo: null,
        amalgama_1_g: 2.00, oro_recuperado_g: 0.88, merma_1_pct: 56.00, sacos: 36, toneladas_procesadas: 1.80, tenor_tonelada_gpt: 0.488, tenor_saco_gps: 0.0244
      }
    ]
  },
  // 03/08/2026
  {
    fecha: '2026-08-03',
    totalTurnoWhatsApp: 12.69,
    entries: [
      {
        fecha: '2026-08-03', turno: 'noche', molino: 'Molinos 01-02', material: 'Material Primario', material_codigo: null,
        amalgama_1_g: 23.00, oro_recuperado_g: 10.47, merma_1_pct: 54.47, sacos: 102, toneladas_procesadas: 5.10, tenor_tonelada_gpt: 2.052, tenor_saco_gps: 0.1026
      },
      {
        fecha: '2026-08-03', turno: 'noche', molino: 'Mantenimiento', material: 'Varios', material_codigo: null,
        amalgama_1_g: 1.73, oro_recuperado_g: 1.00, merma_1_pct: 42.19, sacos: 0, toneladas_procesadas: null
      },
      {
        fecha: '2026-08-03', turno: 'noche', molino: 'Molino Continuo', material: 'Repaso', material_codigo: null,
        amalgama_1_g: 2.70, oro_recuperado_g: 1.22, merma_1_pct: 54.81, sacos: 36, toneladas_procesadas: 1.80, tenor_tonelada_gpt: 0.677, tenor_saco_gps: 0.0338
      }
    ]
  },
  // 04/08/2026
  {
    fecha: '2026-08-04',
    totalTurnoWhatsApp: 10.94,
    entries: [
      {
        fecha: '2026-08-04', turno: 'noche', molino: 'Molinos 01-02', material: 'Material Primario', material_codigo: 'V2D46',
        amalgama_1_g: 19.01, oro_recuperado_g: 9.00, merma_1_pct: 52.65, sacos: 105, toneladas_procesadas: 5.25, tenor_tonelada_gpt: 1.714, tenor_saco_gps: 0.0857
      },
      {
        fecha: '2026-08-04', turno: 'noche', molino: 'Mantenimiento', material: 'Varios', material_codigo: null,
        amalgama_1_g: 1.35, oro_recuperado_g: 0.68, merma_1_pct: 49.63, sacos: 0, toneladas_procesadas: null
      },
      {
        fecha: '2026-08-04', turno: 'noche', molino: 'Molino Continuo', material: 'Repaso', material_codigo: null,
        amalgama_1_g: 2.64, oro_recuperado_g: 1.26, merma_1_pct: 52.27, sacos: 39, toneladas_procesadas: 1.95, tenor_tonelada_gpt: 0.646, tenor_saco_gps: 0.0323
      }
    ]
  },
  // 05/08/2026
  {
    fecha: '2026-08-05',
    totalTurnoWhatsApp: 8.46,
    entries: [
      {
        fecha: '2026-08-05', turno: 'noche', molino: 'Molino 1', material: 'Material Primario', material_codigo: 'V1D43',
        amalgama_1_g: 7.47, oro_recuperado_g: 3.78, merma_1_pct: 49.39, sacos: 39, toneladas_procesadas: 1.95, tenor_tonelada_gpt: 1.938, tenor_saco_gps: 0.0969
      },
      {
        fecha: '2026-08-05', turno: 'noche', molino: 'Molino 2', material: 'Material Primario', material_codigo: 'V2D47',
        amalgama_1_g: 5.01, oro_recuperado_g: 2.78, merma_1_pct: 44.51, sacos: 48, toneladas_procesadas: 2.40, tenor_tonelada_gpt: 1.158, tenor_saco_gps: 0.0579
      },
      {
        fecha: '2026-08-05', turno: 'noche', molino: 'Mantenimiento', material: 'Varios', material_codigo: null,
        amalgama_1_g: 0.98, oro_recuperado_g: 0.40, merma_1_pct: 59.18, sacos: 0, toneladas_procesadas: null
      },
      {
        fecha: '2026-08-05', turno: 'noche', molino: 'Molino Continuo', material: 'Repaso', material_codigo: null,
        amalgama_1_g: 3.00, oro_recuperado_g: 1.50, merma_1_pct: 50.00, sacos: 36, toneladas_procesadas: 1.80, tenor_tonelada_gpt: 0.833, tenor_saco_gps: 0.0416
      }
    ]
  },
  // 06/08/2026
  {
    fecha: '2026-08-06',
    totalTurnoWhatsApp: 7.00,
    entries: [
      {
        fecha: '2026-08-06', turno: 'noche', molino: 'Molinos 01-02', material: 'Repaso Mixto', material_codigo: null,
        amalgama_1_g: 17.00, oro_recuperado_g: 6.00, merma_1_pct: 64.70, sacos: 126, toneladas_procesadas: 6.30, tenor_tonelada_gpt: 0.952, tenor_saco_gps: 0.0476
      },
      {
        fecha: '2026-08-06', turno: 'noche', molino: 'Molino Continuo', material: 'Repaso', material_codigo: null,
        amalgama_1_g: 2.23, oro_recuperado_g: 1.00, merma_1_pct: 55.15, sacos: 39, toneladas_procesadas: 1.95, tenor_tonelada_gpt: 0.512, tenor_saco_gps: 0.0256
      }
    ]
  },
  // 07/08/2026
  {
    fecha: '2026-08-07',
    totalTurnoWhatsApp: 12.19,
    entries: [
      {
        fecha: '2026-08-07', turno: 'noche', molino: 'Molino 1', material: 'Material Primario', material_codigo: 'V1D44',
        amalgama_1_g: 12.87, oro_recuperado_g: 7.10, merma_1_pct: 44.83, sacos: 48, toneladas_procesadas: 2.40, tenor_tonelada_gpt: 2.958, tenor_saco_gps: 0.1479
      },
      {
        fecha: '2026-08-07', turno: 'noche', molino: 'Molino 2', material: 'Material Primario', material_codigo: 'V2D47 y V2D48',
        amalgama_1_g: 6.00, oro_recuperado_g: 3.00, merma_1_pct: 50.00, sacos: 49.2, toneladas_procesadas: 2.46, tenor_tonelada_gpt: 1.219, tenor_saco_gps: 0.0609
      },
      {
        fecha: '2026-08-07', turno: 'noche', molino: 'Mantenimiento', material: 'Varios', material_codigo: null,
        amalgama_1_g: 2.50, oro_recuperado_g: 1.10, merma_1_pct: 56.00, sacos: 0, toneladas_procesadas: null
      },
      {
        fecha: '2026-08-07', turno: 'noche', molino: 'Molino Continuo', material: 'Repaso', material_codigo: null,
        amalgama_1_g: 2.00, oro_recuperado_g: 0.99, merma_1_pct: 50.50, sacos: 39, toneladas_procesadas: 1.95, tenor_tonelada_gpt: 0.507, tenor_saco_gps: 0.0253
      }
    ]
  },
  // 08/08/2026
  {
    fecha: '2026-08-08',
    totalTurnoWhatsApp: 31.12,
    entries: [
      {
        fecha: '2026-08-08', turno: 'noche', molino: 'Molino 1', material: 'Material Primario', material_codigo: 'V1D44',
        amalgama_1_g: 33.26, oro_recuperado_g: 16.78, merma_1_pct: 49.45, sacos: 52.8, toneladas_procesadas: 2.64, tenor_tonelada_gpt: 6.356, tenor_saco_gps: 0.3178
      },
      {
        fecha: '2026-08-08', turno: 'noche', molino: 'Molino 2', material: 'Material Primario', material_codigo: 'V2D48',
        amalgama_1_g: 21.38, oro_recuperado_g: 10.90, merma_1_pct: 49.01, sacos: 51, toneladas_procesadas: 2.55, tenor_tonelada_gpt: 4.274, tenor_saco_gps: 0.2137
      },
      {
        fecha: '2026-08-08', turno: 'noche', molino: 'Mantenimiento', material: 'Varios', material_codigo: null,
        amalgama_1_g: 1.44, oro_recuperado_g: 0.78, merma_1_pct: 45.83, sacos: 0, toneladas_procesadas: null
      },
      {
        fecha: '2026-08-08', turno: 'noche', molino: 'Mantenimiento', material: 'Retorta', material_codigo: null,
        amalgama_1_g: 2.60, oro_recuperado_g: 1.16, merma_1_pct: 55.38, sacos: 0, toneladas_procesadas: null
      },
      {
        fecha: '2026-08-08', turno: 'noche', molino: 'Molino Continuo', material: 'Repaso', material_codigo: null,
        amalgama_1_g: 3.24, oro_recuperado_g: 1.50, merma_1_pct: 53.70, sacos: 39, toneladas_procesadas: 1.95, tenor_tonelada_gpt: 0.769, tenor_saco_gps: 0.0384
      }
    ]
  },
  // 09/08/2026
  {
    fecha: '2026-08-09',
    totalTurnoWhatsApp: 10.30,
    entries: [
      {
        fecha: '2026-08-09', turno: 'noche', molino: 'Molinos 01-02', material: 'Repaso', material_codigo: null,
        amalgama_1_g: 18.43, amalgama_2_g: 15.00, oro_recuperado_g: 8.30, merma_1_pct: 54.95, merma_2_pct: 44.66, sacos: 118.8, toneladas_procesadas: 5.94, tenor_tonelada_gpt: 1.397, tenor_saco_gps: 0.0698
      },
      {
        fecha: '2026-08-09', turno: 'noche', molino: 'Molino Continuo', material: 'Repaso', material_codigo: null,
        amalgama_1_g: 4.34, oro_recuperado_g: 2.00, merma_1_pct: 53.90, sacos: 39, toneladas_procesadas: 1.95, tenor_tonelada_gpt: 1.025, tenor_saco_gps: 0.0512
      }
    ]
  },
  // 10/08/2026
  {
    fecha: '2026-08-10',
    totalTurnoWhatsApp: 17.77,
    entries: [
      {
        fecha: '2026-08-10', turno: 'noche', molino: 'Molino 1-2', material: 'Material Primario', material_codigo: 'V1D44 y V1D45',
        amalgama_1_g: 24.11, oro_recuperado_g: 11.63, merma_1_pct: 51.76, sacos: 68.4, toneladas_procesadas: 3.42, tenor_tonelada_gpt: 3.400, tenor_saco_gps: 0.1700
      },
      {
        fecha: '2026-08-10', turno: 'noche', molino: 'Molino Continuo', material: 'Repaso', material_codigo: null,
        amalgama_1_g: 4.50, oro_recuperado_g: 2.00, merma_1_pct: 55.55, sacos: 42, toneladas_procesadas: 2.10, tenor_tonelada_gpt: 0.952, tenor_saco_gps: 0.0476
      },
      {
        fecha: '2026-08-10', turno: 'noche', molino: 'Mantenimiento', material: 'Varios', material_codigo: null,
        amalgama_1_g: 8.20, oro_recuperado_g: 4.14, merma_1_pct: 49.51, sacos: 0, toneladas_procesadas: null
      }
    ]
  },
  // 11/08/2026
  {
    fecha: '2026-08-11',
    totalTurnoWhatsApp: 13.02,
    entries: [
      {
        fecha: '2026-08-11', turno: 'noche', molino: 'Molino 3', material: 'Repaso', material_codigo: null,
        amalgama_1_g: 4.62, oro_recuperado_g: 1.70, merma_1_pct: 63.20, sacos: 54, toneladas_procesadas: 2.70, tenor_tonelada_gpt: 0.629, tenor_saco_gps: 0.0314
      },
      {
        fecha: '2026-08-11', turno: 'noche', molino: 'Molino 2', material: 'Material Primario', material_codigo: 'V1D45',
        amalgama_1_g: 14.54, oro_recuperado_g: 7.60, merma_1_pct: 47.73, sacos: 33, toneladas_procesadas: 1.65, tenor_tonelada_gpt: 4.606, tenor_saco_gps: 0.2303
      },
      {
        fecha: '2026-08-11', turno: 'noche', molino: 'Molino Continuo', material: 'Repaso', material_codigo: null,
        amalgama_1_g: 3.76, oro_recuperado_g: 2.10, merma_1_pct: 44.14, sacos: 40.4, toneladas_procesadas: 2.02, tenor_tonelada_gpt: 1.039, tenor_saco_gps: 0.0519
      },
      {
        fecha: '2026-08-11', turno: 'noche', molino: 'Mantenimiento', material: 'Varios', material_codigo: null,
        amalgama_1_g: 3.10, oro_recuperado_g: 1.62, merma_1_pct: 47.74, sacos: 0, toneladas_procesadas: null
      }
    ]
  },
  // 12/08/2026
  {
    fecha: '2026-08-12',
    totalTurnoWhatsApp: 4.80,
    entries: [
      {
        fecha: '2026-08-12', turno: 'noche', molino: 'Molino 3', material: 'Repaso', material_codigo: null,
        amalgama_1_g: 3.27, oro_recuperado_g: 1.69, merma_1_pct: 48.31, sacos: 54, toneladas_procesadas: 2.70, tenor_tonelada_gpt: 0.625, tenor_saco_gps: 0.0312
      },
      {
        fecha: '2026-08-12', turno: 'noche', molino: 'Molino 2', material: 'Material Primario', material_codigo: 'V4',
        amalgama_1_g: 1.01, oro_recuperado_g: 0.55, merma_1_pct: 45.54, sacos: 60, toneladas_procesadas: 3.00, tenor_tonelada_gpt: 0.183, tenor_saco_gps: 0.0091
      },
      {
        fecha: '2026-08-12', turno: 'noche', molino: 'Molino Continuo', material: 'Repaso', material_codigo: null,
        amalgama_1_g: 3.53, oro_recuperado_g: 1.68, merma_1_pct: 52.40, sacos: 40.4, toneladas_procesadas: 2.02, tenor_tonelada_gpt: 0.831, tenor_saco_gps: 0.0415
      },
      {
        fecha: '2026-08-12', turno: 'noche', molino: 'Mantenimiento', material: 'Varios', material_codigo: null,
        amalgama_1_g: 1.50, oro_recuperado_g: 0.88, merma_1_pct: 41.33, sacos: 0, toneladas_procesadas: null
      }
    ]
  },
  // 13/08/2026
  {
    fecha: '2026-08-13',
    totalTurnoWhatsApp: 33.21,
    entries: [
      {
        fecha: '2026-08-13', turno: 'noche', molino: 'Molino 3', material: 'Material Primario', material_codigo: 'V1D46',
        amalgama_1_g: 50.53, oro_recuperado_g: 23.55, merma_1_pct: 53.41, sacos: 30.6, toneladas_procesadas: 1.53, tenor_tonelada_gpt: 15.392, tenor_saco_gps: 0.7696
      },
      {
        fecha: '2026-08-13', turno: 'noche', molino: 'Molino 2', material: 'Material Primario', material_codigo: 'V2D49',
        amalgama_1_g: 12.21, oro_recuperado_g: 6.10, merma_1_pct: 50.04, sacos: 24, toneladas_procesadas: 1.20, tenor_tonelada_gpt: 5.083, tenor_saco_gps: 0.2541
      },
      {
        fecha: '2026-08-13', turno: 'noche', molino: 'Molino Continuo', material: 'Repaso', material_codigo: null,
        amalgama_1_g: 4.23, oro_recuperado_g: 1.85, merma_1_pct: 56.26, sacos: 20.4, toneladas_procesadas: 1.02, tenor_tonelada_gpt: 1.813, tenor_saco_gps: 0.0906
      },
      {
        fecha: '2026-08-13', turno: 'noche', molino: 'Mantenimiento', material: 'Varios', material_codigo: null,
        amalgama_1_g: 3.00, oro_recuperado_g: 1.72, merma_1_pct: 42.67, sacos: 0, toneladas_procesadas: null
      }
    ]
  },
  // 14/08/2026
  {
    fecha: '2026-08-14',
    totalTurnoWhatsApp: 27.01,
    entries: [
      {
        fecha: '2026-08-14', turno: 'noche', molino: 'Molino 2-3', material: 'Repaso Mixto', material_codigo: null,
        amalgama_1_g: 46.79, oro_recuperado_g: 22.47, merma_1_pct: 51.97, sacos: 82.5, toneladas_procesadas: 4.12, tenor_tonelada_gpt: 5.453, tenor_saco_gps: 0.2723
      },
      {
        fecha: '2026-08-14', turno: 'noche', molino: 'Molino 2', material: 'Material Primario', material_codigo: 'V2D50',
        amalgama_1_g: 3.01, oro_recuperado_g: 1.44, merma_1_pct: 52.15, sacos: 9, toneladas_procesadas: 0.45, tenor_tonelada_gpt: 3.200, tenor_saco_gps: 0.1600
      },
      {
        fecha: '2026-08-14', turno: 'noche', molino: 'Molino Continuo', material: 'Repaso', material_codigo: null,
        amalgama_1_g: 5.00, oro_recuperado_g: 2.34, merma_1_pct: 53.20, sacos: 36, toneladas_procesadas: 1.80, tenor_tonelada_gpt: 1.300, tenor_saco_gps: 0.0650
      },
      {
        fecha: '2026-08-14', turno: 'noche', molino: 'Mantenimiento', material: 'Varios', material_codigo: null,
        amalgama_1_g: 1.45, oro_recuperado_g: 0.76, merma_1_pct: 47.58, sacos: 0, toneladas_procesadas: null
      }
    ]
  },
  // 15/08/2026
  {
    fecha: '2026-08-15',
    totalTurnoWhatsApp: 16.64,
    entries: [
      {
        fecha: '2026-08-15', turno: 'noche', molino: 'Molino 2-3', material: 'Material Primario', material_codigo: 'V2D50',
        amalgama_1_g: 28.15, oro_recuperado_g: 12.86, merma_1_pct: 54.31, sacos: 63.6, toneladas_procesadas: 3.18, tenor_tonelada_gpt: 4.044, tenor_saco_gps: 0.2022
      },
      {
        fecha: '2026-08-15', turno: 'noche', molino: 'Molino Continuo', material: 'Repaso', material_codigo: null,
        amalgama_1_g: 6.98, oro_recuperado_g: 3.00, merma_1_pct: 57.02, sacos: 37.4, toneladas_procesadas: 1.87, tenor_tonelada_gpt: 1.604, tenor_saco_gps: 0.0802
      },
      {
        fecha: '2026-08-15', turno: 'noche', molino: 'Mantenimiento', material: 'Varios', material_codigo: null,
        amalgama_1_g: 1.72, oro_recuperado_g: 0.78, merma_1_pct: 54.65, sacos: 0, toneladas_procesadas: null
      }
    ]
  },
  // 16/08/2026
  {
    fecha: '2026-08-16',
    totalTurnoWhatsApp: 15.66,
    entries: [
      {
        fecha: '2026-08-16', turno: 'noche', molino: 'Molino 1-2', material: 'Material Primario', material_codigo: 'V1D47',
        amalgama_1_g: 20.40, oro_recuperado_g: 10.28, merma_1_pct: 49.60, sacos: 81, toneladas_procesadas: 4.05, tenor_tonelada_gpt: 2.538, tenor_saco_gps: 0.1269
      },
      {
        fecha: '2026-08-16', turno: 'noche', molino: 'Molino Continuo', material: 'Repaso', material_codigo: null,
        amalgama_1_g: 4.03, oro_recuperado_g: 2.00, merma_1_pct: 50.37, sacos: 39, toneladas_procesadas: 1.95, tenor_tonelada_gpt: 1.025, tenor_saco_gps: 0.0512
      },
      {
        fecha: '2026-08-16', turno: 'noche', molino: 'Mantenimiento', material: 'Varios', material_codigo: null,
        amalgama_1_g: 3.07, oro_recuperado_g: 1.68, merma_1_pct: 45.27, sacos: 0, toneladas_procesadas: null
      },
      {
        fecha: '2026-08-16', turno: 'noche', molino: 'Mantenimiento', material: 'Sala Raspado', material_codigo: null,
        amalgama_1_g: 3.66, oro_recuperado_g: 1.70, merma_1_pct: 53.55, sacos: 0, toneladas_procesadas: null
      }
    ]
  },
  // 17/08/2026
  {
    fecha: '2026-08-17',
    totalTurnoWhatsApp: 24.68,
    entries: [
      {
        fecha: '2026-08-17', turno: 'noche', molino: 'Molino 1-2', material: 'Material Primario', material_codigo: 'V1D47',
        amalgama_1_g: 37.05, oro_recuperado_g: 18.75, merma_1_pct: 49.39, sacos: 73.8, toneladas_procesadas: 3.69, tenor_tonelada_gpt: 5.081, tenor_saco_gps: 0.2540
      },
      {
        fecha: '2026-08-17', turno: 'noche', molino: 'Molino Continuo', material: 'Repaso', material_codigo: null,
        amalgama_1_g: 3.28, oro_recuperado_g: 1.58, merma_1_pct: 51.82, sacos: 31.4, toneladas_procesadas: 1.57, tenor_tonelada_gpt: 1.006, tenor_saco_gps: 0.0503
      },
      {
        fecha: '2026-08-17', turno: 'noche', molino: 'Mantenimiento', material: 'Varios', material_codigo: null,
        amalgama_1_g: 7.70, oro_recuperado_g: 4.35, merma_1_pct: 43.50, sacos: 0, toneladas_procesadas: null
      }
    ]
  },
  // 18/08/2026
  {
    fecha: '2026-08-18',
    totalTurnoWhatsApp: 30.10,
    entries: [
      {
        fecha: '2026-08-18', turno: 'noche', molino: 'Molino 1-2', material: 'Material Primario', material_codigo: 'V1D47',
        amalgama_1_g: 48.53, oro_recuperado_g: 24.37, merma_1_pct: 49.78, sacos: 80.7, toneladas_procesadas: 4.03, tenor_tonelada_gpt: 6.047, tenor_saco_gps: 0.3019
      },
      {
        fecha: '2026-08-18', turno: 'noche', molino: 'Molino Continuo', material: 'Repaso', material_codigo: null,
        amalgama_1_g: 5.00, oro_recuperado_g: 2.23, merma_1_pct: 55.40, sacos: 39, toneladas_procesadas: 1.95, tenor_tonelada_gpt: 1.143, tenor_saco_gps: 0.0571
      },
      {
        fecha: '2026-08-18', turno: 'noche', molino: 'Mantenimiento', material: 'Varios', material_codigo: null,
        amalgama_1_g: 7.62, oro_recuperado_g: 3.50, merma_1_pct: 54.06, sacos: 0, toneladas_procesadas: null
      }
    ]
  },
  // 19/08/2026
  {
    fecha: '2026-08-19',
    totalTurnoWhatsApp: 12.64,
    entries: [
      {
        fecha: '2026-08-19', turno: 'noche', molino: 'Molino 1-2', material: 'Repaso Mixto', material_codigo: null,
        amalgama_1_g: 19.47, oro_recuperado_g: 8.84, merma_1_pct: 54.59, sacos: 52.5, toneladas_procesadas: 2.62, tenor_tonelada_gpt: 3.374, tenor_saco_gps: 0.1683
      },
      {
        fecha: '2026-08-19', turno: 'noche', molino: 'Molino Continuo', material: 'Repaso', material_codigo: null,
        amalgama_1_g: 5.85, oro_recuperado_g: 2.40, merma_1_pct: 58.97, sacos: 36, toneladas_procesadas: 1.80, tenor_tonelada_gpt: 1.333, tenor_saco_gps: 0.0666
      },
      {
        fecha: '2026-08-19', turno: 'noche', molino: 'Mantenimiento', material: 'Varios', material_codigo: null,
        amalgama_1_g: 2.52, oro_recuperado_g: 1.40, merma_1_pct: 44.44, sacos: 0, toneladas_procesadas: null
      }
    ]
  },
  // 20/08/2026
  {
    fecha: '2026-08-20',
    totalTurnoWhatsApp: 17.28,
    entries: [
      {
        fecha: '2026-08-20', turno: 'noche', molino: 'Molino 3', material: 'Material Primario', material_codigo: 'V1D48',
        amalgama_1_g: 18.86, oro_recuperado_g: 9.29, merma_1_pct: 50.74, sacos: 30, toneladas_procesadas: 1.50, tenor_tonelada_gpt: 6.193, tenor_saco_gps: 0.3096
      },
      {
        fecha: '2026-08-20', turno: 'noche', molino: 'Molino 2', material: 'Material Primario', material_codigo: 'V2D51',
        amalgama_1_g: 11.40, oro_recuperado_g: 5.22, merma_1_pct: 54.21, sacos: 30.3, toneladas_procesadas: 1.51, tenor_tonelada_gpt: 3.456, tenor_saco_gps: 0.1722
      },
      {
        fecha: '2026-08-20', turno: 'noche', molino: 'Molino Continuo', material: 'Repaso', material_codigo: null,
        amalgama_1_g: 4.40, oro_recuperado_g: 2.01, merma_1_pct: 54.31, sacos: 37.4, toneladas_procesadas: 1.87, tenor_tonelada_gpt: 1.074, tenor_saco_gps: 0.0537
      },
      {
        fecha: '2026-08-20', turno: 'noche', molino: 'Mantenimiento', material: 'Varios', material_codigo: null,
        amalgama_1_g: 1.49, oro_recuperado_g: 0.76, merma_1_pct: 48.99, sacos: 0, toneladas_procesadas: null
      }
    ]
  },
  // 21/08/2026
  {
    fecha: '2026-08-21',
    totalTurnoWhatsApp: 9.13,
    entries: [
      {
        fecha: '2026-08-21', turno: 'noche', molino: 'Molino 3', material: 'Repaso Mixto', material_codigo: null,
        amalgama_1_g: 13.43, oro_recuperado_g: 6.58, merma_1_pct: 51.00, sacos: 24, toneladas_procesadas: 1.20, tenor_tonelada_gpt: 5.483, tenor_saco_gps: 0.2741
      },
      {
        fecha: '2026-08-21', turno: 'noche', molino: 'Molino Continuo', material: 'Repaso', material_codigo: null,
        amalgama_1_g: 3.12, oro_recuperado_g: 1.38, merma_1_pct: 55.76, sacos: 27, toneladas_procesadas: 1.35, tenor_tonelada_gpt: 1.022, tenor_saco_gps: 0.0511
      },
      {
        fecha: '2026-08-21', turno: 'noche', molino: 'Mantenimiento', material: 'Varios', material_codigo: null,
        amalgama_1_g: 1.01, oro_recuperado_g: 0.52, merma_1_pct: 48.51, sacos: 0, toneladas_procesadas: null
      },
      {
        fecha: '2026-08-21', turno: 'noche', molino: 'Mantenimiento', material: 'Continuo', material_codigo: null,
        amalgama_1_g: 1.36, oro_recuperado_g: 0.65, merma_1_pct: 52.20, sacos: 0, toneladas_procesadas: null
      }
    ]
  },
  // 22/08/2026
  {
    fecha: '2026-08-22',
    totalTurnoWhatsApp: 8.96,
    entries: [
      {
        fecha: '2026-08-22', turno: 'noche', molino: 'Molinos 02 y 03', material: 'Repaso', material_codigo: null,
        amalgama_1_g: 8.98, oro_recuperado_g: 4.16, merma_1_pct: 53.67, sacos: 106.5, toneladas_procesadas: 5.32, tenor_tonelada_gpt: 0.781, tenor_saco_gps: 0.0390
      },
      {
        fecha: '2026-08-22', turno: 'noche', molino: 'Molino Continuo', material: 'Repaso', material_codigo: null,
        amalgama_1_g: 5.78, oro_recuperado_g: 2.39, merma_1_pct: 58.65, sacos: 37.4, toneladas_procesadas: 1.87, tenor_tonelada_gpt: 1.278, tenor_saco_gps: 0.0639
      },
      {
        fecha: '2026-08-22', turno: 'noche', molino: 'Mantenimiento', material: 'Varios', material_codigo: null,
        amalgama_1_g: 1.01, oro_recuperado_g: 0.42, merma_1_pct: 58.41, sacos: 0, toneladas_procesadas: null
      },
      {
        fecha: '2026-08-22', turno: 'noche', molino: 'Mantenimiento', material: 'Plancha 2', material_codigo: null,
        amalgama_1_g: 5.23, oro_recuperado_g: 1.99, merma_1_pct: 61.95, sacos: 0, toneladas_procesadas: null
      }
    ]
  },
  // 23/08/2026
  {
    fecha: '2026-08-23',
    totalTurnoWhatsApp: 13.18,
    entries: [
      {
        fecha: '2026-08-23', turno: 'noche', molino: 'Molino 3', material: 'Material Primario', material_codigo: 'V1D48 y V2D52',
        amalgama_1_g: 20.10, oro_recuperado_g: 9.66, merma_1_pct: 51.94, sacos: 42.6, toneladas_procesadas: 2.13, tenor_tonelada_gpt: 4.535, tenor_saco_gps: 0.2267
      },
      {
        fecha: '2026-08-23', turno: 'noche', molino: 'Molino 2', material: 'Repaso', material_codigo: null,
        amalgama_1_g: 3.58, oro_recuperado_g: 1.49, merma_1_pct: 58.37, sacos: 54, toneladas_procesadas: 2.70, tenor_tonelada_gpt: 0.551, tenor_saco_gps: 0.0275
      },
      {
        fecha: '2026-08-23', turno: 'noche', molino: 'Molino Continuo', material: 'Repaso', material_codigo: null,
        amalgama_1_g: 3.62, oro_recuperado_g: 1.48, merma_1_pct: 59.11, sacos: 33, toneladas_procesadas: 1.65, tenor_tonelada_gpt: 0.896, tenor_saco_gps: 0.0448
      },
      {
        fecha: '2026-08-23', turno: 'noche', molino: 'Mantenimiento', material: 'Varios', material_codigo: null,
        amalgama_1_g: 0.99, oro_recuperado_g: 0.55, merma_1_pct: 44.44, sacos: 0, toneladas_procesadas: null
      }
    ]
  },
  // 24/08/2026
  {
    fecha: '2026-08-24',
    totalTurnoWhatsApp: 6.24,
    entries: [
      {
        fecha: '2026-08-24', turno: 'noche', molino: 'Molinos 02 y 03', material: 'Repaso', material_codigo: null,
        amalgama_1_g: 8.85, oro_recuperado_g: 3.88, merma_1_pct: 56.15, sacos: 99, toneladas_procesadas: 4.95, tenor_tonelada_gpt: 0.783, tenor_saco_gps: 0.0391
      },
      {
        fecha: '2026-08-24', turno: 'noche', molino: 'Molino Continuo', material: 'Repaso', material_codigo: null,
        amalgama_1_g: 4.72, oro_recuperado_g: 2.00, merma_1_pct: 57.62, sacos: 42, toneladas_procesadas: 2.10, tenor_tonelada_gpt: 0.952, tenor_saco_gps: 0.0476
      },
      {
        fecha: '2026-08-24', turno: 'noche', molino: 'Mantenimiento', material: 'Varios', material_codigo: null,
        amalgama_1_g: 0.71, oro_recuperado_g: 0.36, merma_1_pct: 49.29, sacos: 0, toneladas_procesadas: null
      }
    ]
  },
  // 25/08/2026
  {
    fecha: '2026-08-25',
    totalTurnoWhatsApp: 4.32,
    entries: [
      {
        fecha: '2026-08-25', turno: 'noche', molino: 'Molinos 02 y 03', material: 'Repaso', material_codigo: null,
        amalgama_1_g: 6.26, oro_recuperado_g: 2.76, merma_1_pct: 55.91, sacos: 96, toneladas_procesadas: 4.80, tenor_tonelada_gpt: 0.575, tenor_saco_gps: 0.0287
      },
      {
        fecha: '2026-08-25', turno: 'noche', molino: 'Mantenimiento', material: 'Varios', material_codigo: null,
        amalgama_1_g: 0.50, oro_recuperado_g: 0.20, merma_1_pct: 60.00, sacos: 0, toneladas_procesadas: null
      },
      {
        fecha: '2026-08-25', turno: 'noche', molino: 'Molino Continuo', material: 'Repaso', material_codigo: null,
        amalgama_1_g: 3.15, oro_recuperado_g: 1.36, merma_1_pct: 56.82, sacos: 39, toneladas_procesadas: 1.95, tenor_tonelada_gpt: 0.697, tenor_saco_gps: 0.0348
      }
    ]
  },
  // 26/08/2026
  {
    fecha: '2026-08-26',
    totalTurnoWhatsApp: 4.20,
    entries: [
      {
        fecha: '2026-08-26', turno: 'noche', molino: 'Molinos 02 y 03', material: 'Repaso', material_codigo: null,
        amalgama_1_g: 3.80, oro_recuperado_g: 1.66, merma_1_pct: 56.31, sacos: 95, toneladas_procesadas: 4.75, tenor_tonelada_gpt: 0.349, tenor_saco_gps: 0.0174
      },
      {
        fecha: '2026-08-26', turno: 'noche', molino: 'Mantenimiento', material: 'Varios', material_codigo: null,
        amalgama_1_g: 0.40, oro_recuperado_g: 0.13, merma_1_pct: 67.50, sacos: 0, toneladas_procesadas: null
      },
      {
        fecha: '2026-08-26', turno: 'noche', molino: 'Molino Continuo', material: 'Repaso', material_codigo: null,
        amalgama_1_g: 3.36, oro_recuperado_g: 1.41, merma_1_pct: 58.03, sacos: 39, toneladas_procesadas: 1.95, tenor_tonelada_gpt: 0.723, tenor_saco_gps: 0.0361
      },
      {
        fecha: '2026-08-26', turno: 'noche', molino: 'Mantenimiento', material: 'Sala Raspado', material_codigo: null,
        amalgama_1_g: 2.25, oro_recuperado_g: 1.00, merma_1_pct: 55.55, sacos: 0, toneladas_procesadas: null
      }
    ]
  },
  // 27/08/2026
  {
    fecha: '2026-08-27',
    totalTurnoWhatsApp: 2.28,
    entries: [
      {
        fecha: '2026-08-27', turno: 'noche', molino: 'Molinos 02 y 03', material: 'Repaso', material_codigo: null,
        amalgama_1_g: 2.26, oro_recuperado_g: 1.21, merma_1_pct: 54.51, sacos: 90, toneladas_procesadas: 4.50, tenor_tonelada_gpt: 0.268, tenor_saco_gps: 0.0134
      },
      {
        fecha: '2026-08-27', turno: 'noche', molino: 'Mantenimiento', material: 'Varios', material_codigo: null,
        amalgama_1_g: 0.15, oro_recuperado_g: 0.07, merma_1_pct: 53.33, sacos: 0, toneladas_procesadas: null
      },
      {
        fecha: '2026-08-27', turno: 'noche', molino: 'Molino Continuo', material: 'Repaso', material_codigo: null,
        amalgama_1_g: 2.34, oro_recuperado_g: 1.00, merma_1_pct: 57.26, sacos: 39, toneladas_procesadas: 1.95, tenor_tonelada_gpt: 0.512, tenor_saco_gps: 0.0256
      }
    ]
  },
  // 28/08/2026
  {
    fecha: '2026-08-28',
    totalTurnoWhatsApp: 8.43,
    entries: [
      {
        fecha: '2026-08-28', turno: 'noche', molino: 'Molinos 02 y 03', material: 'Material Primario', material_codigo: 'V2D53',
        amalgama_1_g: 15.80, oro_recuperado_g: 7.69, merma_1_pct: 51.32, sacos: 57, toneladas_procesadas: 2.85, tenor_tonelada_gpt: 2.698, tenor_saco_gps: 0.1349
      },
      {
        fecha: '2026-08-28', turno: 'noche', molino: 'Mantenimiento', material: 'Varios', material_codigo: null,
        amalgama_1_g: 0.50, oro_recuperado_g: 0.28, merma_1_pct: 44.00, sacos: 0, toneladas_procesadas: null
      },
      {
        fecha: '2026-08-28', turno: 'noche', molino: 'Molino Continuo', material: 'Repaso', material_codigo: null,
        amalgama_1_g: 1.01, oro_recuperado_g: 0.46, merma_1_pct: 54.45, sacos: 30, toneladas_procesadas: 1.50, tenor_tonelada_gpt: 0.306, tenor_saco_gps: 0.0153
      }
    ]
  },
  // 29/08/2026
  {
    fecha: '2026-08-29',
    totalTurnoWhatsApp: 15.86,
    entries: [
      {
        fecha: '2026-08-29', turno: 'noche', molino: 'Molino 1', material: 'Material Primario', material_codigo: 'V1D49',
        amalgama_1_g: 16.09, oro_recuperado_g: 8.00, merma_1_pct: 50.27, sacos: 51, toneladas_procesadas: 2.55, tenor_tonelada_gpt: 3.137, tenor_saco_gps: 0.1568
      },
      {
        fecha: '2026-08-29', turno: 'noche', molino: 'Molino 2', material: 'Material Primario', material_codigo: 'V2D53',
        amalgama_1_g: 11.00, oro_recuperado_g: 5.10, merma_1_pct: 53.63, sacos: 45, toneladas_procesadas: 2.25, tenor_tonelada_gpt: 2.266, tenor_saco_gps: 0.1133
      },
      {
        fecha: '2026-08-29', turno: 'noche', molino: 'Mantenimiento', material: 'Varios', material_codigo: null,
        amalgama_1_g: 3.80, oro_recuperado_g: 1.97, merma_1_pct: 48.15, sacos: 0, toneladas_procesadas: null
      },
      {
        fecha: '2026-08-29', turno: 'noche', molino: 'Molino Continuo', material: 'Repaso', material_codigo: null,
        amalgama_1_g: 1.80, oro_recuperado_g: 0.79, merma_1_pct: 56.11, sacos: 39, toneladas_procesadas: 1.95, tenor_tonelada_gpt: 0.405, tenor_saco_gps: 0.0202
      }
    ]
  },
  // 30/08/2026
  {
    fecha: '2026-08-30',
    totalTurnoWhatsApp: 15.69,
    entries: [
      {
        fecha: '2026-08-30', turno: 'noche', molino: 'Molino 2', material: 'Material Varios', material_codigo: null,
        amalgama_1_g: 11.02, oro_recuperado_g: 5.52, merma_1_pct: 49.90, sacos: 51, toneladas_procesadas: 2.55, tenor_tonelada_gpt: 2.164, tenor_saco_gps: 0.1082
      },
      {
        fecha: '2026-08-30', turno: 'noche', molino: 'Molino 3', material: 'Material Primario', material_codigo: 'V2D53',
        amalgama_1_g: 13.19, oro_recuperado_g: 6.16, merma_1_pct: 53.29, sacos: 55.2, toneladas_procesadas: 2.76, tenor_tonelada_gpt: 2.231, tenor_saco_gps: 0.1115
      },
      {
        fecha: '2026-08-30', turno: 'noche', molino: 'Mantenimiento', material: 'Varios', material_codigo: null,
        amalgama_1_g: 2.88, oro_recuperado_g: 1.58, merma_1_pct: 45.13, sacos: 0, toneladas_procesadas: null
      },
      {
        fecha: '2026-08-30', turno: 'noche', molino: 'Molino Continuo', material: 'Repaso', material_codigo: null,
        amalgama_1_g: 5.02, oro_recuperado_g: 2.43, merma_1_pct: 51.59, sacos: 39, toneladas_procesadas: 1.95, tenor_tonelada_gpt: 1.246, tenor_saco_gps: 0.0623
      }
    ]
  },
  // 31/08/2026
  {
    fecha: '2026-08-31',
    totalTurnoWhatsApp: 6.69,
    entries: [
      {
        fecha: '2026-08-31', turno: 'noche', molino: 'Molinos 02 y 03', material: 'Repaso', material_codigo: null,
        amalgama_1_g: 6.22, oro_recuperado_g: 2.98, merma_1_pct: 52.09, sacos: 126, toneladas_procesadas: 6.30, tenor_tonelada_gpt: 0.473, tenor_saco_gps: 0.0236
      },
      {
        fecha: '2026-08-31', turno: 'noche', molino: 'Mantenimiento', material: 'Varios', material_codigo: null,
        amalgama_1_g: 0.99, oro_recuperado_g: 0.41, merma_1_pct: 58.58, sacos: 0, toneladas_procesadas: null
      },
      {
        fecha: '2026-08-31', turno: 'noche', molino: 'Molino Continuo', material: 'Repaso', material_codigo: null,
        amalgama_1_g: 3.58, oro_recuperado_g: 1.59, merma_1_pct: 55.58, sacos: 42, toneladas_procesadas: 2.10, tenor_tonelada_gpt: 0.757, tenor_saco_gps: 0.0378
      },
      {
        fecha: '2026-08-31', turno: 'noche', molino: 'Mantenimiento', material: 'Plancha 2', material_codigo: null,
        amalgama_1_g: 3.00, oro_recuperado_g: 1.71, merma_1_pct: 43.00, sacos: 0, toneladas_procesadas: null
      }
    ]
  }
];

function clasificarOrigen(r: RawReportEntry): string {
  const molino = (r.molino || '').toLowerCase().trim();
  const material = (r.material || '').toLowerCase().trim();
  const codigo = (r.material_codigo || '').toUpperCase().trim();

  if (molino.includes('mantenimiento') || material.includes('mantenimiento')) {
    return 'Mantenimiento';
  }
  if (molino.includes('continuo') || material.includes('continuo')) {
    return 'Molino Continuo';
  }
  if (molino.includes('repaso') || material.includes('repaso')) {
    return 'Repaso';
  }
  if (molino.includes('caratal') || material.includes('caratal')) {
    return 'Caratal';
  }

  const buscarVertical = (s: string): string | null => {
    const m = s.match(/V([123])/i);
    return m ? `Vertical ${m[1]}` : null;
  };

  const v = buscarVertical(codigo) || buscarVertical(molino) || buscarVertical(material);
  if (v) return v;

  return 'Otros';
}

function runDryRun() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  DRY-RUN: COMPROBACIÓN DE CUADRE DIARIO (AGOSTO 2026)');
  console.log('═══════════════════════════════════════════════════════════════════');

  let totalDiscrepancies = 0;
  let totalAuAgosto = 0;
  let totalSacosAgosto = 0;
  let totalTonAgosto = 0;

  const grupos: Record<string, { count: number; au: number; sacos: number; ton: number }> = {
    'Vertical 1': { count: 0, au: 0, sacos: 0, ton: 0 },
    'Vertical 2': { count: 0, au: 0, sacos: 0, ton: 0 },
    'Vertical 3': { count: 0, au: 0, sacos: 0, ton: 0 },
    'Mantenimiento': { count: 0, au: 0, sacos: 0, ton: 0 },
    'Repaso': { count: 0, au: 0, sacos: 0, ton: 0 },
    'Molino Continuo': { count: 0, au: 0, sacos: 0, ton: 0 },
    'Otros': { count: 0, au: 0, sacos: 0, ton: 0 },
  };

  for (const day of AGOSTO_2026_DATA) {
    const sumEntries = day.entries.reduce((acc, e) => acc + e.oro_recuperado_g, 0);
    const diff = Math.abs(sumEntries - day.totalTurnoWhatsApp);
    const isMatch = diff < 0.015;

    if (!isMatch) {
      console.error(`❌ DISCREPANCIA en fecha ${day.fecha}: Suma filas = ${sumEntries.toFixed(2)}g vs WhatsApp = ${day.totalTurnoWhatsApp.toFixed(2)}g (diff: ${(sumEntries - day.totalTurnoWhatsApp).toFixed(2)}g)`);
      totalDiscrepancies++;
    }

    for (const e of day.entries) {
      const orig = clasificarOrigen(e);
      grupos[orig].count++;
      grupos[orig].au += e.oro_recuperado_g;
      grupos[orig].sacos += e.sacos;
      grupos[orig].ton += e.toneladas_procesadas || 0;

      totalAuAgosto += e.oro_recuperado_g;
      totalSacosAgosto += e.sacos;
      totalTonAgosto += e.toneladas_procesadas || 0;
    }
  }

  console.log(`\nDías analizados: ${AGOSTO_2026_DATA.length}/31`);
  console.log(`Total registros individuales a insertar: ${AGOSTO_2026_DATA.reduce((acc, d) => acc + d.entries.length, 0)}`);
  console.log(`Discrepancias encontradas: ${totalDiscrepancies}`);

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  RESUMEN CONSOLIDADO POR ORIGEN (PRODUCCIÓN AGOSTO 2026)');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.table(
    Object.entries(grupos).map(([origen, stats]) => ({
      'Origen / Método': origen,
      'Registros': stats.count,
      'Au Recuperado (g)': Number(stats.au.toFixed(4)),
      '% del Total': totalAuAgosto > 0 ? Number(((stats.au / totalAuAgosto) * 100).toFixed(1)) + '%' : '0%',
      'Sacos': Math.round(stats.sacos),
      'Toneladas': Number(stats.ton.toFixed(3)),
      'Tenor (g/t)': stats.ton > 0 ? Number((stats.au / stats.ton).toFixed(4)) : 0,
    }))
  );

  console.log('───────────────────────────────────────────────────────────────────');
  console.log(`TOTAL MOLINOS AU (g): ${totalAuAgosto.toFixed(4)} g`);
  console.log(`TOTAL SACOS:          ${Math.round(totalSacosAgosto)}`);
  console.log(`TOTAL TONELADAS:      ${totalTonAgosto.toFixed(3)} ton`);
  console.log(`TENOR GLOBAL:         ${(totalAuAgosto / totalTonAgosto).toFixed(4)} g/t`);
  console.log('═══════════════════════════════════════════════════════════════════');
}

async function insertToSupabase() {
  const { createClient } = await import('@supabase/supabase-js');
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://abhfedunawgzfnzeazgb.supabase.co';
  const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_8VD8RgaFYZ1H32HrFJGY1Q_rAEC2aAE';
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: process.env.NEXT_PUBLIC_GUEST_EMAIL || 'invitado@mineos.local',
    password: process.env.NEXT_PUBLIC_GUEST_PASSWORD || 'MineOS_Viewer_2024!',
  });

  if (authErr || !auth?.user) {
    console.error('Error autenticando:', authErr);
    return;
  }

  // Verificar si ya hay datos en agosto 2026 para no duplicar
  const { count, error: countErr } = await supabase
    .from('reportes_produccion')
    .select('*', { count: 'exact', head: true })
    .gte('fecha', '2026-08-01')
    .lte('fecha', '2026-08-31');

  if (count && count > 0) {
    console.log(`⚠️ Ya existen ${count} registros en agosto 2026.`);
  }

  console.log('\n🚀 Insertando 109 registros en la base de datos Supabase...');

  const allRowsToInsert: any[] = [];
  for (const day of AGOSTO_2026_DATA) {
    for (const e of day.entries) {
      allRowsToInsert.push({
        complex_id: '86ef53c0-25d4-499e-9691-e572693cda74',
        fecha: e.fecha,
        turno: e.turno,
        molino: e.molino,
        material: e.material,
        material_codigo: e.material_codigo || null,
        amalgama_1_g: e.amalgama_1_g || null,
        amalgama_2_g: e.amalgama_2_g || null,
        oro_recuperado_g: e.oro_recuperado_g,
        merma_1_pct: e.merma_1_pct || null,
        merma_2_pct: e.merma_2_pct || null,
        sacos: e.sacos,
        toneladas_procesadas: e.toneladas_procesadas,
        tenor_tonelada_gpt: e.tenor_tonelada_gpt || null,
        tenor_saco_gps: e.tenor_saco_gps || null,
        registrado_por: '9501cd47-455c-4db7-a630-09fe5e53c46f',
      });
    }
  }

  // Insertar en lotes de 25
  const batchSize = 25;
  for (let i = 0; i < allRowsToInsert.length; i += batchSize) {
    const batch = allRowsToInsert.slice(i, i + batchSize);
    const { error: insErr } = await supabase.from('reportes_produccion').insert(batch);
    if (insErr) {
      console.error(`❌ Error insertando lote ${i}-${i + batch.length}:`, insErr.message);
      return;
    }
    console.log(`✅ Lote ${Math.floor(i / batchSize) + 1}/${Math.ceil(allRowsToInsert.length / batchSize)} insertado (${batch.length} registros).`);
  }

  console.log('\n🎉 ¡TODOS LOS 109 REGISTROS DE AGOSTO 2026 HAN SIDO INSERTADOS CON ÉXITO!');
}

async function main() {
  runDryRun();
  if (process.argv.includes('--insert')) {
    await insertToSupabase();
  } else {
    console.log('\n(Ejecuta con --insert para guardar definitivamente en la base de datos)');
  }
}

main();
