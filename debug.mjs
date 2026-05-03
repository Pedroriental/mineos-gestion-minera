
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  // get_rentabilidad output
  const { data: rent } = await supabase.rpc('get_rentabilidad', { periodo_dias: 30 });
  console.log('get_rentabilidad 30d:', rent?.oro_planta_g);

  // produccion raw query using the exact same logic as ProduccionPage
  const { data: reportes } = await supabase.from('reportes_produccion').select('fecha, oro_recuperado_g');
  
  const today = new Date();
  const sub30 = new Date(today);
  sub30.setDate(sub30.getDate() - 30);
  
  const d_hoy = today.toISOString().split('T')[0];
  const d_sub30 = sub30.toISOString().split('T')[0];

  let sum = 0;
  reportes.forEach(r => {
    if (r.fecha >= d_sub30 && r.fecha <= d_hoy) {
      sum += Number(r.oro_recuperado_g) || 0;
    }
  });
  console.log('ProduccionPage 30d:', sum, 'from', d_sub30, 'to', d_hoy);

  // Let's see what days are missing in get_rentabilidad
  // rpc_rentabilidad does: current_date - 30 days
  const { data: rpcDates } = await supabase.rpc('get_produccion_diaria', { periodo_dias: 30 });
  let sumRpc = 0;
  rpcDates.forEach(d => {
    sumRpc += Number(d.oro_g);
  });
  console.log('get_produccion_diaria sum:', sumRpc);

  // Group by date
  const byDateJS = {};
  reportes.forEach(r => {
    if (r.fecha >= d_sub30 && r.fecha <= d_hoy) {
       byDateJS[r.fecha] = (byDateJS[r.fecha] || 0) + (Number(r.oro_recuperado_g) || 0);
    }
  });

  const missingDates = [];
  Object.keys(byDateJS).forEach(date => {
     const rpcRow = rpcDates.find(x => x.fecha === date);
     const jsVal = byDateJS[date];
     const rpcVal = rpcRow ? Number(rpcRow.oro_g) : 0;
     if (Math.abs(jsVal - rpcVal) > 0.1) {
        missingDates.push({ date, jsVal, rpcVal });
     }
  });
  console.log('Differences by date:', missingDates);
}
run();

