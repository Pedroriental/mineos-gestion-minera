/**
 * Datos históricos y facturas consolidadas de Agosto 2026 ($82.477,75).
 * Fuente de verdad para el cálculo de compensación de gastos de mina
 * (60% Los Riascos / 40% La Fé) y fallback robusto para reportes y PDFs.
 */

import { DEFAULT_EMPRESAS_INVERSORAS, type CompensacionEmpresa, type GastoParaCompensacion } from '@/lib/compensacion-gastos';
import type { GastoEmpresa, GastosEmpresaResumen, GastoCompartidoDetalle } from '@/lib/actions/compensacion-gastos';
import type { Gasto } from '@/lib/types';

export interface Agosto2026ItemRaw {
  fecha: string;
  categoriaNombre: string;
  descripcion: string;
  monto: number;
  proveedor: string;
  pagos: Array<{ pagador: 'riasco' | 'fe'; monto_pagado: number; porcentaje: number }>;
}

export const RAW_AGOSTO_2026_ITEMS: Agosto2026ItemRaw[] = [
  // =========================================================================
  // 1. VOLADURAS (EXP Y BARRE) - Total: $26.914,95 (Los Riascos: $16.760,97 | La Fé: $10.153,98)
  // =========================================================================
  {
    fecha: '2026-08-04',
    categoriaNombre: 'Voladuras (Exp y Barre)',
    descripcion: '50 Eléctricos',
    monto: 1530.00,
    proveedor: 'Proveedor Local',
    pagos: [{ pagador: 'riasco', monto_pagado: 1530.00, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-12',
    categoriaNombre: 'Voladuras (Exp y Barre)',
    descripcion: 'Explosivos MIDME',
    monto: 25384.95,
    proveedor: 'MIDME',
    pagos: [
      { pagador: 'riasco', monto_pagado: 15230.97, porcentaje: 60 },
      { pagador: 'fe', monto_pagado: 10153.98, porcentaje: 40 },
    ],
  },

  // =========================================================================
  // 2. COMIDA EN MINA - Total: $5.086,41 (Los Riascos: $4.337,61 | La Fé: $748,80)
  // =========================================================================
  {
    fecha: '2026-08-18',
    categoriaNombre: 'Comida en Mina',
    descripcion: 'Mercado Mina (40% La Fé)',
    monto: 748.80,
    proveedor: 'Mercado Local',
    pagos: [{ pagador: 'fe', monto_pagado: 748.80, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-18',
    categoriaNombre: 'Comida en Mina',
    descripcion: 'Compras Víveres y Alimentos Mina',
    monto: 4337.61,
    proveedor: 'Comercializadora Plaza Éxito C.A.',
    pagos: [{ pagador: 'riasco', monto_pagado: 4337.61, porcentaje: 100 }],
  },

  // =========================================================================
  // 3. NÓMINA EN MINA - Total: $26.733,33 (Los Riascos: $16.040,00 | La Fé: $10.693,33)
  // =========================================================================
  {
    fecha: '2026-08-02',
    categoriaNombre: 'Nómina en Mina',
    descripcion: 'Nómina Mina Semana 1 (Día 2)',
    monto: 6200.00,
    proveedor: 'Nómina Mina',
    pagos: [
      { pagador: 'riasco', monto_pagado: 3720.00, porcentaje: 60 },
      { pagador: 'fe', monto_pagado: 2480.00, porcentaje: 40 },
    ],
  },
  {
    fecha: '2026-08-09',
    categoriaNombre: 'Nómina en Mina',
    descripcion: 'Nómina Mina Semana 2 (Día 9)',
    monto: 5200.00,
    proveedor: 'Nómina Mina',
    pagos: [
      { pagador: 'riasco', monto_pagado: 3120.00, porcentaje: 60 },
      { pagador: 'fe', monto_pagado: 2080.00, porcentaje: 40 },
    ],
  },
  {
    fecha: '2026-08-16',
    categoriaNombre: 'Nómina en Mina',
    descripcion: 'Nómina Mina Semana 3 (Día 16)',
    monto: 5466.67,
    proveedor: 'Nómina Mina',
    pagos: [
      { pagador: 'riasco', monto_pagado: 3280.00, porcentaje: 60 },
      { pagador: 'fe', monto_pagado: 2186.67, porcentaje: 40 },
    ],
  },
  {
    fecha: '2026-08-23',
    categoriaNombre: 'Nómina en Mina',
    descripcion: 'Nómina Mina Semana 4 (Día 23)',
    monto: 4666.66,
    proveedor: 'Nómina Mina',
    pagos: [
      { pagador: 'riasco', monto_pagado: 2800.00, porcentaje: 60 },
      { pagador: 'fe', monto_pagado: 1866.66, porcentaje: 40 },
    ],
  },
  {
    fecha: '2026-08-30',
    categoriaNombre: 'Nómina en Mina',
    descripcion: 'Nómina Mina Semana 5 (Día 30)',
    monto: 5200.00,
    proveedor: 'Nómina Mina',
    pagos: [
      { pagador: 'riasco', monto_pagado: 3120.00, porcentaje: 60 },
      { pagador: 'fe', monto_pagado: 2080.00, porcentaje: 40 },
    ],
  },

  // =========================================================================
  // 4. OPERACIONES DE MINA: PAGOS DIRECTOS DE LA FÉ - Total: $8.296,68
  // =========================================================================
  {
    fecha: '2026-08-05',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: 'Sacos y Brocas',
    monto: 1805.48,
    proveedor: 'La Fé',
    pagos: [{ pagador: 'fe', monto_pagado: 1805.48, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-12',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: '40% Instalación de Camaras',
    monto: 941.20,
    proveedor: 'Proveedor Local',
    pagos: [{ pagador: 'fe', monto_pagado: 941.20, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-19',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: '2000 Sacos',
    monto: 800.00,
    proveedor: 'Molina Group C.A.',
    pagos: [{ pagador: 'fe', monto_pagado: 800.00, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-28',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: 'Winche y 10 Brocas',
    monto: 1950.00,
    proveedor: 'Oxyfast, C.A.',
    pagos: [{ pagador: 'fe', monto_pagado: 1950.00, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-28',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: 'Motosierra',
    monto: 1600.00,
    proveedor: 'Ferretería Local',
    pagos: [{ pagador: 'fe', monto_pagado: 1600.00, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-31',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: '1000L Diesel',
    monto: 1200.00,
    proveedor: 'Distribuidor Combustible',
    pagos: [{ pagador: 'fe', monto_pagado: 1200.00, porcentaje: 100 }],
  },

  // =========================================================================
  // 5. OPERACIONES DE MINA: 78 REGISTROS DETALLADOS (LOS RIASCOS: $15.446,38)
  // =========================================================================
  {
    fecha: '2026-08-01',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: 'Bronce Rosca de Jakle',
    monto: 90.79,
    proveedor: 'Distribuidora JADIL, C.A.',
    pagos: [{ pagador: 'riasco', monto_pagado: 90.79, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-01',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: 'Instalación de Transformador',
    monto: 200.00,
    proveedor: 'Mano de Obra Local',
    pagos: [{ pagador: 'riasco', monto_pagado: 200.00, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-03',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: 'Tapara Plastica',
    monto: 50.00,
    proveedor: 'Repuestos Automotriz y Motos J.J., C.A.',
    pagos: [{ pagador: 'riasco', monto_pagado: 50.00, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-03',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: 'Resorte Cónico, Kit de Aguja Yakle',
    monto: 200.79,
    proveedor: 'Ferreinsumos Peniel',
    pagos: [{ pagador: 'riasco', monto_pagado: 200.79, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-03',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: 'Semana Libre Compresorista',
    monto: 100.00,
    proveedor: 'Compresorista',
    pagos: [{ pagador: 'riasco', monto_pagado: 100.00, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-03',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: '90 L de Gasoil',
    monto: 150.00,
    proveedor: 'Kapelli',
    pagos: [{ pagador: 'riasco', monto_pagado: 150.00, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-04',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: '400 Sacos, Tubos, teipes, T',
    monto: 280.00,
    proveedor: 'Oxyfast, C.A.',
    pagos: [{ pagador: 'riasco', monto_pagado: 280.00, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-04',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: 'Repuestos de Compresor',
    monto: 409.00,
    proveedor: 'Guajiro',
    pagos: [{ pagador: 'riasco', monto_pagado: 409.00, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-05',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: '2 Taparas Plasticas',
    monto: 100.00,
    proveedor: 'Repuestos Automotriz y Motos J.J., C.A.',
    pagos: [{ pagador: 'riasco', monto_pagado: 100.00, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-05',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: '2000 Sacos, Martillo eléctric, Brocas, Guantes',
    monto: 1376.00,
    proveedor: 'Oxyfast, C.A.',
    pagos: [{ pagador: 'riasco', monto_pagado: 1376.00, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-05',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: 'Rodamientos y sellos',
    monto: 22.00,
    proveedor: 'Tornillos y Rodamientos Ochoa C.A.',
    pagos: [{ pagador: 'riasco', monto_pagado: 22.00, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-05',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: 'Filtro de Aire, Refrigerante, Desengrasante (Compresor)',
    monto: 120.00,
    proveedor: 'Servicentro Oleosur, C.A',
    pagos: [{ pagador: 'riasco', monto_pagado: 120.00, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-06',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: '9 L Aceite 2 Tiemps, Vert 4, Herramientas menores',
    monto: 300.00,
    proveedor: 'Jesika',
    pagos: [{ pagador: 'riasco', monto_pagado: 300.00, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-06',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: 'Bronce P/Jakled',
    monto: 89.96,
    proveedor: 'Distribuidora JADIL, C.A.',
    pagos: [{ pagador: 'riasco', monto_pagado: 89.96, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-06',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: 'Compresor, Filtro de Aceite, Aceite Sae 50, Aceite 60, Serv',
    monto: 193.00,
    proveedor: 'Distribuidora Orinoco 2017, C.A.',
    pagos: [{ pagador: 'riasco', monto_pagado: 193.00, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-06',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: 'Manguera 1 1/2" 2500 PSI, Ferrules',
    monto: 200.00,
    proveedor: 'Servitec Torres, C.A.',
    pagos: [{ pagador: 'riasco', monto_pagado: 200.00, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-06',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: 'Radios Transmisores',
    monto: 100.00,
    proveedor: 'Tecno Tienda MI',
    pagos: [{ pagador: 'riasco', monto_pagado: 100.00, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-08',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: 'Pago Parcial de Combustible (Aceite Quemado y Gasolina)',
    monto: 300.00,
    proveedor: 'Kapelli',
    pagos: [{ pagador: 'riasco', monto_pagado: 300.00, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-08',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: 'Pago Tio Ramón',
    monto: 100.00,
    proveedor: 'Tio Ramón GuaJiro',
    pagos: [{ pagador: 'riasco', monto_pagado: 100.00, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-09',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: 'Nylon y Acite 2T',
    monto: 30.00,
    proveedor: 'Proveedor Local',
    pagos: [{ pagador: 'riasco', monto_pagado: 30.00, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-11',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: '1000 Sacos',
    monto: 400.00,
    proveedor: 'Molina Group C.A.',
    pagos: [{ pagador: 'riasco', monto_pagado: 400.00, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-12',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: 'Logistica Para Mercado de Exp',
    monto: 50.00,
    proveedor: 'Proveedor',
    pagos: [{ pagador: 'riasco', monto_pagado: 50.00, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-12',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: 'Repuesto de Compresor',
    monto: 20.00,
    proveedor: 'Proveedor Local',
    pagos: [{ pagador: 'riasco', monto_pagado: 20.00, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-12',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: 'Instalación de Camaras (60% Los Riasco)',
    monto: 1411.80,
    proveedor: 'Proveedor Local',
    pagos: [{ pagador: 'riasco', monto_pagado: 1411.80, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-13',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: 'Teipe de Embalar',
    monto: 6.25,
    proveedor: 'Proveedor Local',
    pagos: [{ pagador: 'riasco', monto_pagado: 6.25, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-13',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: 'Nylon',
    monto: 3.75,
    proveedor: 'Proveedor Local',
    pagos: [{ pagador: 'riasco', monto_pagado: 3.75, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-14',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: 'Barra roscada 1/2, Tuercas, Arandelas',
    monto: 19.86,
    proveedor: 'Ferremateriales El Eden C.A.',
    pagos: [{ pagador: 'riasco', monto_pagado: 19.86, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-14',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: 'Mecha Cobalto 1/2 Trupper',
    monto: 23.00,
    proveedor: 'Ferremateriales Nueva Providencia C.A.',
    pagos: [{ pagador: 'riasco', monto_pagado: 23.00, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-14',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: 'Tubo 2", Teipe, Cabilla lisa, Electrodo, Disco de Corte y esmer.',
    monto: 469.08,
    proveedor: 'Ferremateriales Nueva Providencia C.A.',
    pagos: [{ pagador: 'riasco', monto_pagado: 469.08, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-15',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: 'Teipe Para Embalar',
    monto: 6.00,
    proveedor: 'Proveedor Local',
    pagos: [{ pagador: 'riasco', monto_pagado: 6.00, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-15',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: 'Gastos médicos Cocinera',
    monto: 50.00,
    proveedor: 'Farmacia',
    pagos: [{ pagador: 'riasco', monto_pagado: 50.00, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-15',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: '1000 Sacos',
    monto: 400.00,
    proveedor: 'Molina Group C.A.',
    pagos: [{ pagador: 'riasco', monto_pagado: 400.00, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-15',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: '2 Cajas Pega Tanque',
    monto: 96.00,
    proveedor: 'Distribuidora Panama Import C.A.',
    pagos: [{ pagador: 'riasco', monto_pagado: 96.00, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-15',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: '2 Broca Nro. 38',
    monto: 110.00,
    proveedor: 'Molina Group C.A.',
    pagos: [{ pagador: 'riasco', monto_pagado: 110.00, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-17',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: 'Semana Libre del Chino',
    monto: 125.00,
    proveedor: 'Chino',
    pagos: [{ pagador: 'riasco', monto_pagado: 125.00, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-17',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: 'Pago de 140 Litros de Gasoil',
    monto: 200.00,
    proveedor: 'Kapelli',
    pagos: [{ pagador: 'riasco', monto_pagado: 200.00, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-17',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: 'Rolineras; Sellos',
    monto: 126.00,
    proveedor: 'Tornillos y Rodamientos Ochoa C.A.',
    pagos: [{ pagador: 'riasco', monto_pagado: 126.00, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-17',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: 'Broca, Tubo 4", Codo, Teipe',
    monto: 310.00,
    proveedor: 'Oxyfast, C.A.',
    pagos: [{ pagador: 'riasco', monto_pagado: 310.00, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-18',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: 'Valvula Chek 2", Niple 2x5, Mecate 3/4',
    monto: 100.00,
    proveedor: 'Corporación Laestrella del Oro, C.A.',
    pagos: [{ pagador: 'riasco', monto_pagado: 100.00, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-18',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: 'Barril Plastico',
    monto: 150.02,
    proveedor: 'Maxixos Group C.A.',
    pagos: [{ pagador: 'riasco', monto_pagado: 150.02, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-19',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: 'Pago de Gasoil',
    monto: 140.00,
    proveedor: 'Kapelli',
    pagos: [{ pagador: 'riasco', monto_pagado: 140.00, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-19',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: 'Pagos de Compras urgentes en bodega, aceites 2T, Pullas, Etc',
    monto: 160.00,
    proveedor: 'Jesika',
    pagos: [{ pagador: 'riasco', monto_pagado: 160.00, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-19',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: 'Cilindros de Gas',
    monto: 70.00,
    proveedor: 'Kapelli',
    pagos: [{ pagador: 'riasco', monto_pagado: 70.00, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-19',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: 'Guantes, Pega',
    monto: 35.00,
    proveedor: 'Oxyfast, C.A.',
    pagos: [{ pagador: 'riasco', monto_pagado: 35.00, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-19',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: '10 Tirro Transparentes',
    monto: 90.00,
    proveedor: 'Distribuidora Panama Import C.A.',
    pagos: [{ pagador: 'riasco', monto_pagado: 90.00, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-20',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: 'Paila Aceite SAE50, Caja Aceite Inca 2T',
    monto: 265.00,
    proveedor: 'Distribuidora Orinoco 2017, C.A.',
    pagos: [{ pagador: 'riasco', monto_pagado: 265.00, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-20',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: 'Caja Vainilla, Suavitel',
    monto: 102.00,
    proveedor: 'Comercializadora Plaza Éxito C.A.',
    pagos: [{ pagador: 'riasco', monto_pagado: 102.00, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-20',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: 'Sellos Mecanicos',
    monto: 35.00,
    proveedor: 'Tornillos y Rodamientos Ochoa C.A.',
    pagos: [{ pagador: 'riasco', monto_pagado: 35.00, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-20',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: '3kg Mecate, 2 Mechas 1/2',
    monto: 298.00,
    proveedor: 'Distribuidora Panama Import C.A.',
    pagos: [{ pagador: 'riasco', monto_pagado: 298.00, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-20',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: 'Gasolina',
    monto: 140.00,
    proveedor: 'Proveedor Local',
    pagos: [{ pagador: 'riasco', monto_pagado: 140.00, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-21',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: 'Polea de Gancho15Ton',
    monto: 82.51,
    proveedor: 'Ferremateriales El EdenC.A.',
    pagos: [{ pagador: 'riasco', monto_pagado: 82.51, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-21',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: 'Tripa Usada',
    monto: 6.13,
    proveedor: 'Proveedor Local',
    pagos: [{ pagador: 'riasco', monto_pagado: 6.13, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-21',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: 'Pago de Fabricación de Tina',
    monto: 350.00,
    proveedor: 'Fabricador local',
    pagos: [{ pagador: 'riasco', monto_pagado: 350.00, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-22',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: 'Gasolina Para Camión',
    monto: 205.00,
    proveedor: 'Proveedor Local',
    pagos: [{ pagador: 'riasco', monto_pagado: 205.00, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-22',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: 'Pago Motosierra',
    monto: 203.00,
    proveedor: 'Tio Ramón Guajiro',
    pagos: [{ pagador: 'riasco', monto_pagado: 203.00, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-22',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: 'Mantenimiento de Moto de Ene',
    monto: 67.00,
    proveedor: 'Ene',
    pagos: [{ pagador: 'riasco', monto_pagado: 67.00, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-22',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: 'Insumos Menores Urgente',
    monto: 250.00,
    proveedor: 'Proveedor Local',
    pagos: [{ pagador: 'riasco', monto_pagado: 250.00, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-22',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: 'Regulador de gas',
    monto: 18.00,
    proveedor: 'Proveedor Local',
    pagos: [{ pagador: 'riasco', monto_pagado: 18.00, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-25',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: 'Recarga de Cilindro de Gas',
    monto: 75.00,
    proveedor: 'Proveedpr Local',
    pagos: [{ pagador: 'riasco', monto_pagado: 75.00, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-25',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: 'Nylon Para Desmalezadora',
    monto: 10.00,
    proveedor: 'Proveedor Local',
    pagos: [{ pagador: 'riasco', monto_pagado: 10.00, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-26',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: 'Contactor de Potencia 220V 25A VERT',
    monto: 34.00,
    proveedor: 'Ferremateriales El EdenC.A.',
    pagos: [{ pagador: 'riasco', monto_pagado: 34.00, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-26',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: 'Capacitador',
    monto: 40.00,
    proveedor: 'Proveedor Local',
    pagos: [{ pagador: 'riasco', monto_pagado: 40.00, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-26',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: 'Gasoil',
    monto: 120.00,
    proveedor: 'Kapelli',
    pagos: [{ pagador: 'riasco', monto_pagado: 120.00, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-26',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: '2 Brocas',
    monto: 120.00,
    proveedor: 'Proveedor Local',
    pagos: [{ pagador: 'riasco', monto_pagado: 120.00, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-26',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: 'Válvula Check',
    monto: 80.00,
    proveedor: 'Proveedor Local',
    pagos: [{ pagador: 'riasco', monto_pagado: 80.00, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-27',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: '40Kg Mecate, Cable 8, Cuchilla, Breaker, Carretilla',
    monto: 1020.00,
    proveedor: 'Oxyfast, C.A.',
    pagos: [{ pagador: 'riasco', monto_pagado: 1020.00, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-27',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: 'Nylon Para Desmalezadora',
    monto: 6.25,
    proveedor: 'Proveedor Local',
    pagos: [{ pagador: 'riasco', monto_pagado: 6.25, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-27',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: '140 L Gasolina',
    monto: 170.00,
    proveedor: 'Proveedor Local',
    pagos: [{ pagador: 'riasco', monto_pagado: 170.00, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-28',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: '10 Brocas, 10 Martillos, 1 Winche, 1600 Sacos (Neto Los Riascos)',
    monto: 544.51,
    proveedor: 'Oxyfast, C.A.',
    pagos: [{ pagador: 'riasco', monto_pagado: 544.51, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-28',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: '10 mecatillos, 10 Brocas Pata Larga',
    monto: 550.00,
    proveedor: 'Oxyfast, C.A.',
    pagos: [{ pagador: 'riasco', monto_pagado: 550.00, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-28',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: 'Insumos Menores Urgente',
    monto: 300.00,
    proveedor: 'Jesika',
    pagos: [{ pagador: 'riasco', monto_pagado: 300.00, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-29',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: '2 Barrenos',
    monto: 340.00,
    proveedor: 'Proveedor Local',
    pagos: [{ pagador: 'riasco', monto_pagado: 340.00, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-29',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: 'Aceite 20W50',
    monto: 12.68,
    proveedor: 'Ferreinsumos Peniel C.A.',
    pagos: [{ pagador: 'riasco', monto_pagado: 12.68, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-29',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: 'Taxi Técnico de Sistema',
    monto: 20.00,
    proveedor: 'Tecnico',
    pagos: [{ pagador: 'riasco', monto_pagado: 20.00, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-30',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: 'Compra Parcial de Congelador para Hielo',
    monto: 199.00,
    proveedor: 'Proveedor Local',
    pagos: [{ pagador: 'riasco', monto_pagado: 199.00, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-30',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: 'Embobinado Motor de Winche, Rolineras',
    monto: 400.00,
    proveedor: 'Proveedor Local',
    pagos: [{ pagador: 'riasco', monto_pagado: 400.00, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-31',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: '500 Sacos',
    monto: 200.00,
    proveedor: 'Molina Group C.A.',
    pagos: [{ pagador: 'riasco', monto_pagado: 200.00, porcentaje: 100 }],
  },
  {
    fecha: '2026-08-31',
    categoriaNombre: 'Operaciones de Mina',
    descripcion: 'Utencilios de Cocina',
    monto: 200.00,
    proveedor: 'Proveedor Local',
    pagos: [{ pagador: 'riasco', monto_pagado: 200.00, porcentaje: 100 }],
  },
];

/**
 * Obtiene los gastos de Agosto 2026 formateados para el cálculo de compensación.
 */
export function getAgosto2026GastosParaCompensacion(empresas: CompensacionEmpresa[]): GastoParaCompensacion[] {
  const riasco = empresas.find(
    (e) =>
      (e.nombre_corto ?? '').toLowerCase().includes('riasco') ||
      e.nombre.toLowerCase().includes('riasco'),
  ) ?? empresas[0];

  const fe = empresas.find(
    (e) =>
      (e.nombre_corto ?? '').toLowerCase().includes('fe') ||
      e.nombre.toLowerCase().includes('fe'),
  ) ?? empresas[1];

  return RAW_AGOSTO_2026_ITEMS.map((item, idx) => ({
    id: `agosto-2026-${idx + 1}`,
    fecha: item.fecha,
    monto: item.monto,
    categoria: item.categoriaNombre,
    descripcion: item.descripcion,
    pagos: item.pagos.map((p) => ({
      empresa_id: p.pagador === 'fe' ? fe.id : riasco.id,
      monto_pagado: p.monto_pagado,
    })),
  }));
}

/**
 * Obtiene los gastos de una empresa específica para su reporte individual en PDF para Agosto 2026.
 */
export function getAgosto2026GastosParaEmpresa(
  empresaId: string,
  empresas: CompensacionEmpresa[],
): GastosEmpresaResumen {
  const targetEmpresa = empresas.find((e) => e.id === empresaId) ?? empresas[0];

  const todosGastos = getAgosto2026GastosParaCompensacion(empresas);

  const gastosEmpresa: GastoEmpresa[] = [];
  const compartidosDetalle: GastoCompartidoDetalle[] = [];
  let totalGastado = 0;

  for (const g of todosGastos) {
    const miPago = g.pagos.find((p) => p.empresa_id === targetEmpresa.id)?.monto_pagado ?? 0;
    if (miPago > 0) {
      gastosEmpresa.push({
        id: g.id,
        fecha: g.fecha,
        descripcion: g.descripcion,
        categoria: g.categoria,
        montoTotal: g.monto,
        montoPagado: miPago,
      });
      totalGastado += miPago;
    }

    const cuota = Math.round(g.monto * (targetEmpresa.porcentaje / 100) * 100) / 100;
    const diferencia = Math.round((miPago - cuota) * 100) / 100;
    compartidosDetalle.push({
      fecha: g.fecha,
      descripcion: g.descripcion,
      montoTotal: g.monto,
      cuota,
      pagado: miPago,
      diferencia,
    });
  }

  const totalCompartido = Math.round(todosGastos.reduce((s, g) => s + g.monto, 0) * 100) / 100;
  const teorico = Math.round(totalCompartido * (targetEmpresa.porcentaje / 100) * 100) / 100;
  const saldo = Math.round((totalGastado - teorico) * 100) / 100;
  const estado = Math.abs(saldo) < 0.01 ? 'equilibrado' : saldo > 0 ? 'debe_cobrar' : 'debe_pagar';

  return {
    empresa: targetEmpresa,
    mes: '2026-08',
    desde: '2026-08-01',
    hasta: '2026-08-31',
    gastos: gastosEmpresa,
    totalGastado: Math.round(totalGastado * 100) / 100,
    gastosCompartidosDetalle: compartidosDetalle,
    compensacion: {
      totalCompartido,
      gastadoEmpresa: Math.round(totalGastado * 100) / 100,
      teorico,
      saldo,
      estado,
    },
  };
}

/**
 * Obtiene los gastos de Agosto 2026 formateados para la tabla de Gastos Operativos (/admin/gastos).
 */
export function getAgosto2026GastosParaTable(): Gasto[] {
  const fe = DEFAULT_EMPRESAS_INVERSORAS.find(e => e.nombre_corto.includes('fe')) ?? DEFAULT_EMPRESAS_INVERSORAS[0];
  const riasco = DEFAULT_EMPRESAS_INVERSORAS.find(e => e.nombre_corto.includes('riasco')) ?? DEFAULT_EMPRESAS_INVERSORAS[1];

  return RAW_AGOSTO_2026_ITEMS.map((item, idx) => ({
    id: `agosto-2026-${idx + 1}`,
    fecha: item.fecha,
    categoria_id: `cat-${item.categoriaNombre.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
    descripcion: item.descripcion,
    monto: item.monto,
    proveedor: item.proveedor,
    registrado_por: 'Administración',
    created_at: `${item.fecha}T12:00:00Z`,
    updated_at: `${item.fecha}T12:00:00Z`,
    categorias_gasto: {
      id: `cat-${item.categoriaNombre.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      nombre: item.categoriaNombre,
      tipo: 'general',
      activo: true,
    },
    gastos_empresas: item.pagos.map((p) => ({
      empresa_id: p.pagador === 'fe' ? fe.id : riasco.id,
      monto_pagado: p.monto_pagado,
      porcentaje: p.porcentaje,
      empresas_inversoras: p.pagador === 'fe' ? fe : riasco,
    })),
  }));
}

