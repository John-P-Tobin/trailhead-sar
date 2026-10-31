// Clue weighting. The IC chooses the boost; the AI never weights clues.
// A boost is a likelihood ratio applied to cells near the clue (fading with
// distance), then everything — including ROW — is renormalized.

import { CellId, cellsWithin, distance } from "./grid";
import { ProbState, assertSumToOne, normalize } from "./bayes";

export type BoostLevel = "none" | "small" | "medium" | "large";

export const BOOST_FACTORS: Record<BoostLevel, number> = {
  none: 1,
  small: 1.5,
  medium: 2.5,
  large: 4,
};

export function applyClue(state: ProbState, center: CellId, radius: number, factor: number): ProbState {
  if (!(factor > 0)) throw new Error("Clue factor must be positive");
  const cells = { ...state.cells };
  for (const c of cellsWithin(center, radius)) {
    const falloff = 1 - distance(center, c) / (radius + 1);
    cells[c] *= 1 + (factor - 1) * falloff;
  }
  const next = normalize({ cells, row: state.row });
  assertSumToOne(next);
  return next;
}
