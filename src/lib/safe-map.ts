export function safeMap<T, U>(
  arr: T[] | undefined | null,
  fn: (item: T, index: number) => U,
): U[] {
  return (arr ?? []).map(fn);
}
