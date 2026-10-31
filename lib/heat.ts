// Heatmap scale shared by the map and the CalTopo export:
// yellow → orange → red for t in [0, 1] (t = cell POA / highest cell POA).

const clamp01 = (t: number) => (Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 0);

export function heatHsl(t: number): { h: number; s: number; l: number } {
  const c = clamp01(t);
  return { h: 55 - 55 * c, s: 95, l: 55 - 8 * c };
}

export const heatCss = (t: number) => {
  const { h, s, l } = heatHsl(t);
  return `hsl(${h}, ${s}%, ${l}%)`;
};

export const heatOpacity = (t: number) => 0.08 + 0.62 * clamp01(t);

/** The same color as heatCss, as #rrggbb (for GeoJSON/KML styles). */
export function heatHex(t: number): string {
  const { h, s, l } = heatHsl(t);
  const sat = s / 100;
  const lig = l / 100;
  const a = sat * Math.min(lig, 1 - lig);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const v = lig - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(v * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** Hypsometric tint for a normalised elevation (0 valley → 1 summit): green → tan → pale grey. */
export function hypsoCss(t: number): string {
  const x = Math.min(1, Math.max(0, t));
  const stops: [number, [number, number, number]][] = [
    [0, [45, 90, 61]],
    [0.35, [120, 130, 70]],
    [0.65, [176, 138, 78]],
    [0.85, [205, 190, 170]],
    [1, [243, 244, 246]],
  ];
  for (let i = 1; i < stops.length; i++) {
    const [t0, c0] = stops[i - 1];
    const [t1, c1] = stops[i];
    if (x <= t1) {
      const k = (x - t0) / (t1 - t0);
      const c = c0.map((v, j) => Math.round(v + (c1[j] - v) * k));
      return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
    }
  }
  return "rgb(243, 244, 246)";
}
