import { normalizeWorkerName, type WorkerMatchRecord } from '@/lib/nomina/worker-match';

export type FuzzyWorkerCandidate = {
  worker: WorkerMatchRecord;
  score: number;
  reason: string;
};

const DEFAULT_THRESHOLD = 0.85;
const DEFAULT_LIMIT = 5;

export function tokenizeName(name: string): string[] {
  return normalizeWorkerName(name).split(' ').filter(Boolean);
}

/** Variantes de orden (apellido primero, primer+último token). */
export function nameVariants(name: string): string[] {
  const tokens = tokenizeName(name);
  const variants = new Set<string>();
  const base = tokens.join(' ');
  if (base) variants.add(base);

  if (tokens.length >= 2) {
    variants.add([...tokens].reverse().join(' '));
    variants.add(`${tokens[0]} ${tokens[tokens.length - 1]}`);
    variants.add(`${tokens[tokens.length - 1]} ${tokens[0]}`);
  }

  return [...variants];
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const prev = new Array(b.length + 1);
  const curr = new Array(b.length + 1);

  for (let j = 0; j <= b.length; j += 1) prev[j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j += 1) prev[j] = curr[j];
  }

  return prev[b.length];
}

export function nameSimilarity(a: string, b: string): number {
  const left = normalizeWorkerName(a);
  const right = normalizeWorkerName(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  const maxLen = Math.max(left.length, right.length);
  if (!maxLen) return 0;
  return 1 - levenshteinDistance(left, right) / maxLen;
}

/** Busca candidatos por similitud; nunca auto-asigna. */
export function findFuzzyWorkerCandidates(
  excelName: string,
  workers: WorkerMatchRecord[],
  options?: { threshold?: number; limit?: number },
): FuzzyWorkerCandidate[] {
  const threshold = options?.threshold ?? DEFAULT_THRESHOLD;
  const limit = options?.limit ?? DEFAULT_LIMIT;
  const excelKey = normalizeWorkerName(excelName);
  if (!excelKey) return [];

  const seen = new Set<string>();
  const results: FuzzyWorkerCandidate[] = [];

  for (const worker of workers) {
    const dbKey = normalizeWorkerName(worker.nombre_completo);
    if (!dbKey) continue;

    const dedupeKey = worker.id ?? worker.cedula;
    if (seen.has(dedupeKey)) continue;

    for (const variant of nameVariants(excelName)) {
      if (variant === dbKey) {
        seen.add(dedupeKey);
        results.push({ worker, score: 1, reason: 'orden de nombre invertido' });
        break;
      }
    }

    if (seen.has(dedupeKey)) continue;

    const score = nameSimilarity(excelKey, dbKey);
    if (score >= threshold) {
      seen.add(dedupeKey);
      results.push({
        worker,
        score,
        reason: score >= 0.98 ? 'nombre casi idéntico' : 'nombre similar',
      });
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

export function mergeWorkerCandidates(
  primary: WorkerMatchRecord[] | undefined,
  fuzzy: FuzzyWorkerCandidate[],
): WorkerMatchRecord[] {
  const map = new Map<string, WorkerMatchRecord>();
  for (const w of primary ?? []) {
    map.set(w.id ?? w.cedula, w);
  }
  for (const f of fuzzy) {
    map.set(f.worker.id ?? f.worker.cedula, f.worker);
  }
  return [...map.values()];
}
