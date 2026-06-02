const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Load .env.local
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
  console.log('--- Semanas en DB ---');
  const { data: semanas, error: semErr } = await supabase
    .from('nomina_semanas')
    .select('id, semana_inicio, semana_fin, area, total_pagado, total_trabajadores, periodo_id')
    .order('semana_inicio', { ascending: true });
  if (semErr) console.error(semErr);
  else console.table(semanas);

  console.log('--- Periodos Archivados ---');
  const { data: periodos, error: perErr } = await supabase
    .from('nomina_periodos')
    .select('id, label, range_start, range_end, total_usd, origen')
    .order('range_start', { ascending: true });
  if (perErr) console.error(perErr);
  else console.log(JSON.stringify(periodos, null, 2));
}

run();
