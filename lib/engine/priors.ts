// Prior POA generator: distance from LKP × terrain × profile tendency.
// ILLUSTRATIVE ESTIMATES ONLY.

import { ALL_CELLS, CellId, distance } from "./grid";
import { ProbState, assertSumToOne } from "./bayes";
import { Profile } from "../profiles";
import { CellTerrain } from "../terrain";

export const DEFAULT_ROW = 0.1;

export function cellWeight(cell: CellTerrain, lkp: CellTerrain, profile: Profile): number {
  const d = distance(cell.id, lkp.id);
  let w = Math.exp(-d / profile.distanceScale);
  if (cell.trail) w *= profile.trail;
  if (cell.drainage) w *= profile.drainage;
  if (cell.ridge) w *= profile.ridge;
  if (cell.cliff) w *= profile.cliff;
  if (cell.water) w *= profile.water;
  if (cell.cover === "open") w *= profile.openGround;
  if (cell.elevation < lkp.elevation - 0.02) w *= profile.downhill;
  return w;
}

export function generatePriors(
  lkp: CellId,
  profile: Profile,
  terrain: Record<CellId, CellTerrain>,
  row: number = DEFAULT_ROW,
): ProbState {
  const l = terrain[lkp];
  if (!l) throw new Error(`Unknown LKP ${lkp}`);
  const weights = ALL_CELLS.map((c) => cellWeight(terrain[c], l, profile));
  const sum = weights.reduce((a, b) => a + b, 0);
  const cells: Record<CellId, number> = {};
  ALL_CELLS.forEach((c, i) => (cells[c] = (weights[i] / sum) * (1 - row)));
  const state = { cells, row };
  assertSumToOne(state);
  return state;
}
