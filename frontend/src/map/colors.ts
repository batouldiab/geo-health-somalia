/** Class colour for a value against ascending upper bounds; `zero` for nothing or no data. */
export function rampColor(
  v: number | null,
  breaks: number[],
  ramp: string[],
  zero: string,
): string {
  if (v === null || v <= 0) return zero;
  for (let j = 0; j < breaks.length; j++) {
    if (v <= breaks[j]) return ramp[Math.min(j, ramp.length - 1)];
  }
  return ramp[ramp.length - 1];
}
