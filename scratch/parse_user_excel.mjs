import XLSX from 'xlsx';
import fs from 'fs';

const filePath = 'C:\\Users\\Manano\\Downloads\\Nomina Molinos la FE, Incluye  mina; MAYO 2026 4ta semana (2).xlsx';

async function run() {
  console.log(`Leyendo archivo: ${filePath}`);
  const workbook = XLSX.readFile(filePath);
  console.log('Hojas encontradas:', workbook.SheetNames);

  for (const sheetName of workbook.SheetNames) {
    console.log(`\n================ HOJA: ${sheetName} ================`);
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    console.log(`Total de filas en esta hoja: ${rows.length}`);
    
    // Imprimir las primeras 45 filas
    for (let i = 0; i < Math.min(45, rows.length); i++) {
      const row = rows[i];
      const lineText = row.map(c => String(c ?? '').trim()).join('\t|\t');
      console.log(`[Fila ${i + 1}]: ${lineText}`);
    }
  }
}

run();
