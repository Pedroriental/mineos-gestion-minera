import fs from 'node:fs';
import path from 'node:path';
import XLSX from 'xlsx';
import { parseNominaMatrixFromTextLines, preprocessNominaPdfLines, parseExcelNominaMatrix } from '../src/lib/nomina/import-parser.ts';
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
import { pathToFileURL } from 'url';

// Configurar pdfjs para node
const workerPath = pathToFileURL(
  path.join(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs')
).href;
pdfjs.GlobalWorkerOptions.workerSrc = workerPath;

async function run() {
  const pdfPath = 'C:/Users/Manano/Downloads/Nomina Molinos la FE, Incluye  mina; MAYO 2026 5ta semana.pdf';
  const xlsxPath = 'C:/Users/Manano/Downloads/Nomina Molinos la FE, Incluye  mina; MAYO 2026 5ta semana.xlsx';

  const outLines = [];

  // --- PARSEAR EXCEL ---
  if (fs.existsSync(xlsxPath)) {
    const wb = XLSX.readFile(xlsxPath);
    const pExcel = parseExcelNominaMatrix(wb, 'test.xlsx');
    outLines.push('=== EXCEL RESULTS ===');
    outLines.push(`Grand Total: ${pExcel.grandTotal}`);
    outLines.push(`Workers Count: ${pExcel.stats.workerCount}`);
    pExcel.sections.forEach(s => {
      outLines.push(`Section: "${s.title}" (Rows: ${s.rows.length}, Total: ${s.sectionTotal})`);
      s.rows.forEach(r => {
        outLines.push(`  - ${r.nombre_completo} (C.I. ${r.cedula}, Total: ${r.total}, Valid: ${r._valid}, Error: ${r._error})`);
      });
    });
  }

  // --- PARSEAR PDF (con agrupamiento por tolerancia de 4.0 y ordenamiento horizontal) ---
  if (fs.existsSync(pdfPath)) {
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

    outLines.push('\n=== PDF RAW LINES ===');
    lines.forEach((l, i) => outLines.push(`RAW [${i}]: ${l}`));
    
    const preprocessed = preprocessNominaPdfLines(lines);
    outLines.push('\n=== PDF PREPRO LINES ===');
    preprocessed.forEach((l, i) => outLines.push(`PREPRO [${i}]: ${l}`));
    
    const pPdf = parseNominaMatrixFromTextLines(preprocessed, 'test.pdf');
    
    outLines.push('\n=== PDF RESULTS (Tolerance Y) ===');
    outLines.push(`Grand Total: ${pPdf.grandTotal}`);
    outLines.push(`Workers Count: ${pPdf.stats.workerCount}`);
    pPdf.sections.forEach(s => {
      outLines.push(`Section: "${s.title}" (Rows: ${s.rows.length}, Total: ${s.sectionTotal})`);
      s.rows.forEach(r => {
        outLines.push(`  - ${r.nombre_completo} (C.I. ${r.cedula}, Total: ${r.total}, Valid: ${r._valid}, Error: ${r._error})`);
      });
    });
  }

  fs.mkdirSync('scratch', { recursive: true });
  fs.writeFileSync('scratch/5ta-week-dump.txt', outLines.join('\n'));
  console.log('Comparison completed. Dump saved to scratch/5ta-week-dump.txt');
}

run();
