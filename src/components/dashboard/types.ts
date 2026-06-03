export interface LocationData {
  id: string;
  name: string;
  type: 'molino' | 'mina';
  coordinates: { x: number; y: number };
  status: 'Activo' | 'Mantenimiento' | 'Inactivo';
  kpis: { produccion: number; tenor: number; merma: number };
  materiales?: string[];
  origenes?: string[];
}

import type { DashboardAlert } from '@/lib/dashboard-alerts';

export type { DashboardAlert };

export interface GlobalData {
  totalGrams: number;
  eqTotal: number;
  todayExpenses: number;
  monthlyExpenses: number;
  criticalInventory: number;
  activePersonnel: number;
  produccionMensual: number;
  oroTotalRecuperado: number;
}
