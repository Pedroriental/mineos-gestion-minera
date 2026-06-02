import XLSX from 'xlsx';

const filepath = 'C:/Users/Manano/Downloads/Nomina Molinos la FE, Incluye  mina; MAYO 2026 4ta semana (2).xlsx';
const workbook = XLSX.readFile(filepath);

const sheet = workbook.Sheets['Table 2'];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

console.log('Table 2 rows count:', rows.length);
for (let r = 26; r < rows.length; r++) {
  const row = rows[r];
  console.log(`\nRow ${r}:`);
  for (let c = 0; c < row.length; c++) {
    console.log(`  Col ${c}: [${typeof row[c]}] -> "${row[c]}"`);
  }
}
