/** Parser matricial PDF — Mina + Molinos en un mismo documento */
import {
  parseNominaMatrixFromTextLines,
  preprocessNominaPdfLines,
} from '@/lib/nomina/import-parser';
import type { ParsedNominaPeriod } from '@/lib/nomina/types';

async function extractPdfTextLines(file: File): Promise<string[]> {
  const pdfjsLib = await import('pdfjs-dist');
  // Worker local en /public/ — funciona offline, sin dependencia de CDN
  (pdfjsLib as unknown as { GlobalWorkerOptions: { workerSrc: string } }).GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const lines: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();

    type TextItem = { str: string; transform: number[] };
    const items = (content.items as TextItem[])
      .map(item => {
        if (!item.str) return null;
        return {
          str: item.str,
          x: item.transform[4],
          y: item.transform[5]
        };
      })
      .filter(Boolean) as Array<{ str: string; x: number; y: number }>;
      
    const TOLERANCE = 4.0;
    const linesGrouped: Array<{ y: number; items: Array<{ str: string; x: number; y: number }> }> = [];
    
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

  return lines;
}

export async function parsePdfNominaMatrix(file: File): Promise<ParsedNominaPeriod> {
  const rawLines = await extractPdfTextLines(file);
  const lines = preprocessNominaPdfLines(rawLines);
  const period = parseNominaMatrixFromTextLines(lines, file.name);

  const areas = new Set(period.sections.map((s) => s.area));
  if (areas.size > 1) {
    period.stats.warnings.push(
      `Documento combinado detectado: ${[...areas].join(', ')} (${period.sections.length} secciones).`,
    );
  } else if (!areas.has('planta') && /molino/i.test(file.name + lines.slice(0, 40).join(' '))) {
    period.stats.warnings.push(
      'El PDF parece incluir Molinos pero no se detectaron secciones de planta — revise encabezados.',
    );
  }

  return period;
}

export { extractPdfTextLines };
