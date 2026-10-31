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
