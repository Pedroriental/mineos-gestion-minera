import fs from 'fs';
import { parseNominaMatrixFromTextLines, preprocessNominaPdfLines } from '../src/lib/nomina/import-parser.ts';

const fileContent = fs.readFileSync('scratch/pdf-dump.txt', 'utf8');
const lines = fileContent.split('\n');

// Extraer líneas RAW y PREPRO
const rawLines = [];
const preproLines = [];

for (const line of lines) {
  if (line.startsWith('RAW [')) {
    const content = line.substring(line.indexOf(']:') + 2).trim();
    rawLines.push(content);
  } else if (line.startsWith('PREPRO [')) {
    const content = line.substring(line.indexOf(']:') + 2).trim();
    preproLines.push(content);
  }
}

// Correr el parser en las líneas preprocesadas (tolerance grouping)
const pTolerance = parseNominaMatrixFromTextLines(preproLines, 'test.pdf');

console.log('--- TOLERANCE RUN RESULTS ---');
console.log('Grand Total:', pTolerance.grandTotal);
console.log('Workers count:', pTolerance.stats.workerCount);
pTolerance.sections.forEach(s => {
  console.log(`Section: "${s.title}" (Rows: ${s.rows.length}, Total: ${s.sectionTotal})`);
  s.rows.forEach(r => {
    console.log(`  - ${r.nombre_completo} (C.I. ${r.cedula}, Total: ${r.total})`);
  });
});
