import { describe, expect, it } from "vitest";
import {
  DISTANCE_MODEL,
  DISTANCE_QUARTILES_KM,
  distanceCdf,
  distanceParams,
  distanceQuantile,
  distanceScaleFor,
  gradedDownhill,
  massWithinKm,
  reachKm,
  scaledQuartiles,
  suggestedRow,
  TRAVEL_HOURS_CAP,
} from "@/lib/engine/behaviour";
import { defaultSubject, hoursSince } from "@/lib/subject";
import { PROFILES } from "@/lib/profiles";

const H = 3600_000;
const now = Date.parse("2026-10-31T02:00:00Z");
const hiker = defaultSubject("day_hiker", now);
const child = defaultSubject("child", now);

describe("subject helpers", () => {
  it("hoursSince is clamped at 0 and tolerates garbage", () => {
    expect(hoursSince(new Date(now - 2 * H).toISOString(), now)).toBeCloseTo(2);
    expect(hoursSince(new Date(now + H).toISOString(), now)).toBe(0);
    expect(hoursSince("not a date", now)).toBe(0);
  });

  it("defaultSubject fills every field from the category", () => {
    expect(child.ageBand).toBe("child_7_12");
    expect(hiker.ageBand).toBe("adult");
    expect(defaultSubject("older_adult", now).ageBand).toBe("older_65");
    expect(hoursSince(hiker.lastSeenAt, now)).toBeCloseTo(2);
  });
});

describe("distance distribution", () => {
  it("quartile tables are increasing and cover every profile", () => {
    for (const id of Object.keys(PROFILES)) {
      const q = DISTANCE_QUARTILES_KM[id as keyof typeof DISTANCE_QUARTILES_KM];
      expect(q[0]).toBeLessThan(q[1]);
      expect(q[1]).toBeLessThan(q[2]);
      expect(q[2]).toBeLessThan(q[3]);
    }
  });

  it("the CDF passes through the quartiles and is monotonic to 1", () => {
    const p = distanceParams(hiker);
    const q = scaledQuartiles(hiker);
    expect(distanceCdf(p, 0)).toBe(0);
    expect(distanceCdf(p, q[0])).toBeCloseTo(0.25, 5);
    expect(distanceCdf(p, q[1])).toBeCloseTo(0.5, 5);
    expect(distanceCdf(p, q[3])).toBeCloseTo(0.95, 5);
    let prev = 0;
    for (let d = 0; d <= 60; d += 0.5) {
      const v = distanceCdf(p, d);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
    expect(distanceCdf(p, 2000)).toBeCloseTo(1, 3);
  });

  it("matches the MapScore sanity checks for hikers: half within 2.62 km, ~89% within 12 km", () => {
    const p = DISTANCE_MODEL.day_hiker;
    expect(distanceQuantile(p, 0.5)).toBeCloseTo(2.62, 2);
    expect(distanceCdf(p, 12)).toBeGreaterThan(0.87);
    expect(distanceCdf(p, 12)).toBeLessThan(0.91);
  });

  it("fit, experienced subjects travel farther; frail or very young stay closer", () => {
    expect(distanceScaleFor({ ...hiker, fitness: "high", experience: "experienced" })).toBeGreaterThan(distanceScaleFor(hiker));
    expect(distanceScaleFor({ ...hiker, medical: "known" })).toBeLessThan(distanceScaleFor(hiker));
    expect(distanceScaleFor({ ...child, ageBand: "child_1_6" })).toBeLessThan(distanceScaleFor(child));
    expect(distanceScaleFor({ ...hiker, fitness: "low", experience: "none", medical: "known", ageBand: "older_65" })).toBeGreaterThanOrEqual(0.4);
  });

  it("a child keeps more mass within 1 km than a hiker", () => {
    expect(massWithinKm(child, 1, 3)).toBeGreaterThan(massWithinKm(hiker, 1, 3));
  });
});

describe("time-aware reach", () => {
  it("grows with time, saturates at the travel cap, never below the floor", () => {
    expect(reachKm(hiker, 0)).toBeGreaterThan(0);
    expect(reachKm(hiker, 1)).toBeLessThan(reachKm(hiker, 3));
    expect(reachKm(hiker, TRAVEL_HOURS_CAP)).toBeCloseTo(reachKm(hiker, TRAVEL_HOURS_CAP + 10));
    expect(reachKm(child, 2)).toBeLessThan(reachKm(hiker, 2));
  });

  it("early in a search the distribution is truncated at the reach", () => {
    // 20 minutes missing: almost everything is still within reach distance
    const early = massWithinKm(hiker, reachKm(hiker, 1 / 3), 1 / 3);
    expect(early).toBeCloseTo(1, 6);
    expect(massWithinKm(hiker, 1, 1 / 3)).toBeGreaterThan(massWithinKm(hiker, 1, 10));
  });

  it("the suggested ROW grows with time elapsed and is clamped", () => {
    const edgeKm = 1.3; // nearest grid edge
    const r1 = suggestedRow(hiker, edgeKm, 0.5);
    const r10 = suggestedRow(hiker, edgeKm, 10);
    expect(r1).toBeLessThan(r10);
    expect(r1).toBeGreaterThanOrEqual(0.05);
    expect(r10).toBeLessThanOrEqual(0.6);
    expect(suggestedRow(hiker, 100, 10)).toBe(0.05);
  });
});

describe("graded downhill", () => {
  it("is 1 at or above the LKP, rises with the drop and saturates", () => {
    const p = PROFILES.day_hiker;
    expect(gradedDownhill(p, -50)).toBe(1);
    expect(gradedDownhill(p, 0)).toBe(1);
    expect(gradedDownhill(p, 75)).toBeGreaterThan(1);
    expect(gradedDownhill(p, 75)).toBeLessThan(gradedDownhill(p, 150));
    expect(gradedDownhill(p, 150)).toBeCloseTo(p.downhill);
    expect(gradedDownhill(p, 900)).toBeCloseTo(p.downhill);
  });
});
