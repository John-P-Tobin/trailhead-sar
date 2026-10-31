import { describe, expect, it } from "vitest";
import { generatePriors } from "@/lib/engine/priors";
import { ALL_CELLS, distance } from "@/lib/engine/grid";
import { PROFILE_LIST, PROFILES } from "@/lib/profiles";
import { assertSumToOne, applySweep, total } from "@/lib/engine/bayes";
import { applyClue } from "@/lib/engine/clues";
import { DEFAULT_LKP, STYLIZED_TERRAIN } from "@/lib/terrain";

const cells = STYLIZED_TERRAIN.cells;

describe("generatePriors", () => {
  it.each(PROFILE_LIST.map((p) => [p.id, p]))("%s priors sum to 1 with 10% ROW", (_id, profile) => {
    const s = generatePriors(DEFAULT_LKP, profile, cells);
    expect(() => assertSumToOne(s)).not.toThrow();
    expect(s.row).toBeCloseTo(0.1);
    expect(Object.keys(s.cells)).toHaveLength(225);
  });

  it("boosts trail and drainage over plain cells at equal distance (day hiker)", () => {
    const s = generatePriors(DEFAULT_LKP, PROFILES.day_hiker, cells);
    // G9 (drainage) vs I9 (plain), both ~1.4 cells from H8
    expect(distance("H8", "G9")).toBeCloseTo(distance("H8", "I9"));
    expect(s.cells.G9).toBeGreaterThan(s.cells.I9);
    // H10 (trail) vs F8 (plain), both 2 cells
    expect(s.cells.H10).toBeGreaterThan(s.cells.F8);
  });

  it("reduces cliffs and open water", () => {
    const s = generatePriors("C6", PROFILES.day_hiker, cells);
    expect(cells.C3.cliff).toBe(true);
    expect(s.cells.C3).toBeLessThan(s.cells.B3);
    expect(s.cells.B9).toBeLessThan(s.cells.A9);
  });

  it("children stay closer to the LKP than trail runners", () => {
    const near = (s: ReturnType<typeof generatePriors>) =>
      ALL_CELLS.filter((c) => distance(DEFAULT_LKP, c) <= 2).reduce((a, c) => a + s.cells[c], 0);
    expect(near(generatePriors(DEFAULT_LKP, PROFILES.child, cells))).toBeGreaterThan(
      near(generatePriors(DEFAULT_LKP, PROFILES.trail_runner, cells)),
    );
  });

  it("rejects an unknown LKP", () => {
    expect(() => generatePriors("Z1", PROFILES.child, cells)).toThrow();
  });
});

describe("applyClue", () => {
  it("raises nearby cells, keeps sum at 1, and lowers ROW", () => {
    const s = generatePriors(DEFAULT_LKP, PROFILES.day_hiker, cells);
    const c = applyClue(s, "F10", 1, 2.5);
    expect(c.cells.F10 / s.cells.F10).toBeGreaterThan(c.cells.A1 / s.cells.A1);
    expect(c.row).toBeLessThan(s.row);
    expect(total(c)).toBeCloseTo(1, 12);
  });

  it("factor 1 changes nothing", () => {
    const s = generatePriors(DEFAULT_LKP, PROFILES.day_hiker, cells);
    const c = applyClue(s, "F10", 2, 1);
    expect(c.cells.F10).toBeCloseTo(s.cells.F10, 12);
  });

  it("chained updates stay normalized", () => {
    let s = generatePriors(DEFAULT_LKP, PROFILES.hunter, cells);
    for (const cell of ["H8", "H9", "H10", "G8", "I7"]) s = applySweep(s, cell, 0.7);
    s = applyClue(s, "E12", 2, 4);
    expect(() => assertSumToOne(s)).not.toThrow();
  });
});
