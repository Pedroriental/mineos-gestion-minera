import XLSX from 'xlsx';
import { parseExcelNominaMatrix } from '../src/lib/nomina/import-parser.js';

const filePath = 'C:\\Users\\Manano\\Downloads\\Nomina Molinos la FE, Incluye  mina; MAYO 2026 4ta semana (2).xlsx';

async function run() {
  const workbook = XLSX.readFile(filePath);
  const period = parseExcelNominaMatrix(workbook, 'test.xlsx');
  
  console.log('=== RESULTADO DEL PARSER ===');
  console.log(`Grand Total: ${period.grandTotal}`);
  console.log(`Stats declaredSourceTotal: ${period.stats.declaredSourceTotal}`);
  console.log(`Warnings:`, period.stats.warnings);
  console.log(`Semanas/Columnas detectadas:`, period.weekColumns.map(c => c.weekStart));
  
  console.log('\n=== SECCIONES PARSEADAS ===');
  for (const sec of period.sections) {
    console.log(`\n--- Sección: ${sec.title} (Total: ${sec.sectionTotal}) ---`);
    console.log(`Columnas de la sección:`, sec.weekColumns.map(c => `${c.weekStart} (ColIdx: ${c.colIndex})`));
    for (const row of sec.rows) {
      console.log(`  * ${row.nombre_completo} (C.I. ${row.cedula}): Total: ${row.total}`);
      console.log(`    Semanas:`, Object.entries(row.weeks).map(([wStart, cell]) => `${wStart}: $${cell.amount} (${cell.estado})`));
    }
  }
}

run();
