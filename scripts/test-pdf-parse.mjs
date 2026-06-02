import fs from 'node:fs';
import path from 'node:path';

const pdfPath =
  process.argv[2] ||
  'C:/Users/Manano/Downloads/Nomina Molinos la FE, Incluye  mina; MAYO 2026 4ta semana (1).pdf';

if (!fs.existsSync(pdfPath)) {
  console.log('FILE_NOT_FOUND', pdfPath);
  process.exit(1);
}

const buf = fs.readFileSync(pdfPath);
const blob = new Blob([buf], { type: 'application/pdf' });
const file = new File([blob], path.basename(pdfPath), { type: 'application/pdf' });

const { parsePdfNominaMatrix, extractPdfTextLines } = await import(
  '../src/lib/nomina/import-parser-pdf.ts'
);

const lines = await extractPdfTextLines(file);
console.log('LINE_COUNT', lines.length);
console.log('FIRST_30_LINES');
for (const l of lines.slice(0, 30)) console.log(l);

try {
  const p = await parsePdfNominaMatrix(file);
  console.log(
    JSON.stringify(
      {
        rangeStart: p.rangeStart,
        rangeEnd: p.rangeEnd,
        weeks: p.weekColumns.length,
        workers: p.stats.workerCount,
        grandTotal: p.grandTotal,
        sections: p.sections.map((s) => ({
          title: s.title,
          area: s.area,
          rows: s.rows.length,
          total: s.sectionTotal,
        })),
        warnings: p.stats.warnings,
      },
      null,
      2,
    ),
  );
} catch (e) {
  console.error('PARSE_ERROR', e.message);
}
