import XLSX from 'xlsx';

const filePath = 'C:\\Users\\Manano\\Downloads\\Nomina Molinos la FE, Incluye  mina; MAYO 2026 4ta semana (2).xlsx';

function normAmount(raw) {
  if (typeof raw === 'number') return raw;
  const s = String(raw).trim();
  if (!s) return 0;

  // Si tiene coma y punto (ej. 1.234,56 o 1,234.56)
  if (s.includes(',') && s.includes('.')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
    } else {
      return parseFloat(s.replace(/,/g, '')) || 0;
    }
  }

  // Si solo tiene comas
  if (s.includes(',')) {
    const parts = s.split(',');
    if (parts.length === 2 && parts[1].length !== 3) {
      return parseFloat(s.replace(',', '.')) || 0;
    }
    return parseFloat(s.replace(/,/g, '')) || 0;
  }

  // Si solo tiene puntos
  if (s.includes('.')) {
    const parts = s.split('.');
    if (parts.length === 2 && parts[1].length <= 2) {
      return parseFloat(s) || 0;
    }
    return parseFloat(s.replace(/\./g, '')) || 0;
  }

  return parseFloat(s) || 0;
}

async function run() {
  const workbook = XLSX.readFile(filePath);
  let totalMonto = 0;
  let detectedWorkers = 0;
  
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];
      if (!row || !row.length) continue;
      
      const rowText = row.map((c) => String(c ?? '').trim()).join(' ');
      
      // Check if it's a worker row by finding a C.I.
      let ciIdx = -1;
      let ciValue = '';
      for (let i = 0; i < row.length; i++) {
        const cell = row[i];
        if (!cell) continue;
        const s = String(cell).trim();
        if (/^\d{1,2}\.\d{3}\.\d{3}$/.test(s) || /^\d{6,9}$/.test(s)) {
          ciIdx = i;
          ciValue = s.replace(/[^0-9]/g, '');
          break;
        }
      }
      
      if (ciIdx >= 0) {
        // Parse worker row
        detectedWorkers++;
        let workerName = '';
        for (let i = 0; i < ciIdx; i++) {
          const s = String(row[i] ?? '').trim();
          if (s) workerName += (workerName ? ' ' : '') + s;
        }
        
        // Let's get the weekly amounts starting after C.I.
        // We know that for worker rows, we scan numeric values
        const numericAmounts = [];
        for (let i = ciIdx + 2; i < row.length; i++) {
          const raw = row[i];
          if (raw === '' || raw === null || raw === undefined) continue;
          const s = String(raw).trim();
          if (/^total/i.test(s) || /^el trabajador/i.test(s)) break;
          const val = normAmount(raw);
          if (val > 0) numericAmounts.push(val);
        }
        
        // Sum values (the columns before the total)
        // If there's a total column, the last numeric amount is the total. Let's see how they match.
        // Let's print out what we found for this worker
        console.log(`Trabajador: ${workerName} (C.I. ${ciValue}) -> Valores crudos:`, row.slice(ciIdx + 2).filter(Boolean));
        console.log(`  Valores numéricos normalizados:`, numericAmounts);
      }
    }
  }
}

run();
