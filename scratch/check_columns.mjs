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
  console.log('--- Columnas de personal ---');
  const { data, error } = await supabase.rpc('get_table_columns_debug', { p_table: 'personal' });
  if (error) {
    // If RPC doesn't exist, execute a custom SQL query via db query
    const { data: cols, error: colErr } = await supabase
      .from('personal')
      .select('*')
      .limit(1);
    if (colErr) {
      console.error('Error fetching personal:', colErr);
    } else {
      console.log('Keys of personal record:', Object.keys(cols[0] || {}));
    }
  } else {
    console.log('Columns:', data);
  }
}

run();
