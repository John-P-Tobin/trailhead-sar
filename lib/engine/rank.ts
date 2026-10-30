// Suggestion ranking: POA × expected POD for the next sweep, weather-adjusted.
// These are SUGGESTIONS for the IC, who assigns teams. Base PODs are illustrative.

import { CellId } from "./grid";
import { ProbState } from "./bayes";
import { Cover, TERRAIN } from "../terrain";

/** Illustrative expected POD for one line-search sweep at ~20 m spacing, by vegetation. */
export const BASE_POD: Record<Cover, number> = { open: 0.75, hardwood: 0.6, spruce: 0.45, alpine: 0.65 };

/** Cells with cumulative POD at or above this are treated as well searched. */
export const WELL_SEARCHED = 0.8;

export function expectedPod(cell: CellId, weatherFactor = 1): number {
  const t = TERRAIN[cell];
  let p = BASE_POD[t.cover];
  if (t.cliff || t.water) p = Math.min(p, 0.3);
  return Math.max(0, Math.min(1, p * weatherFactor));
}

export interface Suggestion {
  cell: CellId;
  poa: number;
  expectedPod: number;
  cumulativePod: number;
  score: number;
}

export function rankCells(
  prob: ProbState,
  cumPod: Record<CellId, number>,
  weatherFactor = 1,
  n = 5,
): Suggestion[] {
  return Object.entries(prob.cells)
    .filter(([cell, poa]) => poa > 1e-6 && (cumPod[cell] ?? 0) < WELL_SEARCHED)
    .map(([cell, poa]) => {
      const e = expectedPod(cell, weatherFactor);
      return { cell, poa, expectedPod: e, cumulativePod: cumPod[cell] ?? 0, score: poa * e };
    })
    .sort((a, b) => b.score - a.score || b.poa - a.poa)
    .slice(0, n);
}
