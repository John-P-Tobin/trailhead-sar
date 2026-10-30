// Search state and reducer. All probability changes go through lib/engine.

import { AuditEntry, diffFields, makeAudit } from "./audit";
import { ProbState, addPod, applySweeps, setCellPoa, setRow } from "./engine/bayes";
import { applyClue, BoostLevel, BOOST_FACTORS } from "./engine/clues";
import { CellId, isCellId } from "./engine/grid";
import { generatePriors, DEFAULT_ROW } from "./engine/priors";
import { PROFILES, ProfileId } from "./profiles";
import { ParsedReport } from "./schemas";

export type ReportSource = "claude" | "canned" | "manual";

export interface AppliedReport {
  id: string;
  at: string;
  team: string;
  cells: CellId[];
  pod: number;
  podConfidence: ParsedReport["pod_confidence"];
  coverage: string;
  conditions: string[];
  clues: string[];
  source: ReportSource;
  rawText?: string;
  rowBefore: number;
  rowAfter: number;
  /** Largest POA changes (after − before) caused by this report. */
  shifts: { cell: CellId; before: number; after: number }[];
}

export interface Clue {
  id: string;
  at: string;
  text: string;
  cell: CellId;
  radius: number;
  boost: BoostLevel;
  factor: number;
}

export interface Assignment {
  id: string;
  at: string;
  team: string;
  cell: CellId;
  suggestedRank: number | null; // 1-based rank in suggestions, null if not suggested
  topSuggestion: CellId | null;
  override: boolean;
  reason?: string;
}

export interface SearchState {
  version: 1;
  lkp: CellId | null;
  profileId: ProfileId;
  prob: ProbState | null;
  /** True once any report or clue has been applied; locks prior editing. */
  started: boolean;
  pods: Record<CellId, number[]>;
  reports: AppliedReport[];
  clues: Clue[];
  assignments: Assignment[];
  rowHistory: number[];
  audit: AuditEntry[];
  demo: boolean;
}

export const initialState = (): SearchState => ({
  version: 1,
  lkp: null,
  profileId: "day_hiker",
  prob: null,
  started: false,
  pods: {},
  reports: [],
  clues: [],
  assignments: [],
  rowHistory: [],
  audit: [],
  demo: false,
});

export interface ApplyReportPayload {
  confirmed: ParsedReport;
  proposal?: ParsedReport | null;
  source: ReportSource;
  rawText?: string;
}

export type Action =
  | { type: "hydrate"; state: SearchState }
  | { type: "set_lkp"; cell: CellId }
  | { type: "set_profile"; profileId: ProfileId }
  | { type: "edit_cell_poa"; cell: CellId; value: number }
  | { type: "set_row"; value: number }
  | { type: "apply_report"; payload: ApplyReportPayload }
  | { type: "add_clue"; text: string; cell: CellId; radius: number; boost: BoostLevel }
  | { type: "assign"; team: string; cell: CellId; suggestedRank: number | null; topSuggestion: CellId | null; reason?: string }
  | { type: "log"; entry: AuditEntry }
  | { type: "reset" }
  | { type: "load"; state: SearchState };

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

function topShifts(before: ProbState, after: ProbState, n = 5) {
  return Object.keys(after.cells)
    .map((cell) => ({ cell, before: before.cells[cell], after: after.cells[cell] }))
    .sort((a, b) => Math.abs(b.after - b.before) - Math.abs(a.after - a.before))
    .slice(0, n);
}

function regenerate(state: SearchState, lkp: CellId, profileId: ProfileId): SearchState {
  const prob = generatePriors(lkp, PROFILES[profileId], state.prob?.row ?? DEFAULT_ROW);
  return { ...state, lkp, profileId, prob, rowHistory: [prob.row] };
}

