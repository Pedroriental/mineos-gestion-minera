import fs from 'node:fs';
import { PDFParse } from 'pdf-parse';
import { parseNominaMatrixFromTextLines } from '../src/lib/nomina/import-parser.ts';

const path =
  process.argv[2] ||
  'C:/Users/Manano/Downloads/Nomina Molinos la FE, Incluye  mina; MAYO 2026 4ta semana (1).pdf';

const buf = fs.readFileSync(path);
const parser = new PDFParse({ data: buf });
const result = await parser.getText();
await parser.destroy();

const lines = result.text
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter(Boolean);

const p = parseNominaMatrixFromTextLines(lines, 'test.pdf');
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
        weekCols: s.weekColumns.length,
        total: s.sectionTotal,
      })),
    },
    null,
    2,
  ),
);
