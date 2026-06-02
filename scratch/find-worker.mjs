import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://abhfedunawgzfnzeazgb.supabase.co',
  'sb_publishable_8VD8RgaFYZ1H32HrFJGY1Q_rAEC2aAE'
);

async function run() {
  const { data: workerByName } = await supabase
    .from('personal')
    .select('*')
    .ilike('nombre_completo', '%rafael%');
  console.log('Worker by Name containing Rafael:', workerByName);
}

run();
