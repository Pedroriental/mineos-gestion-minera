import type { ReactNode } from 'react';
import {
  Beaker,
  Users,
  Zap,
  Flame,
  HardHat,
  Receipt,
  Calculator,
  Scale,
  FileSearch,
} from 'lucide-react';
import type { ReportModule } from '@/lib/reports/report-types';

export const REPORTES_TABS: Array<{
  id: ReportModule;
  label: string;
  icon: ReactNode;
}> = [
  { id: 'reconciliacion', label: 'Reconciliación', icon: <Scale className="w-4 h-4" /> },
  { id: 'produccion', label: 'Producción', icon: <Beaker className="w-4 h-4" /> },
  { id: 'nomina', label: 'Nómina', icon: <Users className="w-4 h-4" /> },
  { id: 'voladuras', label: 'Voladuras', icon: <Zap className="w-4 h-4" /> },
  { id: 'quemado', label: 'Quemado', icon: <Flame className="w-4 h-4" /> },
  { id: 'extraccion', label: 'Extracción', icon: <HardHat className="w-4 h-4" /> },
  { id: 'gastos', label: 'Gastos', icon: <Receipt className="w-4 h-4" /> },
  { id: 'balance', label: 'Balance', icon: <Calculator className="w-4 h-4" /> },
];
