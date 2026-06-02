import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Load .env.local
const envContent = fs.readFileSync('c:\\Users\\Manano\\Documents\\mineos-gestion-minera\\.env.local', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
  if (match) {
    env[match[1]] = match[2].replace(/(^['"]|['"]$)/g, '').trim();
  }
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  console.log('Checking nominas_cargadas table...');
  const { data, error } = await supabase.from('nominas_cargadas').select('*').limit(1);
  if (error) {
    console.error('Error on nominas_cargadas:', error.message);
  } else {
    console.log('Success! nominas_cargadas exists. Row count:', data.length);
  }

  console.log('Checking detalles_nomina table...');
  const { data: dData, error: dError } = await supabase.from('detalles_nomina').select('*').limit(1);
  if (dError) {
    console.error('Error on detalles_nomina:', dError.message);
  } else {
    console.log('Success! detalles_nomina exists. Row count:', dData.length);
  }

  console.log('Checking columns in personal table...');
  const { data: pData, error: pError } = await supabase.from('personal').select('estado_manual_override, ultimo_update_estado_at').limit(1);
  if (pError) {
    console.error('Error on personal columns:', pError.message);
  } else {
    console.log('Success! personal columns exist.');
  }
}

run();
