// Per-cell elevation summaries from sampled points (USGS 3DEP via scripts/fetch-elevation.ts).
// Pure helpers shared by the script, the terrain model and tests.

export type Aspect = "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW" | "flat";

export interface CellElevation {
  minM: number;
  meanM: number;
  maxM: number;
  /** Steepness of the best-fit plane through the samples, degrees. */
  slopeDeg: number;
  /** Compass direction the slope faces (downhill direction). */
  aspect: Aspect;
}

export interface ElevationFile {
  source: string;
  attribution: string;
  fetchedAt: string;
  bbox: [number, number, number, number];
  samplesPerCell: number;
  cells: Record<string, CellElevation>;
}

export const STEEP_DEG = 35;
export const ELEVATION_ATTRIBUTION = "Elevation: USGS 3DEP";

interface Sample {
  /** metres east of the cell's origin */
  x: number;
  /** metres north of the cell's origin */
  y: number;
  /** metres above sea level */
  z: number;
}

const ASPECTS: Aspect[] = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

/** Least-squares plane z = a·x + b·y + c; slope from the gradient, aspect from the downhill direction. */
export function fitSlope(samples: Sample[]): { slopeDeg: number; aspect: Aspect } {
  const n = samples.length;
  if (n < 3) return { slopeDeg: 0, aspect: "flat" };
  const mx = samples.reduce((s, p) => s + p.x, 0) / n;
  const my = samples.reduce((s, p) => s + p.y, 0) / n;
  const mz = samples.reduce((s, p) => s + p.z, 0) / n;
  let sxx = 0, sxy = 0, syy = 0, sxz = 0, syz = 0;
  for (const p of samples) {
    const dx = p.x - mx, dy = p.y - my, dz = p.z - mz;
    sxx += dx * dx; sxy += dx * dy; syy += dy * dy; sxz += dx * dz; syz += dy * dz;
  }
  const det = sxx * syy - sxy * sxy;
  if (Math.abs(det) < 1e-9) return { slopeDeg: 0, aspect: "flat" };
  const a = (sxz * syy - syz * sxy) / det; // dz/dx
  const b = (syz * sxx - sxz * sxy) / det; // dz/dy
  const grad = Math.hypot(a, b);
  const slopeDeg = (Math.atan(grad) * 180) / Math.PI;
  if (slopeDeg < 1) return { slopeDeg: Math.round(slopeDeg * 10) / 10, aspect: "flat" };
  // Downhill vector is (-a, -b); compass bearing clockwise from north (y points north).
  const bearing = ((Math.atan2(-a, -b) * 180) / Math.PI + 360) % 360;
  const aspect = ASPECTS[Math.round(bearing / 45) % 8];
  return { slopeDeg: Math.round(slopeDeg * 10) / 10, aspect };
}

export function summarizeCell(samples: Sample[]): CellElevation {
  const zs = samples.map((p) => p.z).filter((z) => Number.isFinite(z));
  if (!zs.length) return { minM: 0, meanM: 0, maxM: 0, slopeDeg: 0, aspect: "flat" };
  const minM = Math.min(...zs);
  const maxM = Math.max(...zs);
  const meanM = Math.round((zs.reduce((a, b) => a + b, 0) / zs.length) * 10) / 10;
  const { slopeDeg, aspect } = fitSlope(samples.filter((p) => Number.isFinite(p.z)));
  return { minM: Math.round(minM * 10) / 10, meanM, maxM: Math.round(maxM * 10) / 10, slopeDeg, aspect };
}
