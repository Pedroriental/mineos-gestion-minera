/**
 * Datos de producción de Septiembre 2026 (16/09/2026 al 30/09/2026) - Complejo Minero La Fé.
 * Fuente: Reportes diarios de turno de planta (WhatsApp) debidamente validados y auditados.
 * Total Oro Recuperado en quincena: 288.75 g Au.
 */

import type { ReporteProduccion } from '@/lib/types';

export interface SeptiembreProduccionTurnoItem {
  fecha: string; // YYYY-MM-DD
  turno: 'noche' | 'dia' | 'completo';
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
  observaciones?: string | null;
}

export interface SeptiembreDailyTurno {
  fecha: string;
  totalTurnoWhatsApp: number;
  entries: SeptiembreProduccionTurnoItem[];
}

export const SEPTIEMBRE_2026_DATA: SeptiembreDailyTurno[] = [
  // 16/09/2026 - Total: 15.68 g Au
  {
    fecha: '2026-09-16',
    totalTurnoWhatsApp: 15.68,
    entries: [
      {
        fecha: '2026-09-16', turno: 'noche', molino: 'Molino 3', material: 'Material Primario', material_codigo: 'V1D51',
        amalgama_1_g: 17.50, oro_recuperado_g: 9.50, merma_1_pct: 45.71, sacos: 31.5, toneladas_procesadas: 1.57, tenor_tonelada_gpt: 6.00, tenor_saco_gps: 0.30
      },
      {
        fecha: '2026-09-16', turno: 'noche', molino: 'Molino 2', material: 'Repaso', material_codigo: null,
        amalgama_1_g: 6.39, oro_recuperado_g: 3.20, merma_1_pct: 49.92, sacos: 54, toneladas_procesadas: 2.70, tenor_tonelada_gpt: 1.18, tenor_saco_gps: 0.0593
      },
      {
        fecha: '2026-09-16', turno: 'noche', molino: 'Molino Continuo', material: 'Repaso', material_codigo: null,
        amalgama_1_g: 4.18, oro_recuperado_g: 1.99, merma_1_pct: 52.39, sacos: 30, toneladas_procesadas: 1.50, tenor_tonelada_gpt: 1.32, tenor_saco_gps: 0.0663
      },
      {
        fecha: '2026-09-16', turno: 'noche', molino: 'Mantenimiento', material: 'Varios', material_codigo: null,
        amalgama_1_g: 2.00, oro_recuperado_g: 0.99, merma_1_pct: 50.50, sacos: 0, toneladas_procesadas: null, tenor_tonelada_gpt: null, tenor_saco_gps: null
      }
    ]
  },
  // 17/09/2026 - Total: 19.96 g Au
  {
    fecha: '2026-09-17',
    totalTurnoWhatsApp: 19.96,
    entries: [
      {
        fecha: '2026-09-17', turno: 'noche', molino: 'Molino 3', material: 'Material Primario Mixto', material_codigo: 'V1D51',
        amalgama_1_g: 19.93, oro_recuperado_g: 9.25, merma_1_pct: 53.58, sacos: 36, toneladas_procesadas: 1.80, tenor_tonelada_gpt: 5.13, tenor_saco_gps: 0.25
      },
      {
        fecha: '2026-09-17', turno: 'noche', molino: 'Molino 2', material: 'Material Primario', material_codigo: 'V2D58',
        amalgama_1_g: 18.10, oro_recuperado_g: 8.00, merma_1_pct: 55.80, sacos: 42, toneladas_procesadas: 2.10, tenor_tonelada_gpt: 3.80, tenor_saco_gps: 0.19
      },
      {
        fecha: '2026-09-17', turno: 'noche', molino: 'Molino Continuo', material: 'Repaso', material_codigo: null,
        amalgama_1_g: 4.02, oro_recuperado_g: 1.88, merma_1_pct: 53.23, sacos: 30, toneladas_procesadas: 1.50, tenor_tonelada_gpt: 1.25, tenor_saco_gps: 0.0627
      },
      {
        fecha: '2026-09-17', turno: 'noche', molino: 'Mantenimiento', material: 'Varios', material_codigo: null,
        amalgama_1_g: 1.59, oro_recuperado_g: 0.83, merma_1_pct: 47.80, sacos: 0, toneladas_procesadas: null, tenor_tonelada_gpt: null, tenor_saco_gps: null
      }
    ]
  },
  // 18/09/2026 - Total: 17.73 g Au
  {
    fecha: '2026-09-18',
    totalTurnoWhatsApp: 17.73,
    entries: [
      {
        fecha: '2026-09-18', turno: 'noche', molino: 'Molinos 02 y 03', material: 'Material Primario', material_codigo: 'V1D51',
        amalgama_1_g: 29.33, oro_recuperado_g: 14.22, merma_1_pct: 51.51, sacos: 75, toneladas_procesadas: 3.75, tenor_tonelada_gpt: 3.79, tenor_saco_gps: 0.18
      },
      {
        fecha: '2026-09-18', turno: 'noche', molino: 'Molino Continuo', material: 'Repaso', material_codigo: null,
        amalgama_1_g: 4.73, oro_recuperado_g: 2.29, merma_1_pct: 51.58, sacos: 36, toneladas_procesadas: 1.80, tenor_tonelada_gpt: 1.27, tenor_saco_gps: 0.0636
      },
      {
        fecha: '2026-09-18', turno: 'noche', molino: 'Mantenimiento', material: 'Varios', material_codigo: null,
        amalgama_1_g: 2.32, oro_recuperado_g: 1.22, merma_1_pct: 47.41, sacos: 0, toneladas_procesadas: null, tenor_tonelada_gpt: null, tenor_saco_gps: null
      }
    ]
  },
  // 19/09/2026 - Total: 21.48 g Au
  {
    fecha: '2026-09-19',
    totalTurnoWhatsApp: 21.48,
    entries: [
      {
        fecha: '2026-09-19', turno: 'noche', molino: 'Molinos 02 y 03', material: 'Material Primario', material_codigo: 'V2D58',
        amalgama_1_g: 38.01, oro_recuperado_g: 17.77, merma_1_pct: 53.24, sacos: 74.7, toneladas_procesadas: 3.73, tenor_tonelada_gpt: 4.76, tenor_saco_gps: 0.23
      },
      {
        fecha: '2026-09-19', turno: 'noche', molino: 'Molino Continuo', material: 'Repaso', material_codigo: null,
        amalgama_1_g: 5.51, oro_recuperado_g: 2.52, merma_1_pct: 54.26, sacos: 34.4, toneladas_procesadas: 1.72, tenor_tonelada_gpt: 1.46, tenor_saco_gps: 0.0733
      },
      {
        fecha: '2026-09-19', turno: 'noche', molino: 'Mantenimiento', material: 'Varios', material_codigo: null,
        amalgama_1_g: 2.22, oro_recuperado_g: 1.19, merma_1_pct: 46.40, sacos: 0, toneladas_procesadas: null, tenor_tonelada_gpt: null, tenor_saco_gps: null
      }
    ]
  },
  // 20/09/2026 - Total: 24.70 g Au
  {
    fecha: '2026-09-20',
    totalTurnoWhatsApp: 24.70,
    entries: [
      {
        fecha: '2026-09-20', turno: 'noche', molino: 'Molino 2', material: 'Repaso', material_codigo: null,
        amalgama_1_g: 12.71, oro_recuperado_g: 4.89, merma_1_pct: 61.52, sacos: 63, toneladas_procesadas: 3.15, tenor_tonelada_gpt: 1.55, tenor_saco_gps: 0.0776
      },
      {
        fecha: '2026-09-20', turno: 'noche', molino: 'Molino 3', material: 'Material Primario', material_codigo: 'V2D58',
        amalgama_1_g: 33.68, oro_recuperado_g: 15.58, merma_1_pct: 53.74, sacos: 53.7, toneladas_procesadas: 2.68, tenor_tonelada_gpt: 5.81, tenor_saco_gps: 0.29
      },
      {
        fecha: '2026-09-20', turno: 'noche', molino: 'Molino Continuo', material: 'Repaso', material_codigo: null,
        amalgama_1_g: 7.10, oro_recuperado_g: 3.65, merma_1_pct: 48.59, sacos: 36, toneladas_procesadas: 1.80, tenor_tonelada_gpt: 2.02, tenor_saco_gps: 0.1014
      },
      {
        fecha: '2026-09-20', turno: 'noche', molino: 'Mantenimiento', material: 'Varios', material_codigo: null,
        amalgama_1_g: 1.16, oro_recuperado_g: 0.58, merma_1_pct: 50.00, sacos: 0, toneladas_procesadas: null, tenor_tonelada_gpt: null, tenor_saco_gps: null
      }
    ]
  },
  // 21/09/2026 - Total: 17.44 g Au
  {
    fecha: '2026-09-21',
    totalTurnoWhatsApp: 17.44,
    entries: [
      {
        fecha: '2026-09-21', turno: 'noche', molino: 'Molino 2', material: 'Material Primario', material_codigo: 'V1D53',
        amalgama_1_g: 22.00, oro_recuperado_g: 11.42, merma_1_pct: 48.00, sacos: 45, toneladas_procesadas: 2.25, tenor_tonelada_gpt: 5.07, tenor_saco_gps: 0.25
      },
      {
        fecha: '2026-09-21', turno: 'noche', molino: 'Molino 3', material: 'Repaso', material_codigo: null,
        amalgama_1_g: 4.35, oro_recuperado_g: 2.00, merma_1_pct: 54.00, sacos: 67.8, toneladas_procesadas: 3.39, tenor_tonelada_gpt: 0.58, tenor_saco_gps: 0.02
      },
      {
        fecha: '2026-09-21', turno: 'noche', molino: 'Molino Continuo', material: 'Repaso', material_codigo: null,
        amalgama_1_g: 6.77, oro_recuperado_g: 3.34, merma_1_pct: 50.60, sacos: 39, toneladas_procesadas: 1.95, tenor_tonelada_gpt: 1.71, tenor_saco_gps: 0.0856
      },
      {
        fecha: '2026-09-21', turno: 'noche', molino: 'Mantenimiento', material: 'Varios', material_codigo: null,
        amalgama_1_g: 1.30, oro_recuperado_g: 0.68, merma_1_pct: 47.69, sacos: 0, toneladas_procesadas: null, tenor_tonelada_gpt: null, tenor_saco_gps: null
      }
    ]
  },
  // 22/09/2026 - Total: 20.00 g Au
  {
    fecha: '2026-09-22',
    totalTurnoWhatsApp: 20.00,
    entries: [
      {
        fecha: '2026-09-22', turno: 'noche', molino: 'Molinos 02 y 03', material: 'Material Primario', material_codigo: null,
        amalgama_1_g: 34.85, oro_recuperado_g: 16.35, merma_1_pct: 53.08, sacos: 126, toneladas_procesadas: 6.30, tenor_tonelada_gpt: 2.59, tenor_saco_gps: 0.12
      },
      {
        fecha: '2026-09-22', turno: 'noche', molino: 'Molino Continuo', material: 'Repaso', material_codigo: null,
        amalgama_1_g: 6.64, oro_recuperado_g: 3.35, merma_1_pct: 49.54, sacos: 39, toneladas_procesadas: 1.95, tenor_tonelada_gpt: 1.71, tenor_saco_gps: 0.0859
      },
      {
        fecha: '2026-09-22', turno: 'noche', molino: 'Mantenimiento', material: 'Varios', material_codigo: null,
        amalgama_1_g: 0.59, oro_recuperado_g: 0.30, merma_1_pct: 49.15, sacos: 0, toneladas_procesadas: null, tenor_tonelada_gpt: null, tenor_saco_gps: null
      }
    ]
  },
  // 23/09/2026 - Total: 11.25 g Au
  {
    fecha: '2026-09-23',
    totalTurnoWhatsApp: 11.25,
    entries: [
      {
        fecha: '2026-09-23', turno: 'noche', molino: 'Molinos 02 y 03', material: 'Material Primario', material_codigo: null,
        amalgama_1_g: 10.75, oro_recuperado_g: 5.33, merma_1_pct: 50.42, sacos: 126, toneladas_procesadas: 6.30, tenor_tonelada_gpt: 0.84, tenor_saco_gps: 0.04
      },
      {
        fecha: '2026-09-23', turno: 'noche', molino: 'Molino Continuo', material: 'Repaso', material_codigo: null,
        amalgama_1_g: 6.03, oro_recuperado_g: 3.14, merma_1_pct: 47.92, sacos: 39, toneladas_procesadas: 1.95, tenor_tonelada_gpt: 1.61, tenor_saco_gps: 0.0805
      },
      {
        fecha: '2026-09-23', turno: 'noche', molino: 'Mantenimiento', material: 'Varios', material_codigo: null,
        amalgama_1_g: 0.50, oro_recuperado_g: 0.20, merma_1_pct: 60.00, sacos: 0, toneladas_procesadas: null, tenor_tonelada_gpt: null, tenor_saco_gps: null
      },
      {
        fecha: '2026-09-23', turno: 'noche', molino: 'Mantenimiento', material: 'Retorta', material_codigo: null,
        amalgama_1_g: 5.00, oro_recuperado_g: 2.58, merma_1_pct: 48.40, sacos: 0, toneladas_procesadas: null, tenor_tonelada_gpt: null, tenor_saco_gps: null,
        observaciones: 'Mtto Varios - Retorta'
      }
    ]
  },
  // 24/09/2026 - Total: 15.90 g Au
  {
    fecha: '2026-09-24',
    totalTurnoWhatsApp: 15.90,
    entries: [
      {
        fecha: '2026-09-24', turno: 'noche', molino: 'Molinos 02 y 03', material: 'Material Primario', material_codigo: 'V2D60',
        amalgama_1_g: 30.21, oro_recuperado_g: 12.90, merma_1_pct: 57.29, sacos: 87, toneladas_procesadas: 4.35, tenor_tonelada_gpt: 2.96, tenor_saco_gps: 0.14
      },
      {
        fecha: '2026-09-24', turno: 'noche', molino: 'Mantenimiento', material: 'Varios', material_codigo: null,
        amalgama_1_g: 1.02, oro_recuperado_g: 0.60, merma_1_pct: 41.18, sacos: 0, toneladas_procesadas: null, tenor_tonelada_gpt: null, tenor_saco_gps: null
      },
      {
        fecha: '2026-09-24', turno: 'noche', molino: 'Molino Continuo', material: 'Repaso', material_codigo: null,
        amalgama_1_g: 5.74, oro_recuperado_g: 2.40, merma_1_pct: 58.18, sacos: 39, toneladas_procesadas: 1.95, tenor_tonelada_gpt: 1.23, tenor_saco_gps: 0.0615
      }
    ]
  },
  // 25/09/2026 - Total: 20.18 g Au
  {
    fecha: '2026-09-25',
    totalTurnoWhatsApp: 20.18,
    entries: [
      {
        fecha: '2026-09-25', turno: 'noche', molino: 'Molinos 02 y 03', material: 'Material Primario', material_codigo: 'V2D60',
        amalgama_1_g: 35.92, oro_recuperado_g: 16.60, merma_1_pct: 53.78, sacos: 100.2, toneladas_procesadas: 5.01, tenor_tonelada_gpt: 3.31, tenor_saco_gps: 0.16
      },
      {
        fecha: '2026-09-25', turno: 'noche', molino: 'Mantenimiento', material: 'Varios', material_codigo: null,
        amalgama_1_g: 1.28, oro_recuperado_g: 0.60, merma_1_pct: 53.13, sacos: 0, toneladas_procesadas: null, tenor_tonelada_gpt: null, tenor_saco_gps: null
      },
      {
        fecha: '2026-09-25', turno: 'noche', molino: 'Molino Continuo', material: 'Repaso', material_codigo: null,
        amalgama_1_g: 6.99, oro_recuperado_g: 2.98, merma_1_pct: 57.36, sacos: 36, toneladas_procesadas: 1.80, tenor_tonelada_gpt: 1.65, tenor_saco_gps: 0.0828
      }
    ]
  },
  // 26/09/2026 - Total: 31.80 g Au
  {
    fecha: '2026-09-26',
    totalTurnoWhatsApp: 31.80,
    entries: [
      {
        fecha: '2026-09-26', turno: 'noche', molino: 'Molinos 02 y 03', material: 'Material Primario', material_codigo: 'V1D54',
        amalgama_1_g: 51.03, oro_recuperado_g: 26.60, merma_1_pct: 47.87, sacos: 108, toneladas_procesadas: 5.40, tenor_tonelada_gpt: 4.92, tenor_saco_gps: 0.24
      },
      {
        fecha: '2026-09-26', turno: 'noche', molino: 'Mantenimiento', material: 'Varios', material_codigo: null,
        amalgama_1_g: 3.01, oro_recuperado_g: 1.70, merma_1_pct: 43.52, sacos: 0, toneladas_procesadas: null, tenor_tonelada_gpt: null, tenor_saco_gps: null
      },
      {
        fecha: '2026-09-26', turno: 'noche', molino: 'Molino Continuo', material: 'Repaso', material_codigo: null,
        amalgama_1_g: 8.00, oro_recuperado_g: 3.50, merma_1_pct: 56.25, sacos: 39, toneladas_procesadas: 1.95, tenor_tonelada_gpt: 1.79, tenor_saco_gps: 0.0897
      }
    ]
  },
  // 27/09/2026 - Total: 27.07 g Au
  {
    fecha: '2026-09-27',
    totalTurnoWhatsApp: 27.07,
    entries: [
      {
        fecha: '2026-09-27', turno: 'noche', molino: 'Molinos 02 y 03', material: 'Material Primario', material_codigo: 'V1D54',
        amalgama_1_g: 41.69, oro_recuperado_g: 21.80, merma_1_pct: 47.70, sacos: 96, toneladas_procesadas: 4.80, tenor_tonelada_gpt: 4.54, tenor_saco_gps: 0.22
      },
      {
        fecha: '2026-09-27', turno: 'noche', molino: 'Mantenimiento', material: 'Varios', material_codigo: null,
        amalgama_1_g: 3.85, oro_recuperado_g: 1.98, merma_1_pct: 48.57, sacos: 0, toneladas_procesadas: null, tenor_tonelada_gpt: null, tenor_saco_gps: null
      },
      {
        fecha: '2026-09-27', turno: 'noche', molino: 'Molino Continuo', material: 'Repaso', material_codigo: null,
        amalgama_1_g: 7.00, oro_recuperado_g: 3.29, merma_1_pct: 53.00, sacos: 39, toneladas_procesadas: 1.95, tenor_tonelada_gpt: 1.68, tenor_saco_gps: 0.0844
      }
    ]
  },
  // 28/09/2026 - Total: 11.62 g Au
  {
    fecha: '2026-09-28',
    totalTurnoWhatsApp: 11.62,
    entries: [
      {
        fecha: '2026-09-28', turno: 'noche', molino: 'Molino 3', material: 'Material Primario', material_codigo: 'V1D53',
        amalgama_1_g: 13.41, oro_recuperado_g: 6.44, merma_1_pct: 51.97, sacos: 48, toneladas_procesadas: 2.40, tenor_tonelada_gpt: 2.68, tenor_saco_gps: 0.13,
        observaciones: 'Reporte WA indicó 6,55g pero tenor 2,68g/t y cierre 11,62g cuadran con 6,44g'
      },
      {
        fecha: '2026-09-28', turno: 'noche', molino: 'Molino 2', material: 'Repaso', material_codigo: null,
        amalgama_1_g: 7.00, oro_recuperado_g: 3.24, merma_1_pct: 53.71, sacos: 69, toneladas_procesadas: 3.45, tenor_tonelada_gpt: 0.93, tenor_saco_gps: 0.0469
      },
      {
        fecha: '2026-09-28', turno: 'noche', molino: 'Mantenimiento', material: 'Varios', material_codigo: null,
        amalgama_1_g: 0.13, oro_recuperado_g: 0.10, merma_1_pct: 23.08, sacos: 0, toneladas_procesadas: null, tenor_tonelada_gpt: null, tenor_saco_gps: null
      },
      {
        fecha: '2026-09-28', turno: 'noche', molino: 'Molino Continuo', material: 'Repaso', material_codigo: null,
        amalgama_1_g: 4.01, oro_recuperado_g: 1.84, merma_1_pct: 54.00, sacos: 36, toneladas_procesadas: 1.80, tenor_tonelada_gpt: 1.02, tenor_saco_gps: 0.0511
      }
    ]
  },
  // 29/09/2026 - Total: 23.97 g Au
  {
    fecha: '2026-09-29',
    totalTurnoWhatsApp: 23.97,
    entries: [
      {
        fecha: '2026-09-29', turno: 'noche', molino: 'Molinos 02 y 03', material: 'Material Primario', material_codigo: 'V2D61',
        amalgama_1_g: 37.17, oro_recuperado_g: 16.65, merma_1_pct: 55.20, sacos: 105, toneladas_procesadas: 5.25, tenor_tonelada_gpt: 3.17, tenor_saco_gps: 0.15
      },
      {
        fecha: '2026-09-29', turno: 'noche', molino: 'Planchas', material: 'Plancha 2', material_codigo: null,
        amalgama_1_g: 10.99, oro_recuperado_g: 4.00, merma_1_pct: 63.60, sacos: 0, toneladas_procesadas: null, tenor_tonelada_gpt: null, tenor_saco_gps: null,
        observaciones: '2da plancha'
      },
      {
        fecha: '2026-09-29', turno: 'noche', molino: 'Mantenimiento', material: 'Varios', material_codigo: null,
        amalgama_1_g: 1.89, oro_recuperado_g: 0.82, merma_1_pct: 56.61, sacos: 0, toneladas_procesadas: null, tenor_tonelada_gpt: null, tenor_saco_gps: null
      },
      {
        fecha: '2026-09-29', turno: 'noche', molino: 'Molino Continuo', material: 'Repaso', material_codigo: null,
        amalgama_1_g: 5.80, oro_recuperado_g: 2.50, merma_1_pct: 56.89, sacos: 39, toneladas_procesadas: 1.95, tenor_tonelada_gpt: 1.28, tenor_saco_gps: 0.0641
      }
    ]
  },
  // 30/09/2026 - Total: 12.07 g Au
  {
    fecha: '2026-09-30',
    totalTurnoWhatsApp: 12.07,
    entries: [
      {
        fecha: '2026-09-30', turno: 'noche', molino: 'Molinos 02 y 03', material: 'Material Mixto', material_codigo: null,
        amalgama_1_g: 20.12, oro_recuperado_g: 9.49, merma_1_pct: 52.83, sacos: 84, toneladas_procesadas: 4.20, tenor_tonelada_gpt: 2.25, tenor_saco_gps: 0.11,
        observaciones: 'Ajustado: WA copió 16.65g de fecha anterior; cálculo real por merma 52.83% y tenor 2.25g/t es 9.49g'
      },
      {
        fecha: '2026-09-30', turno: 'noche', molino: 'Mantenimiento', material: 'Varios', material_codigo: null,
        amalgama_1_g: 1.11, oro_recuperado_g: 0.58, merma_1_pct: 47.75, sacos: 0, toneladas_procesadas: null, tenor_tonelada_gpt: null, tenor_saco_gps: null
      },
      {
        fecha: '2026-09-30', turno: 'noche', molino: 'Molino Continuo', material: 'Repaso', material_codigo: null,
        amalgama_1_g: 4.54, oro_recuperado_g: 2.00, merma_1_pct: 54.94, sacos: 30, toneladas_procesadas: 1.50, tenor_tonelada_gpt: 1.30, tenor_saco_gps: 0.0667
      }
    ]
  }
];

