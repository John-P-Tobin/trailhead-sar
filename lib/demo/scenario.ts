// Scripted demo: a day hiker overdue from the Hollow Trail junction.
// Every step still goes through the normal UI: the IC reviews each parse,
// picks the clue boost, and makes the assignment.
import { ParsedReport } from "../schemas";
import { BoostLevel } from "../engine/clues";
import { CellId } from "../engine/grid";
import { ProfileId } from "../profiles";

export const DEMO_LKP: CellId = "H8";
export const DEMO_PROFILE: ProfileId = "day_hiker";
export const DEMO_SUBJECT = "Dan, 58, day hiker. Left the Hollow Trail junction (H8) around 1 p.m.; overdue since 5 p.m.";

export type DemoStep =
  | { kind: "report"; id: string; title: string; text: string; canned: ParsedReport; note: string }
  | { kind: "clue"; id: string; title: string; text: string; cell: CellId; radius: number; suggestedBoost: BoostLevel; note: string }
  | { kind: "override"; id: string; title: string; tip: string; team: string; cell: CellId; reason: string; note: string }
  | { kind: "found"; id: string; title: string; text: string; cell: CellId; note: string };

export const DEMO_STEPS: DemoStep[] = [
  {
    kind: "report",
    id: "r1",
    title: "Hasty search of the Hollow Trail",
    text: "Command, Team 1. Hasty search done on the Hollow Trail from the junction down to H12, two of us calling and whistling the whole way, good visibility. Nothing. No clues.",
    canned: {
      team: "Team 1",
      cells: ["H8", "H9", "H10", "H11", "H12"],
      coverage_description: "Hasty trail search, 2 searchers calling and whistling",
      estimated_pod: 0.5,
      pod_confidence: "med",
      conditions: ["good visibility"],
      clues: [],
      unclear_points: ["Off-trail width covered on each side not stated"],
    },
    note: "Early sweeps clear the trail corridor. Watch the trail cells cool and ROW tick up.",
  },
  {
    kind: "report",
    id: "r2",
    title: "Trail corridor line search",
    text: "Team 2 to command. We line-searched the Notch Trail G8 through E7 and up the Ridge Trail to J6. Spacing about 15 meters, mixed hardwood and spruce. Negative, no clues.",
    canned: {
      team: "Team 2",
      cells: ["G8", "F7", "E7", "I7", "J6"],
      coverage_description: "Line search ~15 m spacing, mixed hardwood and spruce",
      estimated_pod: 0.6,
      pod_confidence: "high",
      conditions: [],
      clues: [],
      unclear_points: [],
    },
    note: "The corridor is mostly cleared. Probability shifts off-trail toward the drainages.",
  },
  {
    kind: "report",
    id: "r3",
    title: "Fog on Hollow Brook",
    text: "Team 1, we pushed down Hollow Brook through G9 and F10 but fog came in thick, maybe 10 meters visibility, spacing maybe 25. Not sure we really covered the east half of G9. No clues.",
    canned: {
      team: "Team 1",
      cells: ["G9", "F10"],
      coverage_description: "Line search ~25 m spacing in thick fog",
      estimated_pod: 0.25,
      pod_confidence: "low",
      conditions: ["fog", "~10 m visibility"],
      clues: [],
      unclear_points: ["Coverage of the east half of G9 is uncertain", "Spacing was estimated (\"maybe 25\")"],
    },
    note: "Low-confidence parse is flagged amber. Fog keeps POD low, so these cells are NOT cleared much.",
  },
  {
    kind: "clue",
    id: "c1",
    title: "Clue on the brook",
    text: "Team 4 found a fresh granola-bar wrapper on the Hollow Brook bank at E11 — same brand his wife packed.",
    cell: "E11",
    radius: 1,
    suggestedBoost: "medium",
    note: "The IC decides how much the wrapper matters. The AI never weights clues.",
  },
  {
    kind: "report",
    id: "r4",
    title: "Ledge Brook cleared",
    text: "Team 2, we swept Ledge Brook K8 down to L11. Open hardwood, 15 meter spacing, good light. Negative.",
    canned: {
      team: "Team 2",
      cells: ["K8", "K9", "L10", "L11"],
      coverage_description: "Line search ~15 m spacing, open hardwood",
      estimated_pod: 0.7,
      pod_confidence: "high",
      conditions: ["good light"],
      clues: [],
      unclear_points: [],
    },
    note: "The other drainage is ruled down. Hollow Brook now stands out.",
  },
  {
    kind: "override",
    id: "o1",
    title: "Family tip → IC override",
    tip: "Command post: his wife says when he's turned around he always follows water downhill to find a road.",
    team: "Team 3",
    cell: "E12",
    reason: "Family tip: follows water downhill; E12 is downstream of the wrapper",
    note: "The IC sends Team 3 downstream to E12 instead of the top suggestion, and logs why.",
  },
  {
    kind: "found",
    id: "f1",
    title: "Subject located",
    text: "Team 3: subject located in E12 beside Hollow Brook. Cold and tired, responsive, walking with assistance.",
    cell: "E12",
    note: "Found where the model ranked high and the human judgment pointed.",
  },
];
