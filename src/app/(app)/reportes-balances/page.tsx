import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  Factory,
  HardHat,
  LayoutGrid,
  Receipt,
  Users,
} from 'lucide-react';

const MODULE_LINKS = [
  {
    title: 'Dashboard General',
    description: 'Estado operativo en tiempo real con alertas y nodos de operación.',
    href: '/dashboard',
    Icon: LayoutGrid,
  },
  {
    title: 'Resumen Ejecutivo',
    description: 'Lectura macro de rentabilidad, producción y costo por gramo.',
    href: '/operaciones/resumen',
    Icon: BookOpen,
  },
  {
    title: 'Producción Molinos',
    description: 'Detalle micro por molino, recuperación y rendimiento diario.',
    href: '/planta/produccion',
    Icon: Factory,
  },
  {
    title: 'Extracción Mina',
    description: 'Seguimiento de sacos, disparos y eventos por frente de mina.',
    href: '/mina/extraccion',
    Icon: HardHat,
  },
  {
    title: 'Gastos e Inventario',
    description: 'Cruce operativo entre costos, compras y stock de insumos.',
    href: '/admin/gastos',
    Icon: Receipt,
  },
  {
    title: 'Nóminas',
    description: 'Comparación de cierre semanal y carga laboral por área.',
    href: '/planta/nomina',
    Icon: Users,
  },
];

export default function ReportesBalancesPage() {
  return (
    <div className="dashboard-shell flex min-h-0 w-full flex-1 flex-col gap-4">
      <section className="card-glass rounded-2xl border border-white/[0.08] p-5 sm:p-6">
        <h1 className="text-xl font-black tracking-tight text-white sm:text-2xl">
          Reporte y Balances
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-white/60">
          Punto de control para comparar indicadores macro y micro de la operación,
          usando los módulos ya activos en la plataforma.
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {MODULE_LINKS.map(({ title, description, href, Icon }) => (
          <Link
            key={href}
            href={href}
            className="card-glass group rounded-xl border border-white/[0.08] p-4 transition-colors hover:border-amber-500/40 hover:bg-white/[0.03]"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-400">
                <Icon className="h-4 w-4" />
              </span>
              <ArrowRight className="h-4 w-4 text-white/30 transition-colors group-hover:text-amber-400" />
            </div>
            <h2 className="text-sm font-bold text-white">{title}</h2>
            <p className="mt-1 text-xs leading-relaxed text-white/55">{description}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
