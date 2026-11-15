// Axis scaling for the hand-rolled trend chart. Gridline labels must
// always be round, distinct figures — never a repeated £0 on a quiet
// window, and never a mid-bar value like £1,674 clipped by the bars.

const NICE_STEPS = [1, 2, 2.5, 5, 10];

/**
 * Smallest "nice" number >= value, from the 1 / 2 / 2.5 / 5 / 10 × 10^k
 * ladder. Returns 0 for non-positive input.
 */
export function niceCeiling(value) {
  if (!(value > 0)) return 0;
  const exp = Math.floor(Math.log10(value));
  const base = 10 ** exp;
  for (const step of NICE_STEPS) {
    const candidate = step * base;
    if (candidate >= value) return candidate;
  }
  return 10 * base;
}

/**
 * Axis maximum in minor units for the largest plotted value: a nice
 * number, floored at £1 so the labels stay distinct even when the
 * largest figure is a few pence.
 */
export function axisMax(maxMinor) {
  return Math.max(100, niceCeiling(maxMinor));
}

/** Gridline values for a window whose largest figure is `maxMinor`: 0, half, full. */
export function axisTicks(maxMinor) {
  const max = axisMax(maxMinor);
  return [0, Math.round(max / 2), max];
}