export function reducer(state: SearchState, action: Action): SearchState {
  switch (action.type) {
    case "hydrate":
    case "load":
      return action.state;

    case "set_lkp": {
      if (state.started || !isCellId(action.cell)) return state;
      const next = regenerate(state, action.cell, state.profileId);
      return {
        ...next,
        audit: [...state.audit, makeAudit("setup", `LKP set to ${action.cell}; priors generated (${PROFILES[state.profileId].label})`)],
      };
    }

    case "set_profile": {
      if (state.started) return state;
      if (!state.lkp) return { ...state, profileId: action.profileId };
      const next = regenerate(state, state.lkp, action.profileId);
      return {
        ...next,
        audit: [...state.audit, makeAudit("setup", `Profile set to ${PROFILES[action.profileId].label}; priors regenerated`)],
      };
    }

    case "edit_cell_poa": {
      if (state.started || !state.prob) return state;
      const before = state.prob.cells[action.cell];
      const prob = setCellPoa(state.prob, action.cell, action.value);
      return {
        ...state,
        prob,
        audit: [
          ...state.audit,
          makeAudit("prior_edit", `IC edited ${action.cell} POA ${pct(before)} → ${pct(prob.cells[action.cell])}`, {
            cell: action.cell,
            before,
            after: prob.cells[action.cell],
          }),
        ],
      };
    }

    case "set_row": {
      if (state.started || !state.prob) return state;
      const before = state.prob.row;
      const prob = setRow(state.prob, action.value);
      return {
        ...state,
        prob,
        rowHistory: [prob.row],
        audit: [...state.audit, makeAudit("prior_edit", `IC set ROW ${pct(before)} → ${pct(prob.row)}`)],
      };
    }

    case "apply_report": {
      if (!state.prob) return state;
      const { confirmed, proposal, source, rawText } = action.payload;
      const cells = [...new Set(confirmed.cells.map((c) => c.toUpperCase()))].filter((c) => c in state.prob!.cells);
      if (cells.length === 0) return state;
      const pod = Math.min(1, Math.max(0, confirmed.estimated_pod));
      const before = state.prob;
      const after = applySweeps(before, cells.map((cell) => ({ cell, pod })));
      const pods = { ...state.pods };
      for (const c of cells) pods[c] = [...(pods[c] ?? []), pod];
      const report: AppliedReport = {
        id: `r${state.reports.length + 1}`,
        at: new Date().toISOString(),
        team: confirmed.team || "Unspecified team",
        cells,
        pod,
        podConfidence: confirmed.pod_confidence,
        coverage: confirmed.coverage_description,
        conditions: confirmed.conditions,
        clues: confirmed.clues,
        source,
        rawText,
        rowBefore: before.row,
        rowAfter: after.row,
        shifts: topShifts(before, after),
      };
      const edits = proposal ? diffFields(proposal as Record<string, unknown>, confirmed as Record<string, unknown>) : null;
      return {
        ...state,
        prob: after,
        started: true,
        pods,
        reports: [...state.reports, report],
        rowHistory: [...state.rowHistory, after.row],
        audit: [
          ...state.audit,
          makeAudit(
            "report",
            `${report.team}: ${cells.join(", ")} at POD ${pct(pod)} (${source}). ROW ${pct(before.row)} → ${pct(after.row)}`,
            { raw_text: rawText ?? null, ai_proposal: proposal ?? null, ic_confirmed: confirmed, ic_edits: edits, source },
          ),
        ],
      };
    }

    case "add_clue": {
      if (!state.prob || !isCellId(action.cell)) return state;
      const factor = BOOST_FACTORS[action.boost];
      const before = state.prob;
      const prob = action.boost === "none" ? before : applyClue(before, action.cell, action.radius, factor);
      const clue: Clue = {
        id: `c${state.clues.length + 1}`,
        at: new Date().toISOString(),
        text: action.text,
        cell: action.cell,
        radius: action.radius,
        boost: action.boost,
        factor,
      };
      return {
        ...state,
        prob,
        started: true,
        clues: [...state.clues, clue],
        rowHistory: [...state.rowHistory, prob.row],
        audit: [
          ...state.audit,
          makeAudit("clue", `Clue at ${action.cell}: "${action.text}" — IC boost ${action.boost} (×${factor}, radius ${action.radius})`, clue),
        ],
      };
    }

    case "assign": {
      const override = action.topSuggestion !== null && action.cell !== action.topSuggestion;
      const a: Assignment = {
        id: `a${state.assignments.length + 1}`,
        at: new Date().toISOString(),
        team: action.team,
        cell: action.cell,
        suggestedRank: action.suggestedRank,
        topSuggestion: action.topSuggestion,
        override,
        reason: action.reason?.trim() || undefined,
      };
      const entries = [makeAudit("assignment", `${a.team} assigned to ${a.cell}`, a)];
      if (override) {
        entries.push(
          makeAudit("override", `IC chose ${a.cell} over top suggestion ${a.topSuggestion}${a.reason ? `: "${a.reason}"` : " (no reason given)"}`, a),
        );
      }
      return { ...state, assignments: [...state.assignments, a], audit: [...state.audit, ...entries] };
    }

    case "log":
      return { ...state, audit: [...state.audit, action.entry] };

    case "reset":
      return { ...initialState(), audit: [makeAudit("reset", "Search reset")] };
  }
}

export function cumulativePodMap(pods: Record<CellId, number[]>): Record<CellId, number> {
  const out: Record<CellId, number> = {};
  for (const [c, list] of Object.entries(pods)) out[c] = list.reduce((acc, p) => addPod(acc, p), 0);
  return out;
}

const STORAGE_KEY = "trailhead:v1";

export function loadState(): SearchState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as SearchState;
    return s?.version === 1 ? s : null;
  } catch {
    return null;
  }
}

export function saveState(state: SearchState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // storage unavailable or full — the app keeps working in memory
  }
}
