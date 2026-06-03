// Migration runner - ejecuta SQL contra Supabase PostgreSQL
// Uso: node scripts/run-migration.mjs <file1.sql> <file2.sql> ...
import { readFileSync } from 'node:fs';
import pg from 'pg';

const { Pool } = pg;
const PROJECT_REF = 'abhfedunawgzfnzeazgb';
const PASSWORD = process.env.SUPABASE_DB_PASSWORD || process.env.PG_PASSWORD;

if (!PASSWORD) {
  console.error('Error: Define SUPABASE_DB_PASSWORD o PG_PASSWORD');
  process.exit(1);
}

async function tryConnect(config) {
  const p = new Pool({ ...config, connectionTimeoutMillis: 5000 });
  try {
    const c = await p.connect();
    await c.query('SELECT 1');
    c.release();
    return p;
  } catch {
    try { await p.end(); } catch {}
    return null;
  }
}

async function connect() {
  // 1. Pooler transaction mode
  let p = await tryConnect({
    host: 'aws-0-us-east-1.pooler.supabase.com', port: 6543,
    database: 'postgres', user: `postgres.${PROJECT_REF}`,
    password: PASSWORD, ssl: { rejectUnauthorized: false },
  });
  if (p) { console.log('Conectado: pooler:6543'); return p; }

  // 2. Pooler session mode
  p = await tryConnect({
    host: 'aws-0-us-east-1.pooler.supabase.com', port: 5432,
    database: 'postgres', user: `postgres.${PROJECT_REF}`,
    password: PASSWORD, ssl: { rejectUnauthorized: false },
  });
  if (p) { console.log('Conectado: pooler:5432'); return p; }

  // 3. Directa
  p = await tryConnect({
    host: `db.${PROJECT_REF}.supabase.co`, port: 5432,
    database: 'postgres', user: 'postgres',
    password: PASSWORD, ssl: { rejectUnauthorized: false },
  });
  if (p) { console.log('Conectado: direct'); return p; }

  console.error('No se pudo conectar. Verifica que:');
  console.error('  - La IP esta habilitada en Supabase > Settings > Database');
  console.error('  - El pooler esta activado en Supabase > Settings > Database');
  process.exit(1);
}

async function runMigration(pool, filePath) {
  console.log(`\nEjecutando: ${filePath}`);
  const sql = readFileSync(filePath, 'utf-8');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log(`  OK - ${filePath}`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(`  ERROR en ${filePath}:`, err.message);
    process.exit(1);
  } finally {
    client.release();
  }
}

async function main() {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error('Uso: SUPABASE_DB_PASSWORD=xxx node scripts/run-migration.mjs <file>...');
    process.exit(1);
  }
  const pool = await connect();
  for (const file of files) {
    await runMigration(pool, file);
  }
  await pool.end();
  console.log('\nTodas las migraciones ejecutadas correctamente.');
}

main();
