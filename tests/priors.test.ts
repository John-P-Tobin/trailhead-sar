import { describe, expect, it } from "vitest";
import { generatePriors, priorSummary } from "@/lib/engine/priors";
import { ALL_CELLS, distance } from "@/lib/engine/grid";
import { PROFILE_LIST } from "@/lib/profiles";
import { assertSumToOne, applySweep, total } from "@/lib/engine/bayes";
import { applyClue } from "@/lib/engine/clues";
import { DEFAULT_LKP, STYLIZED_TERRAIN } from "@/lib/terrain";
import { defaultSubject } from "@/lib/subject";

const cells = STYLIZED_TERRAIN.cells;
const now = Date.parse("2026-10-31T02:00:00Z");
const subj = (id: Parameters<typeof defaultSubject>[0]) => defaultSubject(id, now);
const opts = { now };

describe("generatePriors", () => {
  it.each(PROFILE_LIST.map((p) => [p.id, p.id]))("%s priors sum to 1 with 10% ROW", (_id, id) => {
    const s = generatePriors(DEFAULT_LKP, subj(id), cells, opts);
    expect(() => assertSumToOne(s)).not.toThrow();
    expect(s.row).toBeCloseTo(0.1);
    expect(Object.keys(s.cells)).toHaveLength(225);
    for (const v of Object.values(s.cells)) expect(Number.isFinite(v) && v >= 0).toBe(true);
  });

  it("boosts trail and drainage over plain cells at equal distance (day hiker)", () => {
    const s = generatePriors(DEFAULT_LKP, subj("day_hiker"), cells, opts);
    // G9 (drainage) vs I9 (plain), both ~1.4 cells from H8
    expect(distance("H8", "G9")).toBeCloseTo(distance("H8", "I9"));
    expect(s.cells.G9).toBeGreaterThan(s.cells.I9);
    // H10 (trail) vs F8 (plain), both 2 cells
    expect(s.cells.H10).toBeGreaterThan(s.cells.F8);
  });

  it("reduces cliffs and open water", () => {
    const s = generatePriors("C6", subj("day_hiker"), cells, opts);
    expect(cells.C3.cliff).toBe(true);
    expect(s.cells.C3).toBeLessThan(s.cells.B3);
    expect(s.cells.B9).toBeLessThan(s.cells.A9);
  });

  it("children stay closer to the LKP than trail runners", () => {
    const near = (s: ReturnType<typeof generatePriors>) =>
      ALL_CELLS.filter((c) => distance(DEFAULT_LKP, c) <= 2).reduce((a, c) => a + s.cells[c], 0);
    expect(near(generatePriors(DEFAULT_LKP, subj("child"), cells, opts))).toBeGreaterThan(
      near(generatePriors(DEFAULT_LKP, subj("trail_runner"), cells, opts)),
    );
  });

  it("the map spreads out as hours pass", () => {
    const near = (s: ReturnType<typeof generatePriors>) =>
      ALL_CELLS.filter((c) => distance(DEFAULT_LKP, c) <= 2).reduce((a, c) => a + s.cells[c], 0);
    const h1 = generatePriors(DEFAULT_LKP, subj("day_hiker"), cells, { hoursElapsed: 0.5 });
    const h10 = generatePriors(DEFAULT_LKP, subj("day_hiker"), cells, { hoursElapsed: 10 });
    expect(near(h1)).toBeGreaterThan(near(h10));
  });

  it("most probability sits close to the LKP (per-cell density falls with distance)", () => {
    const s = generatePriors(DEFAULT_LKP, subj("day_hiker"), cells, opts);
    const top = Object.entries(s.cells).sort((a, b) => b[1] - a[1])[0][0];
    expect(distance(DEFAULT_LKP, top)).toBeLessThanOrEqual(1.5);
  });

  it("rejects an unknown LKP", () => {
    expect(() => generatePriors("Z1", subj("child"), cells, opts)).toThrow();
  });

  it("summarises reach, quartiles and a suggested ROW that grows with time", () => {
    const early = priorSummary(DEFAULT_LKP, subj("older_adult"), cells, { hoursElapsed: 0.5 });
    const late = priorSummary(DEFAULT_LKP, subj("older_adult"), cells, { hoursElapsed: 12 });
    expect(early.nearestEdgeKm).toBeGreaterThan(1);
    expect(early.reachKm).toBeLessThan(late.reachKm);
    expect(early.suggestedRow).toBeLessThanOrEqual(late.suggestedRow);
    expect(late.quartilesKm[1]).toBeCloseTo(0.8 * 0.8 * 0.8, 6); // older_65 × low fitness
  });
});

describe("applyClue", () => {
  it("raises nearby cells, keeps sum at 1, and lowers ROW", () => {
    const s = generatePriors(DEFAULT_LKP, subj("day_hiker"), cells, opts);
    const c = applyClue(s, "F10", 1, 2.5);
    expect(c.cells.F10 / s.cells.F10).toBeGreaterThan(c.cells.A1 / s.cells.A1);
    expect(c.row).toBeLessThan(s.row);
    expect(total(c)).toBeCloseTo(1, 12);
  });

  it("factor 1 changes nothing", () => {
    const s = generatePriors(DEFAULT_LKP, subj("day_hiker"), cells, opts);
    const c = applyClue(s, "F10", 2, 1);
    expect(c.cells.F10).toBeCloseTo(s.cells.F10, 12);
  });

  it("chained updates stay normalized", () => {
    let s = generatePriors(DEFAULT_LKP, subj("hunter"), cells, opts);
    for (const cell of ["H8", "H9", "H10", "G8", "I7"]) s = applySweep(s, cell, 0.7);
    s = applyClue(s, "E12", 2, 4);
    expect(() => assertSumToOne(s)).not.toThrow();
  });
});
