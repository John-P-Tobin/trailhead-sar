import { describe, expect, it } from "vitest";
import { cumulativePodMap, initialState, reducer } from "@/lib/store";
import { emptyReport } from "@/lib/schemas";
import { total } from "@/lib/engine/bayes";
import { defaultSubject } from "@/lib/subject";

const withLkp = () => reducer(initialState(), { type: "set_lkp", cell: "H8" });

describe("store reducer", () => {
  it("confirming a subject regenerates priors before the search and only logs after it starts", () => {
    let s = withLkp();
    expect(s.subject).toBeNull();
    const kid = { ...defaultSubject("child"), name: "Sam" };
    s = reducer(s, { type: "set_subject", subject: kid, source: "manual" });
    expect(s.subject?.name).toBe("Sam");
    expect(s.subjectConfirmed).toBe(true);
    expect(s.profileId).toBe("child");
    expect(total(s.prob!)).toBeCloseTo(1, 9);
    const before = s.prob!.cells;
    s = reducer(s, { type: "apply_report", payload: { confirmed: { ...emptyReport(), cells: ["H9"], estimated_pod: 0.5 }, source: "manual" } });
    const after = reducer(s, { type: "set_subject", subject: { ...kid, medical: "known" }, source: "manual" });
    expect(after.subject?.medical).toBe("known");
    expect(after.prob!.cells.A1).toBe(s.prob!.cells.A1); // priors locked
    expect(after.audit.at(-1)!.type).toBe("subject");
    expect(before.H9).toBeGreaterThan(0);
  });

  it("urgency overrides are stored and logged; restoring the proposed score clears them", () => {
    let s = withLkp();
    s = reducer(s, { type: "set_urgency_override", key: "medical", score: 1, proposed: 3, reason: "diabetic per family" });
    expect(s.urgencyOverrides.medical).toBe(1);
    expect(s.audit.at(-1)!.type).toBe("urgency");
    s = reducer(s, { type: "set_urgency_override", key: "medical", score: 3, proposed: 3 });
    expect(s.urgencyOverrides.medical).toBeUndefined();
  });

  it("places LKP and seeds priors", () => {
    const s = withLkp();
    expect(s.lkp).toBe("H8");
    expect(total(s.prob!)).toBeCloseTo(1, 9);
    expect(s.prob!.row).toBeCloseTo(0.1);
  });

  it("applies a report, logs proposal vs IC edits, and locks priors", () => {
    let s = withLkp();
    const proposal = { ...emptyReport(), team: "Team 2", cells: ["H9", "H10"], estimated_pod: 0.6 };
    const confirmed = { ...proposal, estimated_pod: 0.5 };
    s = reducer(s, { type: "apply_report", payload: { confirmed, proposal, source: "claude", rawText: "..." } });
    expect(s.started).toBe(true);
    expect(s.rowHistory.at(-1)!).toBeGreaterThan(0.1);
    expect(cumulativePodMap(s.pods).H9).toBeCloseTo(0.5);
    const entry = s.audit.at(-1)!;
    expect(entry.type).toBe("report");
    expect((entry.data as { ic_edits: Record<string, unknown> }).ic_edits).toHaveProperty("estimated_pod");
    const locked = reducer(s, { type: "set_lkp", cell: "A1" });
    expect(locked.lkp).toBe("H8");
  });

  it("logs overrides with reasons", () => {
    let s = withLkp();
    s = reducer(s, { type: "assign", team: "Team 3", cell: "E12", suggestedRank: 3, topSuggestion: "H11", reason: "family tip" });
    expect(s.audit.map((a) => a.type)).toEqual(["setup", "assignment", "override"]);
    expect(s.assignments[0].override).toBe(true);
  });

  it("ignores reports with no valid cells", () => {
    const s = withLkp();
    const r = reducer(s, { type: "apply_report", payload: { confirmed: { ...emptyReport(), cells: ["Z99"] }, source: "manual" } });
    expect(r).toBe(s);
  });
});
