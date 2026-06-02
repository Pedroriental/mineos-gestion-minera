import fs from 'fs';
import path from 'path';

const filesToProcess = [
  "src/components/ui/GlobalDateRangePicker.tsx",
  "src/components/reportes/ReconciliacionDateField.tsx",
  "src/components/nomina/nomina-mobile.tsx",
  "src/components/nomina/NominaArchivoModal.tsx",
  "src/components/nomina/PersonalQuickAssignModal.tsx",
  "src/components/nomina/TrabajadoresRegistryClient.tsx",
  "src/components/nomina/NominaArchivoPanel.tsx",
  "src/components/nomina/NominaClient.tsx",
  "src/components/nomina/NominaArchivoBrowser.tsx",
  "src/components/nomina/NominaVistaPreviaContent.tsx",
  "src/app/(app)/reportes-balances/ReportesClient.tsx",
  "src/app/(app)/planta/arenas/page.tsx",
  "src/app/(app)/planta/recepcion/page.tsx",
  "src/app/(app)/planta/procesamiento/page.tsx",
  "src/app/(app)/planta/produccion/ProduccionGerencialClient.tsx",
  "src/app/(app)/operaciones/guardia/page.tsx",
  "src/app/(app)/mina/seguridad/page.tsx",
  "src/app/(app)/mina/voladuras/VoladurasClient.tsx",
  "src/app/(app)/mina/quemado/QuemadoClient.tsx",
  "src/app/(app)/mina/extraccion/ExtraccionGerencialClient.tsx",
  "src/app/(app)/admin/compras/page.tsx"
];

for (const file of filesToProcess) {
  const filePath = path.resolve('c:/Users/Manano/Documents/mineos-gestion-minera', file);
  if (!fs.existsSync(filePath)) {
    console.log(`Skipping ${file}`);
    continue;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  let replaced = false;

  const regex1 = /<input\s+(?:className="[^"]*"\s+)?type="date"\s+value={([^}]+)}\s+onChange={([^=]+)\s*=>\s*([^}]+)}\s*(?:className="[^"]*"\s*)?\/>/g;
  
  content = content.replace(regex1, (match, valExpr, eventVar, body) => {
     replaced = true;
     const newBody = body.replace(new RegExp(`${eventVar.trim()}\\.target\\.value`, 'g'), 'val');
     return `<AppDatePicker value={${valExpr}} onChange={(val) => ${newBody}} />`;
  });
  
  const regex2 = /<input\s+(?:className="[^"]*"\s+)?type="date"\s+value={([^}]+)}\s+onChange={([^}]+)}\s*(?:className="[^"]*"\s*)?\/>/g;
  
  content = content.replace(regex2, (match, valExpr, onChangeContent) => {
    if (match.includes('AppDatePicker')) return match;
    const arrowMatch = onChangeContent.match(/([^=]+)\s*=>\s*(.*)/s);
    if (arrowMatch) {
       replaced = true;
       const [_, eventVar, body] = arrowMatch;
       const newBody = body.replace(new RegExp(`${eventVar.trim()}\\.target\\.value`, 'g'), 'val');
       return `<AppDatePicker value={${valExpr}} onChange={(val) => ${newBody}} />`;
    }
    return match;
  });

  if (replaced && !content.includes('AppDatePicker')) {
      content = `import { AppDatePicker } from '@/components/ui/AppDatePicker';\n` + content;
  }
  
  if (replaced) {
      if (!content.includes(`import { AppDatePicker }`)) {
          const lastImportIndex = content.lastIndexOf('import ');
          const endOfLine = content.indexOf('\n', lastImportIndex);
          content = content.substring(0, endOfLine + 1) + `import { AppDatePicker } from '@/components/ui/AppDatePicker';\n` + content.substring(endOfLine + 1);
      }
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Updated ${file}`);
  }
}
