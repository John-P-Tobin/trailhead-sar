// Scripted demo on the bundled OpenStreetMap terrain (Mt Washington / Lakes of the
// Clouds): a day hiker overdue after leaving the Lakes of the Clouds hut in fog.
// Every step still goes through the normal UI: the IC reviews each parse,
// picks the clue boost, and makes the assignment.
import { ParsedReport } from "../schemas";
import { BoostLevel } from "../engine/clues";
import { CellId } from "../engine/grid";
import { ProfileId } from "../profiles";
import { Subject } from "../subject";

/** Lakes of the Clouds hut: junction of the Crawford Path, Ammonoosuc Ravine and Dry River trails. */
export const DEMO_LKP: CellId = "E10";
export const DEMO_PROFILE: ProfileId = "day_hiker";
export const DEMO_SUBJECT =
  "Dan, 58, day hiker. Left the Lakes of the Clouds hut (E10) for the summit around 1 p.m. in fog; overdue since 5 p.m.";

/** The initial call-out as the presenter pastes it; Claude pre-fills the subject card from it. */
export const DEMO_CALLOUT =
  "Caller is the wife of Dan Harper, 58. Day hiker, fit, hikes most weekends, no medical conditions or meds. Left the Lakes of the Clouds hut alone about 1 p.m. heading for the summit as fog came in. Light rain shell, day pack, no headlamp that she knows of. Overdue since 5 p.m.";

/** Hours before the demo is loaded that Dan was last seen (keeps the story the same whenever it runs). */
export const DEMO_MISSING_HOURS = 6;

/** The canned subject for when Claude is unavailable; `lastSeenAt` is filled at load time. */
export function demoSubject(now = Date.now()): Subject {
  return {
    category: "day_hiker",
    name: "Dan Harper",
    ageBand: "adult",
    experience: "some",
    fitness: "high",
    medical: "none",
    equipment: "questionable",
    partySize: 1,
    lastSeenAt: new Date(now - DEMO_MISSING_HOURS * 3600_000).toISOString(),
    intent: "Heading for the summit from the hut as fog came in",
    notes: "Light rain shell, day pack, probably no headlamp",
  };
}

export type DemoStep =
  | { kind: "callout"; id: string; title: string; text: string; note: string }
  | { kind: "report"; id: string; title: string; text: string; canned: ParsedReport; note: string }
  | { kind: "clue"; id: string; title: string; text: string; cell: CellId; radius: number; suggestedBoost: BoostLevel; note: string }
  | { kind: "override"; id: string; title: string; tip: string; team: string; cell: CellId; reason: string; note: string }
  | { kind: "found"; id: string; title: string; text: string; cell: CellId; note: string };

export const DEMO_STEPS: DemoStep[] = [
  {
    kind: "callout",
    id: "c0",
    title: "Call-out",
    text: DEMO_CALLOUT,
    note: "Claude pre-fills the subject card from the call-out; the IC confirms every field. The urgency chart and the distance model follow from it.",
  },
  {
    kind: "report",
    id: "r1",
    title: "Hasty search toward the summit",
    text: "Command, Team 1. Hasty search done on the Crawford Path from the hut at E10 up through F10, G10 and G9, two of us calling and whistling the whole way, visibility okay. Nothing. No clues.",
    canned: {
      team: "Team 1",
      cells: ["E10", "F10", "G10", "G9"],
      coverage_description: "Hasty trail search, 2 searchers calling and whistling",
      estimated_pod: 0.5,
      pod_confidence: "med",
      conditions: ["fair visibility"],
      clues: [],
      unclear_points: ["Off-trail width covered on each side not stated"],
    },
    note: "Early sweeps clear the trail corridor. Watch the trail cells cool and ROW tick up.",
  },
  {
    kind: "report",
    id: "r2",
    title: "Trail corridors at the hut",
    text: "Team 2 to command. We line-searched all around the hut: the hut grounds and the knoll west of it, E10 and D10, the top of the Ammonoosuc Ravine Trail through E9 and D9, both sides of the Crawford Path toward Monroe, E11, E12, D12 and F12, and the first stretch of the Dry River Trail in F11. Spacing about 15 meters, krummholz and rock. Negative, no clues.",
    canned: {
      team: "Team 2",
      cells: ["E10", "D10", "E9", "D9", "E11", "E12", "D12", "F12", "F11"],
      coverage_description: "Line search ~15 m spacing around the hut, krummholz and rock",
      estimated_pod: 0.6,
      pod_confidence: "high",
      conditions: [],
      clues: [],
      unclear_points: [],
    },
    note: "The corridors around the hut are mostly cleared. Probability shifts downhill into the two drainages.",
  },
  {
    kind: "report",
    id: "r3",
    title: "Fog on the Dry River Trail",
    text: "Team 1, we pushed down the Dry River Trail into Oakes Gulf through F11, G11 and G12 but the fog came in thick, maybe 10 meters visibility, spacing maybe 25. Not sure we really covered the east half of G11. No clues.",
    canned: {
      team: "Team 1",
      cells: ["F11", "G11", "G12"],
      coverage_description: "Line search ~25 m spacing in thick fog",
      estimated_pod: 0.25,
      pod_confidence: "low",
      conditions: ["fog", "~10 m visibility"],
      clues: [],
      unclear_points: ["Coverage of the east half of G11 is uncertain", 'Spacing was estimated ("maybe 25")'],
    },
    note: "Low-confidence parse is flagged amber. Fog keeps POD low, so these cells are NOT cleared much.",
  },
  {
    kind: "clue",
    id: "c1",
    title: "Clue on the Dry River Trail",
    text: "Team 4, coming up from the Dry River trailhead, found a fresh granola-bar wrapper on the Dry River Trail at G13. Same brand his wife packed, but it's a busy trail.",
    cell: "G13",
    radius: 1,
    suggestedBoost: "small",
    note: "The IC decides how much the wrapper matters. On a busy trail a cautious small boost is reasonable. The AI never weights clues.",
  },
  {
    kind: "report",
    id: "r4",
    title: "Ammonoosuc Ravine cleared",
    text: "Team 2, we swept the Ammonoosuc Ravine below the hut, D8 and D7 down to C7, B8 and B9 by Gem Pool. 15 meter spacing, good light under the fog. Negative.",
    canned: {
      team: "Team 2",
      cells: ["D8", "D7", "C7", "B8", "B9"],
      coverage_description: "Line search ~15 m spacing, spruce, good light",
      estimated_pod: 0.7,
      pod_confidence: "high",
      conditions: ["good light"],
      clues: [],
      unclear_points: [],
    },
    note: "The other drainage is ruled down. The Dry River drainage now stands out.",
  },
  {
    kind: "override",
    id: "o1",
    title: "Family tip → IC override",
    tip: "Command post: his wife says when he's turned around he always follows water downhill to find a road.",
    team: "Team 3",
    cell: "G14",
    reason: "Family tip: follows water downhill; G14 is downstream of the wrapper on the Dry River",
    note: "The model ranks the wrapper cell (G13) first and the fogged G11 second. The IC sends Team 3 downstream to G14, the model's #3, and logs why.",
  },
  {
    kind: "found",
    id: "f1",
    title: "Subject located",
    text: "Team 3: subject located in G14 beside the Dry River. Cold and tired, responsive, walking with assistance.",
    cell: "G14",
    note: "Found where the model ranked high and the human judgment pointed.",
  },
];
