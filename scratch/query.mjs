import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: './.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  const { data, error } = await supabase
    .from('personal')
    .select('*')
    .eq('activo', true);

  if (error) {
    console.error('Error fetching personal:', error);
    return;
  }

  console.log('Active personal count:', data.length);
  console.log(JSON.stringify(data, null, 2));
}

run();
