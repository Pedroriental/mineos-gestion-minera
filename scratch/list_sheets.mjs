import XLSX from 'xlsx';

const filePath = 'C:/Users/Manano/Downloads/Nomina Molinos la FE, Incluye  mina; MAYO 2026 5ta semana.xlsx';

const wb = XLSX.readFile(filePath);
console.log('Sheet Names:', wb.SheetNames);
for (const name of wb.SheetNames) {
  const sheet = wb.Sheets[name];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  console.log(`- Sheet: ${name}, Total Rows: ${rows.length}`);
}
