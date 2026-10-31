import { describe, expect, it } from "vitest";
import { DEMO_LKP, DEMO_PROFILE, DEMO_STEPS, demoSubject } from "@/lib/demo/scenario";
import { cumulativePodMap, initialState, reducer, SearchState } from "@/lib/store";
import { rankCells } from "@/lib/engine/rank";
import { assertSumToOne } from "@/lib/engine/bayes";
import { isCellId } from "@/lib/engine/grid";
import { ParsedReportSchema } from "@/lib/schemas";
import { snapshotOf } from "@/lib/terrain";
import { bundledTerrain } from "./helpers/bundled";

// The demo always runs on the bundled OSM terrain, so the story is checked against it.
const terrain = snapshotOf(bundledTerrain().model);

function run(upTo: string): SearchState {
  let s = reducer(initialState(terrain), { type: "demo_load", lkp: DEMO_LKP, profileId: DEMO_PROFILE, terrain, subject: demoSubject() });
  for (const step of DEMO_STEPS) {
    if (step.kind === "callout") s = reducer(s, { type: "set_subject", subject: demoSubject(), source: "canned" });
    if (step.kind === "report") s = reducer(s, { type: "apply_report", payload: { confirmed: step.canned, source: "canned" } });
    if (step.kind === "clue") s = reducer(s, { type: "add_clue", text: step.text, cell: step.cell, radius: step.radius, boost: step.suggestedBoost });
    if (step.id === upTo) break;
  }
  return s;
}

const clue = DEMO_STEPS.find((s) => s.kind === "clue")!;
const override = DEMO_STEPS.find((s) => s.kind === "override")!;
const found = DEMO_STEPS.find((s) => s.kind === "found")!;

describe("demo scenario (bundled terrain)", () => {
  it("canned parses are schema-valid and every scripted cell exists", () => {
    for (const st of DEMO_STEPS) {
      if (st.kind === "report") {
        expect(ParsedReportSchema.safeParse(st.canned).success).toBe(true);
        for (const c of st.canned.cells) expect(isCellId(c)).toBe(true);
      }
    }
  });

  it("starts at a trail junction and follows a real drainage downhill", () => {
    expect(terrain.cells[DEMO_LKP].trail).toBe(true);
    expect(clue.kind === "clue" && terrain.cells[clue.cell].drainage).toBe(true);
    if (override.kind !== "override" || clue.kind !== "clue") throw new Error("scenario shape");
    expect(terrain.cells[override.cell].drainage).toBe(true);
    expect(terrain.cells[override.cell].elevationM!).toBeLessThan(terrain.cells[clue.cell].elevationM!);
  });

  it("keeps probabilities normalized and ROW growing across sweeps", () => {
    const s = run("r4");
    assertSumToOne(s.prob!);
    expect(s.rowHistory.at(-1)!).toBeGreaterThan(0.1);
  });

  it("the fog sweep barely clears its cells", () => {
    const before = run("r2");
    const after = run("r3");
    expect(after.prob!.cells.G11 / before.prob!.cells.G11).toBeGreaterThan(0.75);
  });

  it("clue cell is the top suggestion, the override cell is the model's #3, and the subject is found there", () => {
    if (override.kind !== "override" || clue.kind !== "clue" || found.kind !== "found") throw new Error("scenario shape");
    const s = run("r4");
    const ranked = rankCells(s.prob!, cumulativePodMap(s.pods), s.terrain.cells).map((x) => x.cell);
    expect(ranked[0]).toBe(clue.cell);
    expect(ranked[2]).toBe(override.cell);
    expect(found.cell).toBe(override.cell);
  });
});
