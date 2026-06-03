// test-connection.mjs - Probar variantes de conexión a Supabase
import pg from 'pg';
const { Pool } = pg;

const PROJECT = 'abhfedunawgzfnzeazgb';
const PASSWORD = process.env.SUPABASE_DB_PASSWORD || 'Pedrojoseito345';

async function tryConnect(host, port, user) {
  const p = new Pool({
    host, port, user, database: 'postgres', password: PASSWORD,
    ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 3000,
  });
  try {
    const c = await p.connect();
    const r = await c.query("SELECT 'OK' as status, current_database() as db");
    console.log(`  OK: ${host}:${port} user=${user} -> ${r.rows[0].db}`);
    c.release();
    await p.end();
    return true;
  } catch (e) {
    console.log(`  FAIL: ${host}:${port} user=${user} -> ${e.message.substring(0, 100)}`);
    try { await p.end(); } catch {}
    return false;
  }
}

const variants = [
  // Pooler transaction mode
  { host: 'aws-0-us-east-1.pooler.supabase.com', port: 6543, user: 'postgres.' + PROJECT },
  // Pooler session mode  
  { host: 'aws-0-us-east-1.pooler.supabase.com', port: 5432, user: 'postgres.' + PROJECT },
  // Direct
  { host: 'db.' + PROJECT + '.supabase.co', port: 5432, user: 'postgres' },
  // Direct alternative
  { host: PROJECT + '.supabase.co', port: 5432, user: 'postgres' },
];

console.log('Probando conexiones a Supabase...');
for (const v of variants) {
  const ok = await tryConnect(v.host, v.port, v.user);
  if (ok) {
    console.log('\nConexion exitosa!');
    process.exit(0);
  }
}
console.log('\nTodas las conexiones fallaron.');
process.exit(1);
