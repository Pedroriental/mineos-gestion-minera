import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function NominaVistaPreviaPage() {
  redirect('/mina/nomina?tool=vista');
}
