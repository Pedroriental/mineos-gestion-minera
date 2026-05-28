import { redirect } from 'next/navigation';

/** Ruta anterior — redirige al nombre oficial. */
export default function DiccionarioVariablesRedirectPage() {
  redirect('/plataforma/biblioteca-variables');
}
