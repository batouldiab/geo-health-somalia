/** Whole numbers with thousands separators; "-" for nothing. */
export function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined) return '-';
  n = Math.round(n);
  if (Math.abs(n) >= 1000) return n.toLocaleString();
  return '' + n;
}
