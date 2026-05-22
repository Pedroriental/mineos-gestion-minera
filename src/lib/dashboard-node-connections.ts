/**
 * Conexiones del mapa operacional — derivadas de molinos fusionados reales
 * (nombres registrados en Producción / nodos visibles en el dashboard).
 */

export type NodeConnectionPair = [string, string];

function pairKey(a: string, b: string): string {
  return [a, b].sort().join('\0');
}

function addPair(
  store: Map<string, NodeConnectionPair>,
  names: Set<string>,
  a: string,
  b: string,
) {
  if (a === b || !names.has(a) || !names.has(b)) return;
  store.set(pairKey(a, b), [a, b]);
}

/** "Molino 1-3" → ["Molino 1", "Molino 3"] */
export function parseFusedMolinoComponents(name: string): string[] | null {
  const match = /^Molino\s+(\d+(?:-\d+)+)$/i.exec(name.trim());
  if (!match) return null;
  return match[1].split('-').map((n) => `Molino ${n}`);
}

/**
 * Genera aristas solo si hay un molino fusionado registrado en el mapa
 * (nombre tipo Molino 1-3, Molino 2-3, etc. desde Producción).
 */
export function deriveNodeConnectionPairs(
  locations: { name: string }[],
): NodeConnectionPair[] {
  const names = new Set(locations.map((l) => l.name.trim()));
  const pairs = new Map<string, NodeConnectionPair>();

  for (const name of names) {
    const components = parseFusedMolinoComponents(name);
    if (!components || components.length < 2) continue;

    const segments = name.match(/^Molino\s+(\d+(?:-\d+)+)$/i)![1].split('-');

    for (const base of components) {
      addPair(pairs, names, name, base);
    }

    for (let i = 0; i < segments.length - 1; i++) {
      const left = `Molino ${segments[i]}`;
      const fusedStep = `Molino ${segments.slice(0, i + 2).join('-')}`;
      addPair(pairs, names, left, fusedStep);

      if (i === segments.length - 2) {
        const right = `Molino ${segments[segments.length - 1]}`;
        addPair(pairs, names, fusedStep, right);
      }
    }
  }

  return [...pairs.values()];
}
