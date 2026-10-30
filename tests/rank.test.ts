import { describe, expect, it } from "vitest";
import { expectedPod, rankCells, WELL_SEARCHED } from "@/lib/engine/rank";
import { generatePriors } from "@/lib/engine/priors";
import { PROFILES } from "@/lib/profiles";
import { DEFAULT_LKP } from "@/lib/terrain";

const prior = () => generatePriors(DEFAULT_LKP, PROFILES.day_hiker);

describe("rankCells", () => {
  it("returns the top 5 by POA × expected POD, descending", () => {
    const s = rankCells(prior(), {});
    expect(s).toHaveLength(5);
    for (let i = 1; i < s.length; i++) expect(s[i - 1].score).toBeGreaterThanOrEqual(s[i].score);
    for (const x of s) expect(x.score).toBeCloseTo(x.poa * x.expectedPod, 12);
  });

  it("skips well-searched cells", () => {
    const top = rankCells(prior(), {})[0].cell;
    const s = rankCells(prior(), { [top]: WELL_SEARCHED });
    expect(s.map((x) => x.cell)).not.toContain(top);
  });

  it("weather lowers expected POD but keeps order for a uniform factor", () => {
    const a = rankCells(prior(), {});
    const b = rankCells(prior(), {}, 0.7);
    expect(b.map((x) => x.cell)).toEqual(a.map((x) => x.cell));
    expect(b[0].expectedPod).toBeCloseTo(a[0].expectedPod * 0.7);
  });

  it("thick spruce and cliffs have lower expected POD than open ground", () => {
    expect(expectedPod("C9")).toBeGreaterThan(expectedPod("H8")); // open vs spruce
    expect(expectedPod("C3")).toBeLessThanOrEqual(0.3); // cliff
  });
});
