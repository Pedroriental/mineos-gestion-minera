import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://abhfedunawgzfnzeazgb.supabase.co';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_8VD8RgaFYZ1H32HrFJGY1Q_rAEC2aAE';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log('--- Insertando gastos de Julio 2026 en Supabase ---');

  // 1. Empresas
  const { data: empresas, error: empErr } = await supabase
    .from('empresas_inversoras')
    .select('id, nombre, nombre_corto');

  if (empErr || !empresas || empresas.length === 0) {
    console.error('Error obteniendo empresas:', empErr);
    return;
  }

  const riasco = empresas.find(
    (e) =>
      (e.nombre_corto ?? '').toLowerCase().includes('riasco') ||
      e.nombre.toLowerCase().includes('riasco'),
  );
  const fe = empresas.find(
    (e) =>
      (e.nombre_corto ?? '').toLowerCase().includes('fe') ||
      e.nombre.toLowerCase().includes('fe'),
  );

  if (!riasco || !fe) {
    console.error('No se encontraron las empresas Los Riasco y La Fé');
    return;
  }

  // 2. Categorías
  async function getCatId(nombreCat: string): Promise<string | null> {
    const { data: existing } = await supabase
      .from('categorias_gasto')
      .select('id')
      .eq('nombre', nombreCat)
      .limit(1)
      .maybeSingle();

    if (existing?.id) return existing.id;

    const { data: created, error } = await supabase
      .from('categorias_gasto')
      .insert({ nombre: nombreCat, tipo: 'general', activo: true })
      .select('id')
      .maybeSingle();

    if (error) {
      console.error(`Error creando categoría ${nombreCat}:`, error.message);
    }
    return created?.id ?? null;
  }

  const catVoladurasId = await getCatId('Voladuras (Exp y Barre)');
  const catOperacionesId = await getCatId('Operaciones de Mina');
  const catComidaId = await getCatId('Comida en Mina');
  const catNominaId = await getCatId('Nómina en Mina');
  const catMolinoId = await getCatId('Operaciones de Molino');

  // 3. Gastos a poblar
  const items = [
    // --- Voladuras ---
    {
      fecha: '2026-07-11',
      categoria_id: catVoladurasId,
      descripcion: '50 metros de Cordón Detonante',
      monto: 1000.00,
      proveedor: 'Los Riascos',
      empresas: [{ empresa_id: riasco.id, monto_pagado: 1000.00 }],
    },
    {
      fecha: '2026-07-17',
      categoria_id: catVoladurasId,
      descripcion: '350 LP y 50 m de Trenzas',
      monto: 20250.00,
      proveedor: 'La Fe',
      empresas: [{ empresa_id: fe.id, monto_pagado: 20250.00 }],
    },

    // --- Comida en Mina ---
    {
      fecha: '2026-07-02',
      categoria_id: catComidaId,
      descripcion: 'Viveres - Plaza Exito',
      monto: 401.28,
      proveedor: 'Comercializadora Plaza Exito, C.A.',
      empresas: [{ empresa_id: riasco.id, monto_pagado: 401.28 }],
    },
    {
      fecha: '2026-07-02',
      categoria_id: catComidaId,
      descripcion: 'Hortalizas - PEH',
      monto: 62.22,
      proveedor: 'Inversiones PEH, C.A.',
      empresas: [{ empresa_id: riasco.id, monto_pagado: 62.22 }],
    },
    {
      fecha: '2026-07-02',
      categoria_id: catComidaId,
      descripcion: 'Hortalizas - PEH',
      monto: 81.91,
      proveedor: 'Inversiones PEH, C.A.',
      empresas: [{ empresa_id: riasco.id, monto_pagado: 81.91 }],
    },
    {
      fecha: '2026-07-02',
      categoria_id: catComidaId,
      descripcion: 'Viveres - Plaza Exito',
      monto: 2005.55,
      proveedor: 'Comercializadora Plaza Exito, C.A.',
      empresas: [{ empresa_id: riasco.id, monto_pagado: 2005.55 }],
    },
    {
      fecha: '2026-07-09',
      categoria_id: catComidaId,
      descripcion: 'Hortalizas - PEH',
      monto: 145.64,
      proveedor: 'Inversiones PEH, C.A.',
      empresas: [{ empresa_id: riasco.id, monto_pagado: 145.64 }],
    },
    {
      fecha: '2026-07-15',
      categoria_id: catComidaId,
      descripcion: 'Hidratación y Hielo',
      monto: 57.60,
      proveedor: 'Proveedor Comunitario',
      empresas: [{ empresa_id: riasco.id, monto_pagado: 57.60 }],
    },
    {
      fecha: '2026-07-17',
      categoria_id: catComidaId,
      descripcion: 'Viveres - Plaza Exito',
      monto: 1735.15,
      proveedor: 'Comercializadora Plaza Exito, C.A.',
      empresas: [{ empresa_id: riasco.id, monto_pagado: 1735.15 }],
    },
    {
      fecha: '2026-07-17',
      categoria_id: catComidaId,
      descripcion: 'Hortalizas - PEH',
      monto: 120.95,
      proveedor: 'Inversiones PEH, C.A.',
      empresas: [{ empresa_id: riasco.id, monto_pagado: 120.95 }],
    },
    {
      fecha: '2026-07-24',
      categoria_id: catComidaId,
      descripcion: 'Carne de Res',
      monto: 93.33,
      proveedor: 'Proveedor Comunitario',
      empresas: [{ empresa_id: riasco.id, monto_pagado: 93.33 }],
    },
    {
      fecha: '2026-07-24',
      categoria_id: catComidaId,
      descripcion: 'Hidratación e Hielo',
      monto: 90.00,
      proveedor: 'Proveedor Comunitario',
      empresas: [{ empresa_id: riasco.id, monto_pagado: 90.00 }],
    },
    {
      fecha: '2026-07-25',
      categoria_id: catComidaId,
      descripcion: 'Hortalizas - PEH',
      monto: 129.67,
      proveedor: 'Inversiones PEH, C.A.',
      empresas: [
        { empresa_id: fe.id, monto_pagado: 125.00 },
        { empresa_id: riasco.id, monto_pagado: 4.67 },
      ],
    },
    {
      fecha: '2026-07-31',
      categoria_id: catComidaId,
      descripcion: 'Hidratación e Hielo',
      monto: 8.03,
      proveedor: 'Proveedor Comunitario',
      empresas: [{ empresa_id: riasco.id, monto_pagado: 8.03 }],
    },

    // --- Nómina en Mina ---
    {
      fecha: '2026-07-05',
      categoria_id: catNominaId,
      descripcion: 'Nómina Semanal Mina (Día 5)',
      monto: 5900.71,
      proveedor: 'Nómina Operativa',
      empresas: [
        { empresa_id: riasco.id, monto_pagado: 3540.43 },
        { empresa_id: fe.id, monto_pagado: 2360.28 },
      ],
    },
    {
      fecha: '2026-07-12',
      categoria_id: catNominaId,
      descripcion: 'Nómina Semanal Mina (Día 12)',
      monto: 6660.00,
      proveedor: 'Nómina Operativa',
      empresas: [
        { empresa_id: riasco.id, monto_pagado: 3996.00 },
        { empresa_id: fe.id, monto_pagado: 2664.00 },
      ],
    },
    {
      fecha: '2026-07-19',
      categoria_id: catNominaId,
      descripcion: 'Nómina Semanal Mina (Día 19)',
      monto: 7027.84,
      proveedor: 'Nómina Operativa',
      empresas: [
        { empresa_id: riasco.id, monto_pagado: 4216.70 },
        { empresa_id: fe.id, monto_pagado: 2811.14 },
      ],
    },
    {
      fecha: '2026-07-26',
      categoria_id: catNominaId,
      descripcion: 'Nómina Semanal Mina (Día 26)',
      monto: 7128.57,
      proveedor: 'Nómina Operativa',
      empresas: [
        { empresa_id: riasco.id, monto_pagado: 4277.14 },
        { empresa_id: fe.id, monto_pagado: 2851.43 },
      ],
    },

    // --- Operaciones de Mina (La Fé) ---
    {
      fecha: '2026-07-02',
      categoria_id: catOperacionesId,
      descripcion: '1500 Litros de Diesel',
      monto: 1800.00,
      proveedor: 'Proveedor Local',
      empresas: [{ empresa_id: fe.id, monto_pagado: 1800.00 }],
    },
    {
      fecha: '2026-07-02',
      categoria_id: catOperacionesId,
      descripcion: '500 Litros de Gasolina',
      monto: 700.00,
      proveedor: 'Proveedor Local',
      empresas: [{ empresa_id: fe.id, monto_pagado: 700.00 }],
    },
    {
      fecha: '2026-07-05',
      categoria_id: catOperacionesId,
      descripcion: '2 Pares de Radios',
      monto: 120.00,
      proveedor: 'Proveedor Local',
      empresas: [{ empresa_id: fe.id, monto_pagado: 120.00 }],
    },
    {
      fecha: '2026-07-07',
      categoria_id: catOperacionesId,
      descripcion: '2 Brocas',
      monto: 100.00,
      proveedor: 'Proveedor Local',
      empresas: [{ empresa_id: fe.id, monto_pagado: 100.00 }],
    },
    {
      fecha: '2026-07-09',
      categoria_id: catOperacionesId,
      descripcion: '11 Brocas',
      monto: 660.00,
      proveedor: 'Proveedor Local',
      empresas: [{ empresa_id: fe.id, monto_pagado: 660.00 }],
    },
    {
      fecha: '2026-07-16',
      categoria_id: catOperacionesId,
      descripcion: '500 Litros de Gasolina',
      monto: 700.00,
      proveedor: 'Proveedor Local',
      empresas: [{ empresa_id: fe.id, monto_pagado: 700.00 }],
    },
    {
      fecha: '2026-07-17',
      categoria_id: catOperacionesId,
      descripcion: 'Contactor, Sacos',
      monto: 600.00,
      proveedor: 'Proveedor Local',
      empresas: [{ empresa_id: fe.id, monto_pagado: 600.00 }],
    },
    {
      fecha: '2026-07-21',
      categoria_id: catOperacionesId,
      descripcion: 'Materiales de Mina',
      monto: 3000.00,
      proveedor: 'Proveedor Local',
      empresas: [{ empresa_id: fe.id, monto_pagado: 3000.00 }],
    },
    {
      fecha: '2026-07-25',
      categoria_id: catOperacionesId,
      descripcion: 'Información y Planos',
      monto: 650.00,
      proveedor: 'Proveedor Local',
      empresas: [{ empresa_id: fe.id, monto_pagado: 650.00 }],
    },
    {
      fecha: '2026-07-30',
      categoria_id: catOperacionesId,
      descripcion: 'Tubos Elec 1", Sacos',
      monto: 700.00,
      proveedor: 'Proveedor Local',
      empresas: [{ empresa_id: fe.id, monto_pagado: 700.00 }],
    },
    {
      fecha: '2026-07-30',
      categoria_id: catOperacionesId,
      descripcion: 'Transformadores y Accesorios',
      monto: 4454.01,
      proveedor: 'Proveedor Local',
      empresas: [{ empresa_id: fe.id, monto_pagado: 4454.01 }],
    },
    {
      fecha: '2026-07-11',
      categoria_id: catOperacionesId,
      descripcion: 'Acometida V4 - Bomba 20Hp, Cable, Mano Obra y Transformadores (Cuota La Fe)',
      monto: 6546.00,
      proveedor: 'Oxifast / Ferremateriales',
      empresas: [{ empresa_id: fe.id, monto_pagado: 6546.00 }],
    },

    // --- Operaciones de Mina (Los Riascos) ---
    {
      fecha: '2026-07-11',
      categoria_id: catOperacionesId,
      descripcion: 'Acometida V4 - Bomba 20Hp, Cable, Mano Obra y Transformadores (Cuota Los Riascos)',
      monto: 10559.00,
      proveedor: 'Oxifast / Ferremateriales',
      empresas: [{ empresa_id: riasco.id, monto_pagado: 10559.00 }],
    },
    {
      fecha: '2026-07-15',
      categoria_id: catOperacionesId,
      descripcion: 'Equipos, Repuestos e Insumos Operaciones Mina',
      monto: 14112.86,
      proveedor: 'Proveedores Varios',
      empresas: [{ empresa_id: riasco.id, monto_pagado: 14112.86 }],
    },

    // --- Gastos de Molino Los Riasco ---
    {
      fecha: '2026-07-15',
      categoria_id: catMolinoId,
      descripcion: 'Operaciones de Molino',
      monto: 20782.67,
      proveedor: 'Los Riascos',
      empresas: [{ empresa_id: riasco.id, monto_pagado: 20782.67 }],
    },
    {
      fecha: '2026-07-20',
      categoria_id: catMolinoId,
      descripcion: 'Comida en Molino',
      monto: 2853.13,
      proveedor: 'Los Riascos',
      empresas: [{ empresa_id: riasco.id, monto_pagado: 2853.13 }],
    },
    {
      fecha: '2026-07-31',
      categoria_id: catMolinoId,
      descripcion: 'Nómina en Molino',
      monto: 13580.00,
      proveedor: 'Los Riascos',
      empresas: [{ empresa_id: riasco.id, monto_pagado: 13580.00 }],
    },
  ];

  let count = 0;
  for (const item of items) {
    if (!item.categoria_id) continue;
    const { data: gIns, error: gErr } = await supabase
      .from('gastos')
      .insert({
        fecha: item.fecha,
        monto: item.monto,
        categoria_id: item.categoria_id,
        descripcion: item.descripcion,
        proveedor: item.proveedor,
      })
      .select('id')
      .single();

    if (gErr || !gIns?.id) {
      console.error(`Error insertando ${item.descripcion}:`, gErr?.message);
      continue;
    }

    const pagos = item.empresas.map((p) => ({
      gasto_id: gIns.id,
      empresa_id: p.empresa_id,
      monto_pagado: p.monto_pagado,
    }));

    const { error: pErr } = await supabase.from('gastos_empresas').insert(pagos);
    if (pErr) console.error(`Error insertando pagos de ${item.descripcion}:`, pErr.message);
    else count++;
  }

  console.log(`✅ ¡Proceso completado! Se insertaron ${count} registros de Julio 2026.`);
}

main();
