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
  console.log('--- Test Insert into personal ---');
  const payload = {
    cedula: '12345678',
    nombre_completo: 'Test User',
    cargo: 'Operario',
    area: 'mina',
    salario_base: 100,
    fecha_ingreso: '2026-05-01',
    activo: true,
    estatus: 'ACTIVO',
    area_detalle: 'Test Area',
    salario_libre: 100,
    bono_transporte: 10,
    esquema_rotacion: 'FIJO_SEMANAL',
    rotacion_inicio_fecha: '2026-05-01'
  };

  const { data, error } = await supabase.from('personal').insert(payload).select();
  if (error) {
    console.error('Insert Error:', error);
  } else {
    console.log('Insert Success:', data);
  }
}

run();
