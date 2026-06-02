#!/usr/bin/env npx tsx
/**
 * CLI: importar nómina histórica desde Excel
 * Uso: npx tsx scripts/nomina-import-historico.ts ./ruta/nomina-mayo-2026.xlsx
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as XLSX from 'xlsx';
import { parseExcelNominaMatrix } from '../src/lib/nomina/import-parser';
import { inferAllProfiles } from '../src/lib/nomina/inference';

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Uso: npx tsx scripts/nomina-import-historico.ts <archivo.xlsx>');
    process.exit(1);
  }

  const abs = resolve(filePath);
  const buffer = readFileSync(abs);
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  const period = parseExcelNominaMatrix(workbook, abs);

  const weekStarts = period.weekColumns.map((c) => c.weekStart);
  const rows = period.sections.flatMap((s) => s.rows);
  const profiles = inferAllProfiles(rows, weekStarts, period.weekColumns);

  console.log('--- Parse OK ---');
  console.log(`Rango: ${period.rangeStart} — ${period.rangeEnd}`);
  console.log(`Total: $${period.grandTotal.toFixed(2)}`);
  console.log(`Secciones: ${period.sections.length}`);
  console.log(`Trabajadores: ${period.stats.workerCount}`);
  console.log(`Semanas: ${period.weekColumns.length}`);
  console.log(`Inferencias baja confianza: ${profiles.filter((p) => p.needsReview).length}`);

  for (const s of period.sections) {
    console.log(`  ${s.title}: $${s.sectionTotal.toFixed(2)}`);
  }

  console.log('\nPayload listo para importarNominaHistoricaAction (desde UI o API autenticada).');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
