import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { ElevationFile, fitSlope, summarizeCell } from "@/lib/elevation";

const grid = (z: (x: number, y: number) => number) => {
  const pts = [];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) pts.push({ x: i * 66, y: j * 74, z: z(i * 66, j * 74) });
  return pts;
};

describe("plane fit", () => {
  it("rising to the east gives a west-facing slope of ~26.6°", () => {
    const r = fitSlope(grid((x) => 1500 + 0.5 * x));
    expect(r.slopeDeg).toBeCloseTo(26.57, 1);
    expect(r.aspect).toBe("W");
  });

  it("falling to the north gives a north-facing 45° slope", () => {
    const r = fitSlope(grid((_x, y) => 1500 - 1 * y));
    expect(r.slopeDeg).toBeCloseTo(45, 1);
    expect(r.aspect).toBe("N");
  });

  it("flat ground is flat", () => {
    const r = fitSlope(grid(() => 1200));
    expect(r.slopeDeg).toBe(0);
    expect(r.aspect).toBe("flat");
  });

  it("summarizeCell reports min, mean, max and degrades gracefully with too few samples", () => {
    const s = summarizeCell(grid((x, y) => 1500 + (x + y) / 10));
    expect(s.minM).toBe(1500);
    expect(s.maxM).toBeCloseTo(1500 + (198 + 222) / 10, 6);
    expect(s.meanM).toBeGreaterThan(s.minM);
    expect(s.meanM).toBeLessThan(s.maxM);
    const few = summarizeCell([{ x: 0, y: 0, z: 1000 }, { x: 10, y: 0, z: 1010 }]);
    expect(few.slopeDeg).toBe(0);
    expect(few.aspect).toBe("flat");
    expect(Number.isFinite(few.meanM)).toBe(true);
  });
});

describe("bundled elevation grid", () => {
  const path = new URL("../data/elevation.json", import.meta.url);
  it.skipIf(!existsSync(path))("covers all 225 cells with finite values and sensible landmarks", () => {
    const file = JSON.parse(readFileSync(path, "utf8")) as ElevationFile;
    expect(Object.keys(file.cells)).toHaveLength(225);
    for (const c of Object.values(file.cells)) {
      for (const v of [c.minM, c.meanM, c.maxM, c.slopeDeg]) expect(Number.isFinite(v)).toBe(true);
      expect(c.minM).toBeLessThanOrEqual(c.meanM);
      expect(c.meanM).toBeLessThanOrEqual(c.maxM);
    }
    expect(file.cells.J6.maxM).toBeGreaterThan(1880); // Mount Washington summit cell
    expect(file.cells.G14.meanM).toBeLessThan(file.cells.G13.meanM); // Dry River falls south
    expect(file.attribution).toMatch(/Copernicus|USGS/);
  });
});
