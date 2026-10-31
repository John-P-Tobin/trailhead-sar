// Search state and reducer. All probability changes go through lib/engine.

import { AuditEntry, diffFields, makeAudit } from "./audit";
import { ProbState, addPod, applySweeps, assertSumToOne, clampPod, setCellPoa, setRow } from "./engine/bayes";
import { applyClue, BoostLevel, BOOST_FACTORS } from "./engine/clues";
import { CellId, isCellId } from "./engine/grid";
import { generatePriors, DEFAULT_ROW } from "./engine/priors";
import { UrgencyKey, UrgencyScore } from "./engine/urgency";
import { PROFILES, ProfileId } from "./profiles";
import { Explanation, ParsedReport } from "./schemas";
import { defaultSubject, Subject } from "./subject";
import { snapshotOf, STYLIZED_TERRAIN, TerrainSnapshot } from "./terrain";

export type SubjectSource = "claude" | "canned" | "manual";

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
  explanation?: Explanation & { source: "claude" | "local" | "canned" };
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
  /** Mirrors subject.category; kept for exports and older saved states. */
  profileId: ProfileId;
  /** Who is missing and since when. Null until the IC confirms one (a category alone uses defaults). */
  subject: Subject | null;
  /** IC overrides of the proposed urgency factor scores. */
  urgencyOverrides: Partial<Record<UrgencyKey, UrgencyScore>>;
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
  /** Terrain the priors and suggestions use. Locked once the search starts. */
  terrain: TerrainSnapshot;
  /** True once the IC has hand-edited a cell's prior (kept if new terrain arrives). */
  priorsEdited: boolean;
  /** Index of the next scripted demo step. */
  demoStep: number;
  found: { cell: CellId; at: string; text: string } | null;
}

