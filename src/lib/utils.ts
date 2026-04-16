/**
 * Merges class names, filtering falsy values.
 * Minimal implementation — no external deps required.
 * For conflict resolution, last class wins (native Tailwind 4 behaviour).
 */
export function cn(...inputs: (string | undefined | null | false | 0)[]): string {
  return inputs.filter(Boolean).join(' ');
}

