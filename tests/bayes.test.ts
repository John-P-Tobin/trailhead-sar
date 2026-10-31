import { describe, expect, it } from "vitest";
import {
  ProbState,
  addPod,
  applySweep,
  applySweeps,
  assertSumToOne,
  cumulativePod,
  setCellPoa,
  setRow,
  total,
} from "@/lib/engine/bayes";

const small = (): ProbState => ({ cells: { A1: 0.4, A2: 0.3, A3: 0.2 }, row: 0.1 });

describe("applySweep", () => {
  it("matches the update formula by hand", () => {
    const s = applySweep(small(), "A1", 0.5);
    const denom = 1 - 0.4 * 0.5; // 0.8
    expect(s.cells.A1).toBeCloseTo((0.4 * 0.5) / denom, 12); // 0.25
    expect(s.cells.A2).toBeCloseTo(0.3 / denom, 12);
    expect(s.cells.A3).toBeCloseTo(0.2 / denom, 12);
    expect(s.row).toBeCloseTo(0.1 / denom, 12);
  });

  it("keeps the sum at 1", () => {
    const s = applySweep(small(), "A2", 0.73);
    expect(total(s)).toBeCloseTo(1, 12);
    expect(() => assertSumToOne(s)).not.toThrow();
  });

  it("is a no-op at POD 0", () => {
    expect(applySweep(small(), "A1", 0)).toEqual(small());
  });

  it("zeroes the searched cell at POD 1", () => {
    const s = applySweep(small(), "A1", 1);
    expect(s.cells.A1).toBe(0);
    expect(s.row).toBeCloseTo(0.1 / 0.6, 12);
  });

  it("grows ROW after an unsuccessful search", () => {
    expect(applySweep(small(), "A3", 0.6).row).toBeGreaterThan(0.1);
  });

  it("clamps out-of-range POD", () => {
    expect(applySweep(small(), "A1", 1.7).cells.A1).toBe(0);
    expect(applySweep(small(), "A1", -1)).toEqual(small());
  });

  it("rejects unknown cells and impossible states", () => {
    expect(() => applySweep(small(), "Z9", 0.5)).toThrow();
    expect(() => applySweep({ cells: { A1: 1 }, row: 0 }, "A1", 1)).toThrow();
  });
});

describe("applySweeps", () => {
  it("equals applying single sweeps in order", () => {
    const seq = applySweeps(small(), [
      { cell: "A1", pod: 0.5 },
      { cell: "A2", pod: 0.4 },
    ]);
    const manual = applySweep(applySweep(small(), "A1", 0.5), "A2", 0.4);
    expect(seq).toEqual(manual);
    expect(total(seq)).toBeCloseTo(1, 12);
  });

  it("two sweeps of one cell equal one sweep at cumulative POD", () => {
    const twice = applySweeps(small(), [
      { cell: "A1", pod: 0.5 },
      { cell: "A1", pod: 0.4 },
    ]);
    const once = applySweep(small(), "A1", cumulativePod([0.5, 0.4]));
    expect(twice.cells.A1).toBeCloseTo(once.cells.A1, 12);
    expect(twice.row).toBeCloseTo(once.row, 12);
  });
});

describe("cumulativePod", () => {
  it("is 1 − Π(1 − p)", () => {
    expect(cumulativePod([])).toBe(0);
    expect(cumulativePod([0.5])).toBeCloseTo(0.5);
    expect(cumulativePod([0.5, 0.5])).toBeCloseTo(0.75);
    expect(cumulativePod([0.3, 0.6, 0.2])).toBeCloseTo(1 - 0.7 * 0.4 * 0.8);
    expect(addPod(0.5, 0.5)).toBeCloseTo(0.75);
  });
});

describe("prior editing", () => {
  it("setCellPoa keeps ROW and the total", () => {
    const s = setCellPoa(small(), "A1", 0.1);
    expect(s.cells.A1).toBeCloseTo(0.1);
    expect(s.row).toBeCloseTo(0.1);
    expect(total(s)).toBeCloseTo(1, 12);
    expect(s.cells.A2 / s.cells.A3).toBeCloseTo(1.5);
  });

  it("setRow rescales the grid", () => {
    const s = setRow(small(), 0.25);
    expect(s.row).toBe(0.25);
    expect(total(s)).toBeCloseTo(1, 12);
  });

  it("assertSumToOne throws on bad states", () => {
    expect(() => assertSumToOne({ cells: { A1: 0.5 }, row: 0.1 })).toThrow();
    expect(() => assertSumToOne({ cells: { A1: 1.2 }, row: -0.2 })).toThrow();
  });
});
