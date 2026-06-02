import XLSX from 'xlsx';
import { parseExcelNominaMatrix } from '../src/lib/nomina/import-parser.ts';

const filepath = 'C:/Users/Manano/Downloads/Nomina Molinos la FE, Incluye  mina; MAYO 2026 4ta semana (2).xlsx';
const workbook = XLSX.readFile(filepath);

const period = parseExcelNominaMatrix(workbook, 'Nomina Molinos la FE, Incluye  mina; MAYO 2026 4ta semana (2).xlsx');

console.log('Grand Total:', period.grandTotal);
console.log('Stats:', period.stats);
console.log('Warnings:', period.stats.warnings);
console.log('Sections Count:', period.sections.length);

for (const sec of period.sections) {
  console.log(`\nSection: ${sec.title} (${sec.area}), rows: ${sec.rows.length}, total: ${sec.sectionTotal}`);
  for (const r of sec.rows) {
    console.log(`  - Worker: ${r.nombre_completo}, CI: ${r.cedula}, total: ${r.total}, weeks:`, JSON.stringify(r.weeks));
  }
}
