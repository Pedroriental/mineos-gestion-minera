import type { BibliotecaAppSnapshot } from '@/lib/biblioteca-catalog';
import { getBibliotecaValues, loadBibliotecaAppSnapshot } from '@/lib/biblioteca-catalog';

export async function assertBibliotecaValue(
  slug: string,
  value: string,
  label: string,
  snapshot?: BibliotecaAppSnapshot,
): Promise<void> {
  const snap = snapshot ?? (await loadBibliotecaAppSnapshot());
  const allowed = getBibliotecaValues(snap, slug);
  if (!allowed.length) return;
  if (!allowed.includes(value)) {
    throw new Error(`${label} no válido. Valores permitidos: ${allowed.join(', ')}`);
  }
}
