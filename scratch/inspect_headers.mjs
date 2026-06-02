import XLSX from 'xlsx';

const filePath = 'C:/Users/Manano/Downloads/Nomina Molinos la FE, Incluye  mina; MAYO 2026 5ta semana.xlsx';

const wb = XLSX.readFile(filePath);
const sheet = wb.Sheets['Table 1'];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
for (let i = 14; i <= 22; i++) {
  const row = rows[i];
  if (row) {
    console.log(`Row ${i + 1}:`, row.map((c, idx) => `[${idx}]:${JSON.stringify(c)}`).join(' | '));
  }
}
