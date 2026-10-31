import { describe, expect, it } from "vitest";
import { hazardsNearLkp, scoreUrgency, URGENCY_FACTORS, urgencyFactors } from "@/lib/engine/urgency";
import { defaultSubject } from "@/lib/subject";
import { STYLIZED_TERRAIN } from "@/lib/terrain";

const now = Date.parse("2026-10-31T02:00:00Z");
const calm = { exposureNow: "low" as const, exposureSoon: "low" as const, hazardsNearLkp: false };

describe("relative urgency chart", () => {
  it("has the seven standard factors scored 1–3 with a total between 7 and 21", () => {
    const f = urgencyFactors(defaultSubject("day_hiker", now), calm);
    expect(f.map((x) => x.key)).toEqual(URGENCY_FACTORS.map((x) => x.key));
    for (const x of f) expect([1, 2, 3]).toContain(x.score);
    const u = scoreUrgency(f, {});
    expect(u.total).toBeGreaterThanOrEqual(7);
    expect(u.total).toBeLessThanOrEqual(21);
  });

  it("Dan (58, fit day hiker, alone, moderate exposure, alpine terrain) is a measured response", () => {
    const dan = { ...defaultSubject("day_hiker", now), fitness: "high" as const, experience: "some" as const, equipment: "questionable" as const };
    const u = scoreUrgency(urgencyFactors(dan, { exposureNow: "moderate", exposureSoon: "high", hazardsNearLkp: true }), {});
    expect(u.band).toBe("measured");
  });

  it("a small child alone in severe weather is an emergency response", () => {
    const kid = { ...defaultSubject("child", now), ageBand: "child_1_6" as const, equipment: "inadequate" as const };
    const u = scoreUrgency(urgencyFactors(kid, { exposureNow: "severe", exposureSoon: "severe", hazardsNearLkp: true }), {});
    expect(u.total).toBeLessThanOrEqual(11);
    expect(u.band).toBe("emergency");
  });

  it("an experienced, equipped group in mild weather is evaluate-and-investigate", () => {
    const party = { ...defaultSubject("trail_runner", now), experience: "experienced" as const, partySize: 3 as const, equipment: "adequate" as const };
    const u = scoreUrgency(urgencyFactors(party, calm), {});
    expect(u.total).toBeGreaterThanOrEqual(17);
    expect(u.band).toBe("evaluate");
  });

  it("IC overrides replace the proposed score and are marked", () => {
    const f = urgencyFactors(defaultSubject("day_hiker", now), calm);
    const base = scoreUrgency(f, {});
    const over = scoreUrgency(f, { medical: 1 });
    expect(over.total).toBe(base.total - (f.find((x) => x.key === "medical")!.score - 1));
    expect(over.factors.find((x) => x.key === "medical")!.overridden).toBe(true);
    expect(base.factors.every((x) => !x.overridden)).toBe(true);
  });

  it("never mentions survival time", () => {
    const u = scoreUrgency(urgencyFactors(defaultSubject("older_adult", now), calm), {});
    const text = JSON.stringify(u).toLowerCase();
    expect(text).not.toMatch(/surviv/);
  });

  it("flags hazards near the LKP from cliffs, water or alpine ground", () => {
    const cells = STYLIZED_TERRAIN.cells;
    expect(hazardsNearLkp("C6", cells)).toBe(true); // cliffs at C3 within 3 cells
    const plain = Object.fromEntries(Object.entries(cells).map(([k, v]) => [k, { ...v, cliff: false, water: false, cover: "hardwood" as const }]));
    expect(hazardsNearLkp("H8", plain)).toBe(false);
  });
});
