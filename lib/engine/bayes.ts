// Bayesian search update. Pure functions, no I/O.
//
// For a searched cell i with detection probability p:
//   P_i' = P_i (1 − p) / (1 − P_i p)
//   P_j' = P_j / (1 − P_i p)        for every other cell j and Rest of World (ROW)

import { CellId } from "./grid";

export interface ProbState {
  cells: Record<CellId, number>;
  /** Rest of World: probability the subject is outside the grid. */
  row: number;
}

export interface SweepCell {
  cell: CellId;
  pod: number; // 0–1
}

export const SUM_TOLERANCE = 1e-6;

export function total(state: ProbState): number {
  let s = state.row;
  for (const v of Object.values(state.cells)) s += v;
  return s;
}

export function assertSumToOne(state: ProbState, tol = SUM_TOLERANCE): void {
  const s = total(state);
  if (!Number.isFinite(s) || Math.abs(s - 1) > tol) {
    throw new Error(`Probabilities must sum to 1 (got ${s})`);
  }
  if (state.row < 0 || Object.values(state.cells).some((v) => v < 0)) {
    throw new Error("Probabilities must be non-negative");
  }
}

/** Rescale so the total is exactly 1 (only for floating-point drift). */
export function normalize(state: ProbState): ProbState {
  const s = total(state);
  if (!(s > 0)) throw new Error("Cannot normalize a zero-probability state");
  const cells: Record<CellId, number> = {};
  for (const [k, v] of Object.entries(state.cells)) cells[k] = v / s;
  return { cells, row: state.row / s };
}

export function clampPod(p: number): number {
  if (!Number.isFinite(p)) return 0;
  return Math.min(1, Math.max(0, p));
}

/** Single-cell Bayesian update for an unsuccessful search of `cell` at POD `pod`. */
export function applySweep(state: ProbState, cell: CellId, pod: number): ProbState {
  if (!(cell in state.cells)) throw new Error(`Unknown cell ${cell}`);
  const p = clampPod(pod);
  const pi = state.cells[cell];
  const denom = 1 - pi * p;
  if (denom <= 1e-12) {
    throw new Error(`Search of ${cell} at POD ${p} leaves no remaining probability`);
  }
  const cells: Record<CellId, number> = {};
  for (const [k, v] of Object.entries(state.cells)) {
    cells[k] = k === cell ? (v * (1 - p)) / denom : v / denom;
  }
  const next = { cells, row: state.row / denom };
  assertSumToOne(next);
  return next;
}

/** Apply a report's cells one after another. */
export function applySweeps(state: ProbState, sweeps: SweepCell[]): ProbState {
  return sweeps.reduce((s, sw) => applySweep(s, sw.cell, sw.pod), state);
}

/** Cumulative POD across sweeps: 1 − Π(1 − p_k). */
export function cumulativePod(pods: number[]): number {
  return 1 - pods.reduce((acc, p) => acc * (1 - clampPod(p)), 1);
}

/** Add one more sweep to an existing cumulative POD. */
export function addPod(prevCumulative: number, pod: number): number {
  return cumulativePod([prevCumulative, pod]);
}

/**
 * Set one cell's POA (prior editing). Other grid cells are rescaled
 * proportionally so the total stays 1; ROW is left unchanged.
 */
export function setCellPoa(state: ProbState, cell: CellId, value: number): ProbState {
  const cellBudget = 1 - state.row;
  const v = Math.min(cellBudget, Math.max(0, value));
  const othersOld = cellBudget - state.cells[cell];
  const othersNew = cellBudget - v;
  const cells: Record<CellId, number> = {};
  for (const [k, old] of Object.entries(state.cells)) {
    if (k === cell) cells[k] = v;
    else cells[k] = othersOld > 0 ? (old * othersNew) / othersOld : othersNew / (Object.keys(state.cells).length - 1);
  }
  const next = { cells, row: state.row };
  assertSumToOne(next);
  return next;
}

/** Set the ROW share, rescaling grid cells proportionally. */
export function setRow(state: ProbState, row: number): ProbState {
  const r = Math.min(0.99, Math.max(0, row));
  const scale = (1 - r) / (1 - state.row);
  const cells: Record<CellId, number> = {};
  for (const [k, v] of Object.entries(state.cells)) cells[k] = v * scale;
  const next = { cells, row: r };
  assertSumToOne(next);
  return next;
}
