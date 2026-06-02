import XLSX from 'xlsx';

const filePath = 'C:/Users/Manano/Downloads/Nomina Molinos la FE, Incluye  mina; MAYO 2026 5ta semana.xlsx';

const wb = XLSX.readFile(filePath);
for (const sheetName of wb.SheetNames) {
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowText = row.map(c => String(c ?? '').trim()).join(' ');
    if (rowText.toLowerCase().includes('rafael diaz')) {
      console.log(`Sheet: ${sheetName}, Row: ${i + 1}`);
      row.forEach((cell, cellIdx) => {
        console.log(`  Cell [${cellIdx}]: type=${typeof cell}, value=${JSON.stringify(cell)}`);
      });
    }
  }
}
