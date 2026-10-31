import { afterEach, describe, expect, it, vi } from "vitest";
import { initialState, isUsableState, loadState, reducer, SearchState } from "@/lib/store";
import { emptyReport, ParsedReport } from "@/lib/schemas";
import { assertSumToOne } from "@/lib/engine/bayes";
import { ALL_CELLS, isCellId } from "@/lib/engine/grid";
import { BoostLevel } from "@/lib/engine/clues";
import { DEMO_LKP, DEMO_PROFILE, DEMO_STEPS } from "@/lib/demo/scenario";
import { snapshotOf } from "@/lib/terrain";
import { bundledTerrain } from "./helpers/bundled";

vi.mock("server-only", () => ({}));
const askClaudeJson = vi.fn();
vi.mock("@/lib/server/anthropic", () => ({ askClaudeJson: (...a: unknown[]) => askClaudeJson(...a) }));
import { POST as parseReport } from "@/app/api/parse-report/route";
import { GET as terrainRoute } from "@/app/api/terrain/route";

const terrain = snapshotOf(bundledTerrain().model);
const started = () => reducer(initialState(terrain), { type: "set_lkp", cell: "H8" });
const report = (r: Partial<ParsedReport>) => ({
  type: "apply_report" as const,
  payload: { confirmed: { ...emptyReport(), team: "T1", ...r }, source: "manual" as const },
});

describe("robustness: reports", () => {
  afterEach(() => askClaudeJson.mockReset());

  it("blank report text is rejected without calling Claude", async () => {
    const res = await parseReport(new Request("http://x/api/parse-report", { method: "POST", body: JSON.stringify({ text: "   \n " }) }));
    expect(res.status).toBe(400);
    expect(askClaudeJson).not.toHaveBeenCalled();
  });

  it("drops cell IDs outside the grid and normalizes case, telling the IC", async () => {
    askClaudeJson.mockResolvedValue({ ok: true, data: { ...emptyReport(), cells: ["c4", "P3", "A0", "A16", "C4"], estimated_pod: 0.5, unclear_points: [] } });
    const res = await parseReport(new Request("http://x/api/parse-report", { method: "POST", body: JSON.stringify({ text: "Team 1 did c4 and P3" }) }));
    const body = await res.json();
    expect(body.report.cells).toEqual(["C4"]);
    expect(body.report.unclear_points.join(" ")).toMatch(/P3, A0, A16/);
  });

  it("a report with only out-of-grid cells or a garbled POD never changes the map", () => {
    const s = started();
    expect(reducer(s, report({ cells: ["P3", "Z99"], estimated_pod: 0.5 }))).toBe(s);
    const nan = reducer(s, report({ cells: ["H8"], estimated_pod: Number.NaN }));
    assertSumToOne(nan.prob!);
    expect(nan.prob!.cells.H8).toBeCloseTo(s.prob!.cells.H8, 12); // NaN POD treated as 0
  });

  it("an engine error is logged instead of crashing the console", () => {
    let s = started();
    s = reducer(s, { type: "set_row", value: 0 });
    // Put all probability in one cell, then search it at POD 1: no probability would remain.
    s = reducer(s, { type: "edit_cell_poa", cell: "H8", value: 1 });
    const next = reducer(s, report({ cells: ["H8"], estimated_pod: 1 }));
    expect(next.prob).toEqual(s.prob);
    expect(next.audit.at(-1)!.summary).toMatch(/Update ignored/);
  });
});

describe("robustness: many updates", () => {
  it("probabilities stay finite, non-negative and sum to 1 after 300 random sweeps and clues", () => {
    let seed = 42;
    const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    const boosts: BoostLevel[] = ["none", "small", "medium", "large"];
    let s = started();
    for (let i = 0; i < 300; i++) {
      if (i % 10 === 9) {
        s = reducer(s, { type: "add_clue", text: "clue", cell: ALL_CELLS[Math.floor(rand() * 225)], radius: Math.floor(rand() * 3), boost: boosts[i % 4] });
      } else {
        const cells = Array.from({ length: 1 + Math.floor(rand() * 4) }, () => ALL_CELLS[Math.floor(rand() * 225)]);
        s = reducer(s, report({ cells, estimated_pod: rand() < 0.1 ? 1 : rand() }));
      }
      assertSumToOne(s.prob!);
    }
    const values = [s.prob!.row, ...Object.values(s.prob!.cells)];
    expect(values.every((v) => Number.isFinite(v) && v >= 0)).toBe(true);
    expect(s.prob!.row).toBeGreaterThan(0.1); // ROW grows as the grid is searched
    expect(s.audit.some((e) => e.summary.startsWith("Update ignored"))).toBe(false);
  });
});

describe("robustness: refresh and reset", () => {
  afterEach(() => vi.unstubAllGlobals());
  const storage = (value: string | null) => vi.stubGlobal("window", { localStorage: { getItem: () => value } });

  it("restores a mid-search state from localStorage after a refresh", () => {
    const s = reducer(started(), report({ cells: ["H9"], estimated_pod: 0.6 }));
    storage(JSON.stringify(s));
    const restored = loadState()!;
    expect(restored.prob).toEqual(s.prob);
    expect(restored.started).toBe(true);
  });

  it("ignores corrupt, old or hand-edited saved state instead of crashing", () => {
    for (const raw of ["{not json", "null", '"x"', JSON.stringify({ version: 0 }), JSON.stringify({ version: 1 })]) {
      storage(raw);
      expect(loadState()).toBeNull();
    }
    const s = started();
    const bad: SearchState = { ...s, prob: { ...s.prob!, cells: { ...s.prob!.cells, H8: Number.NaN } } };
    expect(isUsableState(JSON.parse(JSON.stringify(bad)))).toBe(false);
    const offGrid: SearchState = { ...s, prob: { row: s.prob!.row, cells: { ...s.prob!.cells, Q1: 0 } } };
    expect(isUsableState(offGrid)).toBe(false);
    expect(isUsableState(initialState())).toBe(true);
  });

  it("Reset mid-demo returns to a clean, unlocked state on the same terrain", () => {
    let s = reducer(initialState(terrain), { type: "demo_load", lkp: DEMO_LKP, profileId: DEMO_PROFILE, terrain });
    for (const step of DEMO_STEPS.slice(0, 3)) {
      if (step.kind === "report") s = reducer(s, { type: "apply_report", payload: { confirmed: step.canned, source: "canned" } });
      s = reducer(s, { type: "demo_advance" });
    }
    expect(s.started).toBe(true);
    const r = reducer(s, { type: "reset" });
    expect(r).toMatchObject({ demo: false, demoStep: 0, started: false, lkp: null, prob: null, found: null, reports: [], clues: [] });
    expect(r.terrain).toBe(s.terrain);
    // A fresh demo can be loaded right after.
    const again = reducer(r, { type: "demo_load", lkp: DEMO_LKP, profileId: DEMO_PROFILE, terrain });
    assertSumToOne(again.prob!);
    expect(isCellId(again.lkp!)).toBe(true);
  });
});

describe("robustness: terrain servers", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses the backup Overpass server when the main one fails", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.includes("overpass-api.de")
        ? new Response("busy", { status: 504 })
        : Response.json({ elements: [{ type: "way", id: 7, tags: { highway: "path", name: "Crawford Path" }, geometry: [{ lat: 44.26, lon: -71.32 }, { lat: 44.265, lon: -71.31 }] }] }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const body = await (await terrainRoute(new Request("http://x/api/terrain?bbox=44.245,-71.335,44.285,-71.285"))).json();
    expect(body.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
