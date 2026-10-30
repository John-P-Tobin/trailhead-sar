import { describe, expect, it } from "vitest";
import { DEMO_LKP, DEMO_STEPS } from "@/lib/demo/scenario";
import { cumulativePodMap, initialState, reducer, SearchState } from "@/lib/store";
import { rankCells } from "@/lib/engine/rank";
import { assertSumToOne } from "@/lib/engine/bayes";
import { ParsedReportSchema } from "@/lib/schemas";

function run(upTo: string): SearchState {
  let s = reducer(initialState(), { type: "set_lkp", cell: DEMO_LKP });
  for (const step of DEMO_STEPS) {
    if (step.kind === "report") s = reducer(s, { type: "apply_report", payload: { confirmed: step.canned, source: "canned" } });
    if (step.kind === "clue") s = reducer(s, { type: "add_clue", text: step.text, cell: step.cell, radius: step.radius, boost: step.suggestedBoost });
    if (step.id === upTo) break;
  }
  return s;
}

describe("demo scenario", () => {
  it("canned parses are schema-valid", () => {
    for (const st of DEMO_STEPS) if (st.kind === "report") expect(ParsedReportSchema.safeParse(st.canned).success).toBe(true);
  });

  it("keeps probabilities normalized and ROW growing across sweeps", () => {
    const s = run("r4");
    assertSumToOne(s.prob!);
    expect(s.rowHistory.at(-1)!).toBeGreaterThan(0.1);
  });

  it("fog sweep leaves more probability than a clear sweep would", () => {
    const s = run("r3");
    const before = run("r2");
    expect(s.prob!.cells.F10 / before.prob!.cells.F10).toBeGreaterThan(0.75);
  });

  it("the found cell is a model suggestion, but not #1, when the IC overrides", () => {
    const s = run("r4");
    const sugg = rankCells(s.prob!, cumulativePodMap(s.pods));
    const cells = sugg.map((x) => x.cell);
    expect(cells).toContain("E12");
    expect(cells[0]).not.toBe("E12");
  });
});
