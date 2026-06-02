import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
  if (match) {
    env[match[1]] = match[2].replace(/(^['"]|['"]$)/g, '').trim();
  }
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  console.log('--- Buscando Período de Importación ---');
  const { data: periodos, error: pErr } = await supabase
    .from('nomina_periodos')
    .select('*')
    .order('created_at', { ascending: false });

  if (pErr) {
    console.error(pErr);
    return;
  }

  console.log('Períodos cargados:');
  periodos.forEach(p => {
    console.log(`- ID: ${p.id}, Rango: ${p.fecha_inicio} al ${p.fecha_fin}, Total: ${p.total_usd}, Tipo: ${p.tipo}`);
  });

  const latest = periodos[0];
  if (!latest) {
    console.log('No se encontraron períodos.');
    return;
  }

  console.log(`\nConsultando registros para el período: ${latest.id} (${latest.fecha_inicio} al ${latest.fecha_fin})`);
  const { data: registros, error: rErr } = await supabase
    .from('nomina_registros_cerrados')
    .select(`
      id,
      semana_inicio,
      personal_id,
      area,
      monto_pagado,
      es_semana_libre,
      estado_asistencia,
      personal (
        nombre_completo,
        cedula,
        estatus,
        activo
      )
    `)
    .eq('periodo_id', latest.id);

  if (rErr) {
    console.error(rErr);
    return;
  }

  console.log(`Total de registros de nómina cerrados encontrados: ${registros.length}`);

  const workers = new Map();
  let grandTotal = 0;

  registros.forEach(r => {
    const workerName = r.personal?.nombre_completo || 'Desconocido';
    const cedula = r.personal?.cedula || '—';
    const estatus = r.personal?.estatus || '—';
    const amount = Number(r.monto_pagado);
    grandTotal += amount;

    if (!workers.has(workerName)) {
      workers.set(workerName, {
        cedula,
        estatus,
        area: r.area,
        amountsByWeek: {},
        total: 0
      });
    }

    const wData = workers.get(workerName);
    wData.amountsByWeek[r.semana_inicio] = amount;
    wData.total += amount;
  });

  console.log('\nResumen de Trabajadores en la Base de Datos para este período:');
  const sortedWorkers = [...workers.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  sortedWorkers.forEach(([name, data]) => {
    console.log(`- ${name} (C.I. ${data.cedula}, Estatus: ${data.estatus}, Área: ${data.area})`);
    Object.entries(data.amountsByWeek).forEach(([week, amt]) => {
      console.log(`    * Semana ${week}: $${amt}`);
    });
    console.log(`    * TOTAL: $${data.total}`);
  });

  console.log(`\nSuma de registros en Base de Datos: $${grandTotal}`);
  console.log(`Total de trabajadores únicos: ${workers.size}`);
}

run();
