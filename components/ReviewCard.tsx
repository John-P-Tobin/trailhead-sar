"use client";

import { useState } from "react";
import { expandCellRefs } from "@/lib/engine/grid";
import { ParsedReport, PodConfidence } from "@/lib/schemas";
import { ReportSource } from "@/lib/store";
import { btnGhost, btnPrimary, input, label } from "./ui/styles";

const SOURCE_LABEL: Record<ReportSource, string> = {
  claude: "Proposed by Claude — review every value",
  canned: "Demo fallback parse (Claude unavailable) — review every value",
  manual: "Manual entry",
};

const splitList = (s: string) =>
  s
    .split(/[;,\n]/)
    .map((x) => x.trim())
    .filter(Boolean);

export default function ReviewCard({
  draft,
  proposal,
  source,
  onChange,
  onApply,
  onCancel,
}: {
  draft: ParsedReport;
  proposal: ParsedReport | null;
  source: ReportSource;
  onChange: (d: ParsedReport) => void;
  onApply: () => void;
  onCancel: () => void;
}) {
  const [cellText, setCellText] = useState("");
  const [conditionsText, setConditionsText] = useState(draft.conditions.join(", "));
  const [cluesText, setCluesText] = useState(draft.clues.join("; "));
  const low = draft.pod_confidence === "low";
  const set = <K extends keyof ParsedReport>(k: K, v: ParsedReport[K]) => onChange({ ...draft, [k]: v });
  const changed = (k: keyof ParsedReport) =>
    proposal && JSON.stringify(proposal[k]) !== JSON.stringify(draft[k]) ? "border-sky-500/70" : "";

  const addCells = () => {
    const cells = expandCellRefs(cellText);
    if (cells.length) set("cells", [...new Set([...draft.cells, ...cells])]);
    setCellText("");
  };

  return (
    <div className={`rounded-lg border p-3 ${low ? "border-amber-500/70 bg-amber-950/20" : "border-sky-700/60 bg-slate-950/40"}`}>
      {low && (
        <div className="mb-3 rounded-md border border-amber-500/60 bg-amber-500/15 px-3 py-2 text-sm font-semibold text-amber-200">
          ⚠ Low confidence — verify with team before applying.
        </div>
      )}
      <div className="mb-3 flex items-center justify-between text-xs">
        <span className={source === "manual" ? "text-slate-400" : "text-sky-300"}>{SOURCE_LABEL[source]}</span>
        {proposal && <span className="text-slate-500">Blue border = edited by IC</span>}
      </div>

      {draft.unclear_points.length > 0 && (
        <div className="mb-3 rounded-md border border-amber-600/40 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
          <div className="mb-1 font-semibold uppercase tracking-wider">Unclear in report</div>
          <ul className="list-disc pl-4">
            {draft.unclear_points.map((u, i) => (
              <li key={i}>{u}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>Team</label>
          <input className={`${input} ${changed("team")}`} value={draft.team} onChange={(e) => set("team", e.target.value)} placeholder="Team 2" />
        </div>
        <div>
          <label className={label}>POD confidence</label>
          <select
            className={`${input} ${changed("pod_confidence")}`}
            value={draft.pod_confidence}
            onChange={(e) => set("pod_confidence", e.target.value as PodConfidence)}
          >
            <option value="low">Low</option>
            <option value="med">Medium</option>
            <option value="high">High</option>
          </select>
        </div>

        <div className="col-span-2">
          <label className={label}>Cells searched (click map cells or type, e.g. “C4-C6”)</label>
          <div className={`flex min-h-9 flex-wrap items-center gap-1 rounded-md border border-slate-700 bg-slate-950 p-1 ${changed("cells")}`}>
            {draft.cells.map((c) => (
              <button
                key={c}
                type="button"
                className="rounded bg-slate-700 px-1.5 py-0.5 font-mono text-xs hover:bg-rose-700"
                onClick={() => set("cells", draft.cells.filter((x) => x !== c))}
                title="Remove"
              >
                {c} ×
              </button>
            ))}
            <input
              className="min-w-20 flex-1 bg-transparent px-1 text-sm focus:outline-none"
              value={cellText}
              onChange={(e) => setCellText(e.target.value)}
              onBlur={addCells}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCells();
                }
              }}
              placeholder={draft.cells.length ? "" : "H9-H11"}
            />
          </div>
        </div>

        <div className="col-span-2">
          <label className={label}>
            Estimated POD per cell: <span className="font-mono text-slate-200">{(draft.estimated_pod * 100).toFixed(0)}%</span>
            {proposal && proposal.estimated_pod !== draft.estimated_pod && (
              <span className="ml-2 text-sky-300">(AI proposed {(proposal.estimated_pod * 100).toFixed(0)}%)</span>
            )}
          </label>
          <input
            type="range"
            min={0}
            max={95}
            step={5}
            value={Math.round(draft.estimated_pod * 100)}
            onChange={(e) => set("estimated_pod", Number(e.target.value) / 100)}
            className="w-full accent-sky-400"
          />
        </div>

        <div className="col-span-2">
          <label className={label}>Coverage description</label>
          <input
            className={`${input} ${changed("coverage_description")}`}
            value={draft.coverage_description}
            onChange={(e) => set("coverage_description", e.target.value)}
            placeholder="Line search, 20 m spacing, thick spruce"
          />
        </div>
        <div>
          <label className={label}>Conditions</label>
          <input
            className={`${input} ${changed("conditions")}`}
            value={conditionsText}
            onChange={(e) => {
              setConditionsText(e.target.value);
              set("conditions", splitList(e.target.value));
            }}
            placeholder="fog, dusk"
          />
        </div>
        <div>
          <label className={label}>Clues reported</label>
          <input
            className={`${input} ${changed("clues")}`}
            value={cluesText}
            onChange={(e) => {
              setCluesText(e.target.value);
              set("clues", splitList(e.target.value));
            }}
            placeholder="none"
          />
        </div>
      </div>
      {draft.clues.length > 0 && (
        <p className="mt-2 text-xs text-violet-300">
          Clues are logged but not weighted automatically. Use the Clues panel to choose a boost.
        </p>
      )}

      <div className="mt-4 flex items-center justify-end gap-2">
        <button className={btnGhost} onClick={onCancel}>
          Discard
        </button>
        <button className={btnPrimary} onClick={onApply} disabled={draft.cells.length === 0}>
          Apply to map
        </button>
      </div>
    </div>
  );
}
