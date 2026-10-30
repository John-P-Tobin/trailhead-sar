// Builds the update summary sent to /api/explain, and a plain local fallback
// explanation for when Claude is unavailable.
import { Explanation } from "./schemas";
import { AppliedReport } from "./store";
import { ProbState } from "./engine/bayes";

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

export function topCells(prob: ProbState, n = 5) {
  return Object.entries(prob.cells)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
}

export function buildUpdateSummary(report: AppliedReport, prob: ProbState, extra: string[] = []): string {
  return [
    `Report applied: ${report.team} searched ${report.cells.join(", ")}.`,
    `Coverage: ${report.coverage || "not described"}. Conditions: ${report.conditions.join(", ") || "none noted"}.`,
    `IC-confirmed POD per cell: ${pct(report.pod)} (parse confidence: ${report.podConfidence}).`,
    `Largest POA changes: ${report.shifts.map((s) => `${s.cell} ${pct(s.before)} → ${pct(s.after)}`).join("; ")}.`,
    `ROW (outside grid): ${pct(report.rowBefore)} → ${pct(report.rowAfter)}.`,
    `Highest-POA cells now: ${topCells(prob).map(([c, v]) => `${c} ${pct(v)}`).join(", ")}.`,
    ...extra,
  ].join("\n");
}

export function localExplanation(report: AppliedReport, prob: ProbState): Explanation {
  const searched = report.shifts.filter((s) => report.cells.includes(s.cell));
  const drop = searched.reduce((a, s) => a + (s.before - s.after), 0);
  const top = topCells(prob, 3)
    .map(([c]) => c)
    .join(", ");
  return {
    explanation: `${report.team}'s unsuccessful sweep of ${report.cells.join(", ")} at ${pct(report.pod)} POD removed about ${pct(
      Math.max(drop, 0),
    )} of probability from those cells. That probability was spread proportionally over every other cell and ROW, which rose from ${pct(
      report.rowBefore,
    )} to ${pct(report.rowAfter)}. The highest-POA cells are now ${top}.`,
    least_certain_assumption: `The ${pct(report.pod)} POD estimate${
      report.conditions.length ? ` under ${report.conditions.join(", ")}` : ""
    }: if detection was lower than assumed, these cells were cleared too aggressively.`,
  };
}