export const COMPLEX_LA_FE_ID = '86ef53c0-25d4-499e-9691-e572693cda74';
export const REGISTRADOR_ID = '9501cd47-455c-4db7-a630-09fe5e53c46f';

/** Genera la lista plana de filas con IDs y timestamps para ReporteProduccion */
export function getSeptiembre2026Reportes(): ReporteProduccion[] {
  const rows: ReporteProduccion[] = [];
  let index = 1;

  for (const day of SEPTIEMBRE_2026_DATA) {
    for (const e of day.entries) {
      const pseudoId = `sep2026-prod-${e.fecha}-${index++}`;
      rows.push({
        id: pseudoId,
        fecha: e.fecha,
        turno: e.turno,
        molino: e.molino,
        material: e.material,
        material_codigo: e.material_codigo || undefined,
        amalgama_1_g: e.amalgama_1_g,
        oro_recuperado_g: e.oro_recuperado_g,
        merma_1_pct: e.merma_1_pct || undefined,
        sacos: e.sacos,
        toneladas_procesadas: e.toneladas_procesadas || undefined,
        tenor_tonelada_gpt: e.tenor_tonelada_gpt || undefined,
        tenor_saco_gps: e.tenor_saco_gps || undefined,
        observaciones: e.observaciones || undefined,
        registrado_por: REGISTRADOR_ID,
        created_at: `${e.fecha}T06:00:00.000Z`,
        updated_at: `${e.fecha}T06:00:00.000Z`,
      });
    }
  }

  return rows;
}
