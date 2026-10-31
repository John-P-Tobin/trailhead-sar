// Prior POA generator: lost-person distance behaviour × time elapsed × terrain × profile tendency.
// ILLUSTRATIVE ESTIMATES ONLY (see lib/engine/behaviour.ts for the distance table's provenance).

import { ALL_CELLS, CellId, GRID_SIZE } from "./grid";
import { ProbState, assertSumToOne } from "./bayes";
import { arealDensity, gradedDownhill, reachKm, scaledQuartiles, suggestedRow, truncatedCdf } from "./behaviour";
import { M_PER_DEG_LAT, metersPerDegLon } from "../geo";
import { PROFILES } from "../profiles";
import { hoursSince, Subject } from "../subject";
import { CellTerrain } from "../terrain";

export const DEFAULT_ROW = 0.1;

/** Stylized terrain has no metres; treat its 0–1 relief as this many metres. */
const NOMINAL_RELIEF_M = 300;

export interface PriorOptions {
  /** Hours since last seen; defaults to the subject's lastSeenAt measured from `now`. */
  hoursElapsed?: number;
  row?: number;
  now?: number;
}

/** Metres per cell, from a cell's real bounds. */
export function cellSizeOf(cell: CellTerrain): { w: number; h: number } {
  const b = cell.bounds;
  const lat = (b.north + b.south) / 2;
  return { w: (b.east - b.west) * metersPerDegLon(lat), h: (b.north - b.south) * M_PER_DEG_LAT };
}

export function metresBetween(a: CellTerrain, b: CellTerrain): number {
  const { w, h } = cellSizeOf(a);
  return Math.hypot((a.x - b.x) * w, (a.y - b.y) * h);
}

/** How far `cell` lies below `lkp`, in metres (negative when higher). */
export function dropBelowLkpM(cell: CellTerrain, lkp: CellTerrain): number {
  if (cell.elevationM !== undefined && lkp.elevationM !== undefined) return lkp.elevationM - cell.elevationM;
  return (lkp.elevation - cell.elevation) * NOMINAL_RELIEF_M;
}

export function cellWeight(cell: CellTerrain, lkp: CellTerrain, subject: Subject, hoursElapsed: number): number {
  const profile = PROFILES[subject.category];
  const { w, h } = cellSizeOf(lkp);
  const km = metresBetween(cell, lkp) / 1000;
  const minKm = (0.35 * Math.min(w, h)) / 1000;
  let weight = arealDensity(subject, hoursElapsed, km, minKm);
  if (cell.trail) weight *= profile.trail;
  if (cell.drainage) weight *= profile.drainage;
  if (cell.ridge) weight *= profile.ridge;
  if (cell.cliff) weight *= profile.cliff;
  if (cell.water) weight *= profile.water;
  if (cell.cover === "open") weight *= profile.openGround;
  weight *= gradedDownhill(profile, dropBelowLkpM(cell, lkp));
  return weight;
}

export function generatePriors(lkp: CellId, subject: Subject, terrain: Record<CellId, CellTerrain>, opts: PriorOptions = {}): ProbState {
  const l = terrain[lkp];
  if (!l) throw new Error(`Unknown LKP ${lkp}`);
  const row = opts.row ?? DEFAULT_ROW;
  const hours = opts.hoursElapsed ?? hoursSince(subject.lastSeenAt, opts.now);
  const weights = ALL_CELLS.map((c) => cellWeight(terrain[c], l, subject, hours));
  const sum = weights.reduce((a, b) => a + b, 0);
  if (!(sum > 0) || !Number.isFinite(sum)) throw new Error("Prior weights are degenerate");
  const cells: Record<CellId, number> = {};
  ALL_CELLS.forEach((c, i) => (cells[c] = (weights[i] / sum) * (1 - row)));
  const state = { cells, row };
  assertSumToOne(state);
  return state;
}

export interface PriorSummary {
  hoursElapsed: number;
  reachKm: number;
  /** 25 / 50 / 75 / 95 % distances for this subject, km. */
  quartilesKm: [number, number, number, number];
  nearestEdgeKm: number;
  /** Clamped (5–60 %) suggestion for the ROW slider. */
  suggestedRow: number;
  /** Unclamped share of the distribution beyond the nearest grid edge. */
  outsideShare: number;
}

/** What the model assumed, for the subject card and the explanation prompt. */
export function priorSummary(lkp: CellId, subject: Subject, terrain: Record<CellId, CellTerrain>, opts: PriorOptions = {}): PriorSummary {
  const l = terrain[lkp];
  if (!l) throw new Error(`Unknown LKP ${lkp}`);
  const hours = opts.hoursElapsed ?? hoursSince(subject.lastSeenAt, opts.now);
  const { w, h } = cellSizeOf(l);
  const nearestEdgeKm = Math.min((l.x + 0.5) * w, (GRID_SIZE - l.x - 0.5) * w, (l.y + 0.5) * h, (GRID_SIZE - l.y - 0.5) * h) / 1000;
  return {
    hoursElapsed: hours,
    reachKm: reachKm(subject, hours),
    quartilesKm: scaledQuartiles(subject),
    nearestEdgeKm,
    suggestedRow: suggestedRow(subject, nearestEdgeKm, hours),
    outsideShare: 1 - truncatedCdf(subject, hours, nearestEdgeKm),
  };
}
