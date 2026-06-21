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
  balancePlancha1: number;
  balancesPlanchas: { id: string; label: string; grams: number }[];
  // ── Mining Supervisor ──
  sacosExtraidosHoy?: number;
  sacosExtraidosPeriodo?: number;
  extraccionesPeriodo?: number;
  voladurasPeriodo?: number;
  voladurasConNovedad?: number;
  equiposOperativos?: number;
  miningVerticales?: { name: string; sacos: number }[];
  miningMinas?: { name: string; voladuras: number; sinNovedad: boolean }[];
  // ── Mill Supervisor ──
  oroQuemadoPeriodo?: number;
  cargaAcarreadaPeriodo?: number;
  acarreosPeriodo?: number;
  produccionesPeriodo?: number;
  planchasBreakdown?: { id: string; label: string; oro: number; amalgama: number }[];
}
