import jsPDF from 'jspdf';

interface CredentialUser {
  email: string;
  display_name: string;
  role: string;
}

interface CredentialData {
  complex: { name: string; slug: string };
  users: CredentialUser[];
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  mining_supervisor: 'Supervisor de Mina',
  mill_supervisor: 'Supervisor de Molino',
};

export function generateCredentialPDF(data: CredentialData): Blob {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 20;
  let y = 30;

  // Header
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('MineOS — Credenciales de Acceso', pageW / 2, y, { align: 'center' });
  y += 10;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Complejo: ${data.complex.name}`, pageW / 2, y, { align: 'center' });
  y += 6;
  doc.text(`Fecha de generación: ${new Date().toLocaleDateString('es-PE')}`, pageW / 2, y, { align: 'center' });
  y += 12;

  // Divider
  doc.setDrawColor(200);
  doc.line(margin, y, pageW - margin, y);
  y += 10;

  // Instructions
  doc.setFontSize(10);
  doc.setFont('helvetica', 'italic');
  doc.text(
    'Estas credenciales son de uso confidencial. Distribuir solo al personal autorizado.',
    pageW / 2,
    y,
    { align: 'center' },
  );
  y += 12;

  // Users
  for (const user of data.users) {
    // Check if we need a new page
    if (y > 250) {
      doc.addPage();
      y = 30;
    }

    const roleLabel = ROLE_LABELS[user.role] ?? user.role;

    // Card background
    doc.setFillColor(248, 248, 248);
    doc.roundedRect(margin, y - 4, pageW - margin * 2, 32, 3, 3, 'F');

    // Name
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(user.display_name, margin + 8, y + 6);

    // Role badge
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 120, 120);
    doc.text(roleLabel, margin + 8, y + 14);
    doc.setTextColor(0);

    // Email
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`Email: ${user.email}`, margin + 8, y + 22);

    y += 38;
  }

  // Footer
  if (y > 260) {
    doc.addPage();
    y = 30;
  }
  y += 10;
  doc.setDrawColor(200);
  doc.line(margin, y, pageW - margin, y);
  y += 8;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(150);
  doc.text(
    'MineOS — Sistema de Gestión Minera | Generado automáticamente',
    pageW / 2,
    y,
    { align: 'center' },
  );

  return doc.output('blob');
}

export function downloadCredentialPDF(data: CredentialData) {
  const blob = generateCredentialPDF(data);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `credenciales-${data.complex.slug}-${new Date().toISOString().slice(0, 10)}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
