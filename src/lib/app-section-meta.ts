import type { LucideIcon } from 'lucide-react';
import {
  CircleDollarSign,
  Beaker,
  BookOpen,
  Calculator,
  ClipboardList,
  Database,
  Flame,
  Library,
  FlaskConical,
  Factory,
  HardHat,
  Layers,
  LayoutGrid,
  Package,
  Pickaxe,
  ShieldCheck,
  ShoppingCart,
  TrendingDown,
  Users,
  Wrench,
  Zap,
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
    Icon: LayoutGrid,
    iconClassName: 'text-[var(--dashboard-accent)]',
    titleClassName: 'text-[var(--dashboard-accent)]',
  },
  '/reportes-balances': {
    title: 'Reporte y Balances',
    description: 'Vista macro y micro para cotejar indicadores operativos.',
    Icon: CircleDollarSign,
    iconClassName: 'text-[var(--dashboard-accent)]',
    titleClassName: 'text-[var(--dashboard-accent)]',
  },
  '/admin/gastos': {
    title: 'Gastos Operativos',
    description: 'Control de egresos y costos operacionales.',
    Icon: TrendingDown,
    iconClassName: 'text-red-400',
  },
  '/admin/trabajadores': {
    title: 'Base de Trabajadores',
    description: 'Registro maestro de personal para automatizar asignaciones de nómina.',
    Icon: Users,
    iconClassName: 'text-amber-400',
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
  '/plataforma/datos-fiscales': {
    title: 'Datos Fiscales',
    description: 'Parámetros fiscales y tributarios de la operación.',
    Icon: Database,
    iconClassName: 'text-violet-400',
  },
  '/plataforma/biblioteca-variables': {
    title: 'Biblioteca de Variables',
    description: 'Catálogo central de parámetros reutilizables para toda la plataforma.',
    Icon: Library,
    iconClassName: 'text-violet-400',
  },
  '/plataforma/diccionario-variables': {
    title: 'Biblioteca de Variables',
    description: 'Catálogo central de parámetros reutilizables para toda la plataforma.',
    Icon: Library,
    iconClassName: 'text-violet-400',
  },
};

export function getAppSectionMeta(pathname: string): AppSectionMeta | null {
  return SECTION_BY_PATH[pathname] ?? null;
}
