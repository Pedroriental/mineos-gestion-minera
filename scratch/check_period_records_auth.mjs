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
  console.log('--- Autenticando ---');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: env.NEXT_PUBLIC_GUEST_EMAIL,
    password: env.NEXT_PUBLIC_GUEST_PASSWORD
  });

  if (authError) {
    console.error(authError);
    return;
  }

  const { data: periodos } = await supabase
    .from('nomina_periodos')
    .select('*')
    .order('created_at', { ascending: false });

  const latest = periodos[0];
  if (!latest) {
    console.log('No se encontraron períodos.');
    return;
  }

  console.log(`\nConsultando un registro de nomina_registros para ver estructura...`);
  const { data: testRec, error: testErr } = await supabase
    .from('nomina_registros')
    .select('*')
    .limit(1);

  if (testErr) {
    console.error(testErr);
    return;
  }
  console.log('Estructura de un registro:', testRec[0]);

  console.log(`\nConsultando todos los registros en nomina_registros para periodo_id: ${latest.id}`);
  const { data: registros, error: rErr } = await supabase
    .from('nomina_registros')
    .select(`
      *,
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

  console.log(`Total de registros encontrados: ${registros.length}`);

  const workers = new Map();
  let grandTotal = 0;

  registros.forEach(r => {
    const workerName = r.personal?.nombre_completo || 'Desconocido';
    const cedula = r.personal?.cedula || '—';
    const estatus = r.personal?.estatus || '—';
    const amount = Number(r.monto_pagado || 0);
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
