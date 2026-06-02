import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

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
  console.log('--- Personal en DB ---');
  const { data: personal, error: pErr } = await supabase
    .from('personal')
    .select('id, cedula, nombre_completo, area, estatus')
    .limit(30);
  if (pErr) console.error(pErr);
  else console.table(personal);
}

run();
