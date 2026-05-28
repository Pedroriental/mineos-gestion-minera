import type { LucideIcon } from 'lucide-react';
import {
  Beaker,
  BookOpen,
  Calculator,
  ClipboardList,
  Flame,
  FlaskConical,
  Factory,
  HardHat,
  Layers,
  LayoutDashboard,
  Package,
  Pickaxe,
  ShieldCheck,
  ShoppingCart,
  TrendingDown,
  Users,
  Wrench,
  Zap,
  FileText,
} from 'lucide-react';

export type AppSectionMeta = {
  title: string;
  description: string;
  Icon: LucideIcon;
  /** Color del ícono (clases Tailwind de la sección original) */
  iconClassName: string;
  /** Color del título; por defecto texto principal */
  titleClassName?: string;
};

/** Título y descripción del topbar por ruta (todas las secciones de la app). */
const SECTION_BY_PATH: Record<string, AppSectionMeta> = {
  '/dashboard': {
    title: 'Dashboard',
    description: 'Monitoreo, métricas y estados en tiempo real.',
    Icon: LayoutDashboard,
    iconClassName: 'text-[var(--dashboard-accent)]',
    titleClassName: 'text-[var(--dashboard-accent)]',
  },
  '/admin/gastos': {
    title: 'Gastos Operativos',
    description: 'Control de egresos y costos operacionales.',
    Icon: TrendingDown,
    iconClassName: 'text-red-400',
  },
  '/admin/inventario': {
    title: 'Inventario',
    description: 'Stock, mínimos y movimientos de insumos.',
    Icon: Package,
    iconClassName: 'text-amber-400',
  },
  '/admin/compras': {
    title: 'Compras',
    description: 'Órdenes y compras programadas.',
    Icon: ShoppingCart,
    iconClassName: 'text-amber-400',
  },
  '/admin/nomina': {
    title: 'Nómina Administrativa',
    description: 'Personal y pagos del área administración.',
    Icon: Users,
    iconClassName: 'text-amber-400',
  },
  '/mina/nomina': {
    title: 'Nómina Mina',
    description: 'Personal activo y cierres semanales de mina.',
    Icon: Users,
    iconClassName: 'text-amber-400',
  },
  '/planta/nomina': {
    title: 'Nómina Molinos',
    description: 'Personal activo y cierres semanales de planta.',
    Icon: Users,
    iconClassName: 'text-amber-400',
  },
  '/mina/voladuras': {
    title: 'Voladuras',
    description: 'Registro y seguimiento de voladuras en mina.',
    Icon: Zap,
    iconClassName: 'text-amber-400',
  },
  '/mina/extraccion': {
    title: 'Extracción',
    description: 'Sacos, disparos y eventos de extracción.',
    Icon: HardHat,
    iconClassName: 'text-amber-400',
  },
  '/mina/equipos': {
    title: 'Equipos',
    description: 'Flota y estado de equipos de mina.',
    Icon: Wrench,
    iconClassName: 'text-amber-400',
  },
  '/mina/seguridad': {
    title: 'Seguridad',
    description: 'Incidentes y registros de seguridad.',
    Icon: ShieldCheck,
    iconClassName: 'text-amber-400',
  },
  '/mina/disparos': {
    title: 'Disparos',
    description: 'Control de disparos y explosivos.',
    Icon: Pickaxe,
    iconClassName: 'text-amber-400',
  },
  '/mina/quemado': {
    title: 'Quemado de Planchas',
    description: 'Quemadas, amalgama y oro recuperado.',
    Icon: Flame,
    iconClassName: 'text-orange-400',
  },
  '/planta/produccion': {
    title: 'Producción',
    description: 'Reportes de molinos y recuperación de oro.',
    Icon: Factory,
    iconClassName: 'text-amber-500',
  },
  '/planta/recepcion': {
    title: 'Recepción',
    description: 'Ingreso de material a planta.',
    Icon: Layers,
    iconClassName: 'text-amber-400',
  },
  '/planta/procesamiento': {
    title: 'Procesamiento',
    description: 'Proceso y rendimiento de planta.',
    Icon: Factory,
    iconClassName: 'text-amber-700',
  },
  '/planta/arenas': {
    title: 'Arenas',
    description: 'Ventas y movimiento de arenas.',
    Icon: FlaskConical,
    iconClassName: 'text-amber-400',
  },
  '/operaciones/resumen': {
    title: 'Resumen Ejecutivo',
    description: 'Rentabilidad y visión consolidada del periodo.',
    Icon: BookOpen,
    iconClassName: 'text-amber-400',
  },
  '/operaciones/guardia': {
    title: 'Libro de Guardia',
    description: 'Bitácora operativa y novedades.',
    Icon: ClipboardList,
    iconClassName: 'text-purple-400',
  },
  '/operaciones/leyes': {
    title: 'Control de Leyes',
    description: 'Balance metalúrgico y leyes de cabeza.',
    Icon: Beaker,
    iconClassName: 'text-teal-400',
  },
  '/operaciones/costos': {
    title: 'Costo por Gramo',
    description: 'Costos, precio del oro y rentabilidad.',
    Icon: Calculator,
    iconClassName: 'text-emerald-400',
  },
  '/operaciones/reportes': {
    title: 'Centro de Reportes y Balances',
    description: 'Consolida y descarga reportes de toda tu operación minera.',
    Icon: FileText,
    iconClassName: 'text-amber-500',
  },
};

export function getAppSectionMeta(pathname: string): AppSectionMeta | null {
  return SECTION_BY_PATH[pathname] ?? null;
}
