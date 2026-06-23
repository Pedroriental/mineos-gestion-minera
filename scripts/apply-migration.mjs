// apply-migration.mjs - Aplica una migración SQL via pg client
import { readFileSync } from 'node:fs';
import pg from 'pg';

const { Pool } = pg;

const PROJECT_REF = 'abhfedunawgzfnzeazgb';
const PASSWORD = process.env.SUPABASE_DB_PASSWORD;

if (!PASSWORD) {
  console.error('Error: Define SUPABASE_DB_PASSWORD con la contraseña de la BD.');
  process.exit(1);
}

// Try pooler first, fallback to direct
const pool = new Pool({
  host: `db.${PROJECT_REF}.supabase.co`,
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: PASSWORD,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

async function runMigration(filePath) {
  const sql = readFileSync(filePath, 'utf-8');
  const client = await pool.connect();
  try {
    console.log(`Ejecutando: ${filePath}`);
    await client.query(sql);
    console.log(`  OK - ${filePath}`);
  } catch (err) {
    console.error(`  ERROR en ${filePath}:`, err.message);
    process.exit(1);
  } finally {
    client.release();
  }
}

async function main() {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error('Uso: SUPABASE_DB_PASSWORD=xxx node apply-migration.mjs <file.sql>');
    process.exit(1);
  }
  for (const file of files) {
    await runMigration(file);
  }
  await pool.end();
  console.log('\nMigración aplicada correctamente.');
}

main();
