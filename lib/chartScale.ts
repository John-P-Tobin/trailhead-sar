// Tiny scale helpers for the SVG forecast chart. Pure and unit-tested.

/** A padded domain rounded outward to multiples of `step`. [] → [0, 1]; a single value gets ±pad. */
export function niceDomain(values: number[], pad = 5, step = 5): [number, number] {
  const v = values.filter((x) => Number.isFinite(x));
  if (!v.length) return [0, 1];
  let lo = Math.min(...v);
  let hi = Math.max(...v);
  if (lo === hi) {
    lo -= pad;
    hi += pad;
  }
  lo = Math.floor((lo - pad) / step) * step;
  hi = Math.ceil((hi + pad) / step) * step;
  return [lo, hi];
}

export function scaleLinear(domain: [number, number], range: [number, number]): (v: number) => number {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const k = d1 === d0 ? 0 : (r1 - r0) / (d1 - d0);
  return (v: number) => r0 + (v - d0) * k;
}
