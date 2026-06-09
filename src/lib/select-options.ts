import type { AppSelectOption } from '@/components/ui/AppSelect';
import { getCanonicalList } from '@/lib/reports/report-engine';

/** Convierte listas crudas en opciones de select/combobox sin duplicados visibles. */
export function buildCanonicalSelectOptions(
  rawValues: (string | undefined | null)[],
): AppSelectOption[] {
  return getCanonicalList(rawValues).map((name) => ({
    value: name,
    label: name,
  }));
}

/** Une biblioteca (etiquetas legibles), historial y nodos base en una sola lista deduplicada. */
export function mergeMolinoSelectOptions(
  biblioteca: AppSelectOption[],
  history: (string | undefined | null)[],
  registeredNodes: readonly string[],
  labelMap: Record<string, string> = {},
): AppSelectOption[] {
  const raw: string[] = [];

  for (const opt of biblioteca) {
    const label = opt.label?.trim();
    const mapped = labelMap[opt.value]?.trim();
    if (label) raw.push(label);
    else if (mapped) raw.push(mapped);
    else if (opt.value?.trim()) raw.push(opt.value.trim());
  }

  for (const item of history) {
    const t = item?.trim();
    if (!t) continue;
    raw.push(labelMap[t] || t);
  }

  raw.push(...registeredNodes);

  return buildCanonicalSelectOptions(raw);
}
