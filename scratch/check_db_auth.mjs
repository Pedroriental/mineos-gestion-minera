import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Load .env.local manually
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
  console.log('--- Database Audit with Auth ---');

  // Sign in
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: env.NEXT_PUBLIC_GUEST_EMAIL,
    password: env.NEXT_PUBLIC_GUEST_PASSWORD,
  });

  if (authError) {
    console.error('Auth error:', authError.message);
    return;
  }

  console.log('Auth success. User:', authData.user.email);

  const tables = ['gastos', 'reportes_produccion', 'reportes_voladuras', 'equipos', 'nomina_semanas', 'personal'];

  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.log(`Table ${table}: error:`, error.message);
      continue;
    }

    // Try to get min/max date if exists
    let minMaxStr = '';
    if (table !== 'equipos' && table !== 'personal') {
      const dateField = table === 'nomina_semanas' ? 'semana_inicio' : 'fecha';
      const { data: minData } = await supabase.from(table).select(dateField).order(dateField, { ascending: true }).limit(1);
      const { data: maxData } = await supabase.from(table).select(dateField).order(dateField, { ascending: false }).limit(1);

      if (minData?.[0] && maxData?.[0]) {
        minMaxStr = `| Date range: ${minData[0][dateField]} to ${maxData[0][dateField]}`;
      }
    }

    console.log(`Table ${table}: count = ${count} ${minMaxStr}`);
  }
}

run();
