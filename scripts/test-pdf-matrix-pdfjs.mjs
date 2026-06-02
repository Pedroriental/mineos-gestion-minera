import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'url';
import {
  parseNominaMatrixFromTextLines,
  preprocessNominaPdfLines,
} from '../src/lib/nomina/import-parser.ts';

const pdfPath =
  process.argv[2] ||
  'C:/Users/Manano/Downloads/Nomina Molinos la FE, Incluye  mina; MAYO 2026 4ta semana (1).pdf';

const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
const workerPath = pathToFileURL(
  path.join(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'),
).href;
pdfjs.GlobalWorkerOptions.workerSrc = workerPath;

const data = new Uint8Array(fs.readFileSync(pdfPath));
const pdf = await pdfjs.getDocument({ data }).promise;
const lines = [];

for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
  const page = await pdf.getPage(pageNum);
  const content = await page.getTextContent();
  
  const items = content.items
    .map(item => {
      if (!('str' in item) || !item.str) return null;
      return {
        str: item.str,
        x: item.transform[4],
        y: item.transform[5]
      };
    })
    .filter(Boolean);
    
  const TOLERANCE = 4.0;
  const linesGrouped = [];
  
  for (const item of items) {
    let placed = false;
    for (const line of linesGrouped) {
      if (Math.abs(line.y - item.y) <= TOLERANCE) {
        line.items.push(item);
        // Actualizar el Y de la línea como el promedio para mayor precisión
        line.y = (line.y * line.items.length + item.y) / (line.items.length + 1);
        placed = true;
        break;
      }
    }
    if (!placed) {
      linesGrouped.push({
        y: item.y,
        items: [item]
      });
    }
  }
  
  linesGrouped.sort((a, b) => b.y - a.y);
  
  for (const line of linesGrouped) {
    line.items.sort((a, b) => a.x - b.x);
    const lineText = line.items.map(it => it.str).join(' ').trim();
    if (lineText) {
      lines.push(lineText);
    }
  }
}

const outLines = [];
outLines.push(`RAW_LINES ${lines.length}`);
lines.forEach((l, i) => outLines.push(`RAW [${i}]: ${l}`));
const preprocessed = preprocessNominaPdfLines(lines);
outLines.push(`PREPRO_LINES ${preprocessed.length}`);
preprocessed.forEach((l, i) => outLines.push(`PREPRO [${i}]: ${l}`));
const p = parseNominaMatrixFromTextLines(preprocessed, 'test.pdf');
outLines.push(
  JSON.stringify(
    {
      rangeStart: p.rangeStart,
      rangeEnd: p.rangeEnd,
      weeks: p.weekColumns.length,
      workers: p.stats.workerCount,
      grandTotal: p.grandTotal,
      warnings: p.stats.warnings,
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
  )
);

fs.mkdirSync('scratch', { recursive: true });
fs.writeFileSync('scratch/pdf-dump.txt', outLines.join('\n'));
console.log('Dump completed successfully to scratch/pdf-dump.txt');