export const initialState = (terrain: TerrainSnapshot = snapshotOf(STYLIZED_TERRAIN)): SearchState => ({
  version: 1,
  lkp: null,
  profileId: "day_hiker",
  subject: null,
  urgencyOverrides: {},
  prob: null,
  started: false,
  pods: {},
  reports: [],
  clues: [],
  assignments: [],
  rowHistory: [],
  audit: [],
  demo: false,
  terrain,
  priorsEdited: false,
  demoStep: 0,
  found: null,
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
  | { type: "set_subject"; subject: Subject; source: SubjectSource; proposal?: Subject | null; rawText?: string }
  | { type: "set_urgency_override"; key: UrgencyKey; score: UrgencyScore | null; proposed: UrgencyScore; reason?: string }
  | { type: "edit_cell_poa"; cell: CellId; value: number }
  | { type: "set_row"; value: number }
  | { type: "apply_report"; payload: ApplyReportPayload }
  | { type: "add_clue"; text: string; cell: CellId; radius: number; boost: BoostLevel }
  | { type: "assign"; team: string; cell: CellId; suggestedRank: number | null; topSuggestion: CellId | null; reason?: string }
  | { type: "set_explanation"; reportId: string; explanation: Explanation; source: "claude" | "local" | "canned" }
  | { type: "log"; entry: AuditEntry }
  | { type: "reset" }
  | { type: "set_terrain"; terrain: TerrainSnapshot }
  | { type: "demo_load"; lkp: CellId; profileId: ProfileId; terrain: TerrainSnapshot; subject?: Subject }
  | { type: "demo_advance" }
  | { type: "mark_found"; cell: CellId; text: string }
  | { type: "load"; state: SearchState };

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

function topShifts(before: ProbState, after: ProbState, n = 5) {
  return Object.keys(after.cells)
    .map((cell) => ({ cell, before: before.cells[cell], after: after.cells[cell] }))
    .sort((a, b) => Math.abs(b.after - b.before) - Math.abs(a.after - a.before))
    .slice(0, n);
}

/** Re-seed the priors for the current subject (or the category's defaults) at the current time. */
function regenerate(state: SearchState, lkp: CellId, profileId: ProfileId, subject?: Subject): SearchState {
  const subj = subject ?? state.subject ?? defaultSubject(profileId);
  const prob = generatePriors(lkp, subj, state.terrain.cells, { row: state.prob?.row ?? DEFAULT_ROW });
  return { ...state, lkp, profileId: subj.category, subject: subj, prob, rowHistory: [prob.row], priorsEdited: false };
}

/** Switching category keeps what the IC already typed about the person; the behaviour defaults follow the category. */
function subjectForCategory(prev: Subject | null, profileId: ProfileId): Subject {
  const base = defaultSubject(profileId);
  return prev ? { ...base, name: prev.name, lastSeenAt: prev.lastSeenAt, intent: prev.intent, notes: prev.notes, medical: prev.medical, equipment: prev.equipment, partySize: prev.partySize } : base;
}

/**
 * Never let a bad value crash the console mid-search: if the engine rejects an
 * update (e.g. probabilities would not sum to 1), keep the previous state and log it.
 */
export function reducer(state: SearchState, action: Action): SearchState {
  try {
    return reduce(state, action);
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    return { ...state, audit: [...state.audit, makeAudit("note", `Update ignored (${action.type}): ${reason}`)] };
  }
}

function reduce(state: SearchState, action: Action): SearchState {
  switch (action.type) {
    case "hydrate":
    case "load":
      return action.state;

    case "set_lkp": {
      if (state.started || !isCellId(action.cell)) return state;
      const next = regenerate(state, action.cell, state.profileId);
      return {
        ...next,
        audit: [
          ...state.audit,
          makeAudit("setup", `LKP set to ${action.cell}; priors generated (${PROFILES[state.profileId].label}, ${state.terrain.label} terrain)`),
        ],
      };
    }

    case "set_profile": {
      if (state.started) return state;
      const subject = subjectForCategory(state.subject, action.profileId);
      if (!state.lkp) return { ...state, profileId: action.profileId, subject };
      const next = regenerate(state, state.lkp, action.profileId, subject);
      return {
        ...next,
        audit: [...state.audit, makeAudit("setup", `Profile set to ${PROFILES[action.profileId].label}; priors regenerated`)],
      };
    }

    case "set_subject": {
      const { subject, source, proposal, rawText } = action;
      const edits = proposal ? diffFields(proposal as unknown as Record<string, unknown>, subject as unknown as Record<string, unknown>) : null;
      const data = { raw_text: rawText ?? null, ai_proposal: proposal ?? null, ic_confirmed: subject, ic_edits: edits, source };
      const who = `${subject.name ? `${subject.name}, ` : ""}${PROFILES[subject.category].label}`;
      if (state.started || !state.lkp) {
        // After the search starts the priors are locked; the details still update the urgency chart and the record.
        return {
          ...state,
          subject,
          profileId: subject.category,
          audit: [...state.audit, makeAudit("subject", `Subject details ${state.started ? "updated (priors locked)" : "set"}: ${who} (${source})`, data)],
        };
      }
      const next = regenerate(state, state.lkp, subject.category, subject);
      return {
        ...next,
        audit: [...state.audit, makeAudit("subject", `Subject confirmed: ${who} (${source}); priors regenerated`, data)],
      };
    }

    case "set_urgency_override": {
      const urgencyOverrides = { ...state.urgencyOverrides };
      if (action.score === null || action.score === action.proposed) delete urgencyOverrides[action.key];
      else urgencyOverrides[action.key] = action.score;
      const summary =
        action.score === null || action.score === action.proposed
          ? `IC restored proposed urgency score for ${action.key} (${action.proposed})`
          : `IC set urgency ${action.key} to ${action.score} (proposed ${action.proposed})${action.reason ? `: "${action.reason}"` : ""}`;
      return {
        ...state,
        urgencyOverrides,
        audit: [...state.audit, makeAudit("urgency", summary, { key: action.key, proposed: action.proposed, score: action.score, reason: action.reason ?? null })],
      };
    }

    case "edit_cell_poa": {
      if (state.started || !state.prob) return state;
      const before = state.prob.cells[action.cell];
      const prob = setCellPoa(state.prob, action.cell, action.value);
      return {
        ...state,
        prob,
        priorsEdited: true,
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
      const pod = clampPod(confirmed.estimated_pod);
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

    case "set_explanation": {
      const reports = state.reports.map((r) =>
        r.id === action.reportId ? { ...r, explanation: { ...action.explanation, source: action.source } } : r,
      );
      return {
        ...state,
        reports,
        audit: [
          ...state.audit,
          makeAudit("explanation", `Explanation for ${action.reportId} (${action.source})`, {
            report_id: action.reportId,
            ...action.explanation,
            source: action.source,
          }),
        ],
      };
    }

    case "log":
      return { ...state, audit: [...state.audit, action.entry] };

    case "set_terrain": {
      if (state.started) return state; // never change terrain under applied updates
      const next = { ...state, terrain: action.terrain };
      if (!state.lkp || !state.prob) return next;
      if (state.priorsEdited) {
        return {
          ...next,
          audit: [...state.audit, makeAudit("setup", `Terrain changed to ${action.terrain.label}; IC-edited priors kept`)],
        };
      }
      return {
        ...regenerate(next, state.lkp, state.profileId),
        audit: [...state.audit, makeAudit("setup", `Terrain: ${action.terrain.label}; priors regenerated`)],
      };
    }

    case "demo_load": {
      const base = { ...initialState(action.terrain), demo: true, profileId: action.profileId };
      const next = regenerate(base, action.lkp, action.profileId, action.subject);
      return {
        ...next,
        audit: [
          makeAudit("setup", "Demo scenario loaded"),
          makeAudit(
            "setup",
            `LKP set to ${action.lkp}; priors generated (${PROFILES[action.profileId].label}, ${action.terrain.label} terrain)`,
          ),
        ],
      };
    }

    case "demo_advance":
      return { ...state, demoStep: state.demoStep + 1 };

    case "mark_found":
      return {
        ...state,
        found: { cell: action.cell, at: new Date().toISOString(), text: action.text },
        audit: [...state.audit, makeAudit("note", `Subject located in ${action.cell}: ${action.text}`)],
      };

    case "reset":
      return { ...initialState(state.terrain), audit: [makeAudit("reset", "Search reset")] };
  }
}

export function cumulativePodMap(pods: Record<CellId, number[]>): Record<CellId, number> {
  const out: Record<CellId, number> = {};
  for (const [c, list] of Object.entries(pods)) out[c] = list.reduce((acc, p) => addPod(acc, p), 0);
  return out;
}

const STORAGE_KEY = "trailhead:v1";

/** Reject saved state that is old, truncated or hand-edited, so a refresh starts clean instead of crashing. */
export function isUsableState(s: unknown): s is SearchState {
  if (!s || typeof s !== "object") return false;
  const st = s as Partial<SearchState>;
  if (st.version !== 1 || !st.terrain?.cells || !Array.isArray(st.audit)) return false;
  if (st.prob == null) return true;
  if (typeof st.prob !== "object" || typeof st.prob.cells !== "object" || !st.prob.cells) return false;
  try {
    assertSumToOne(st.prob);
    return Object.keys(st.prob.cells).every((c) => c in st.terrain!.cells);
  } catch {
    return false;
  }
}

export function loadState(): SearchState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as SearchState;
    return isUsableState(s) ? { ...initialState(), ...s } : null;
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
