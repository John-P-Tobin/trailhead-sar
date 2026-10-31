"use client";

import { useState } from "react";
import Panel from "./ui/Panel";
import { btnPrimary, btnSecondary, input, label } from "./ui/styles";
import { Suggestion } from "@/lib/engine/rank";
import { isCellId } from "@/lib/engine/grid";
import { PodModifier } from "@/lib/weather";
import { CellTerrain, describeCell } from "@/lib/terrain";
import { Assignment } from "@/lib/store";

const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;

export default function SuggestionsPanel({
  suggestions,
  modifiers,
  weatherFactor,
  flaggedCells,
  assignments,
  selectedCell,
  prefill,
  terrain,
  onAssign,
}: {
  suggestions: Suggestion[];
  modifiers: PodModifier[];
  weatherFactor: number;
  flaggedCells: Set<string>;
  assignments: Assignment[];
  selectedCell: string | null;
  terrain: Record<string, CellTerrain>;
  /** Initial values (used by demo mode). Remount with a new key to apply. */
  prefill?: { team: string; cell: string; reason: string } | null;
  onAssign: (a: { team: string; cell: string; suggestedRank: number | null; topSuggestion: string | null; reason?: string }) => void;
}) {
  const [team, setTeam] = useState(prefill?.team ?? "");
  const [cell, setCell] = useState(prefill?.cell ?? "");
  const [askReason, setAskReason] = useState(false);
  const [reason, setReason] = useState(prefill?.reason ?? "");
  const top = suggestions[0]?.cell ?? null;
  const target = (cell || selectedCell || "").toUpperCase();
  const valid = isCellId(target) && team.trim().length > 0;

  const finish = (withReason?: string) => {
    const rank = suggestions.findIndex((s) => s.cell === target);
    onAssign({
      team: team.trim(),
      cell: target,
      suggestedRank: rank >= 0 ? rank + 1 : null,
      topSuggestion: top,
      reason: withReason,
    });
    setAskReason(false);
    setReason("");
    setCell("");
  };

  const submit = () => {
    if (!valid) return;
    if (top && target !== top) setAskReason(true);
    else finish();
  };

  return (
    <Panel title="Suggestions" right={<span className="text-[11px] text-slate-500">You assign teams</span>}>
      <p className="mb-2 text-xs text-slate-400">
        Ranked by POA × expected POD for the next sweep. These are suggestions only.
      </p>
      {modifiers.length > 0 && (
        <div className="mb-2 rounded-md bg-sky-950/40 px-2 py-1.5 text-xs text-sky-200">
          Expected POD × {weatherFactor.toFixed(2)} for current weather — {modifiers.map((m) => m.label).join("; ")}
        </div>
      )}
      {suggestions.length === 0 ? (
        <p className="text-sm text-slate-400">No under-searched cells remain on the grid. ROW is shown above; that call stays with you.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="text-[10px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="py-1">#</th>
              <th>Cell</th>
              <th className="text-right">POA</th>
              <th className="text-right">Exp. POD</th>
              <th className="text-right">Score</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {suggestions.map((s, i) => (
              <tr key={s.cell} className="border-t border-slate-800">
                <td className="py-1.5 text-sky-300">{i + 1}</td>
                <td>
                  <span className="font-mono font-semibold">{s.cell}</span>
                  {flaggedCells.has(s.cell) && <span title="Weather safety flag on this cell"> ⚠</span>}
                  <div className="text-[10px] text-slate-500">
                    {describeCell(terrain[s.cell])}
                    {s.cumulativePod > 0 && ` · searched ${pct(s.cumulativePod, 0)}`}
                  </div>
                </td>
                <td className="text-right font-mono tabular-nums">{pct(s.poa)}</td>
                <td className="text-right font-mono tabular-nums">{pct(s.expectedPod, 0)}</td>
                <td className="text-right font-mono tabular-nums">{(s.score * 1000).toFixed(1)}</td>
                <td className="text-right">
                  <button className="text-xs text-sky-300 hover:underline" onClick={() => setCell(s.cell)}>
                    Pick
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="mt-3 grid grid-cols-[1fr_1fr_auto] items-end gap-2">
        <div>
          <label className={label}>Team</label>
          <input className={input} value={team} onChange={(e) => setTeam(e.target.value)} placeholder="Team 3" />
        </div>
        <div>
          <label className={label}>Cell (any cell)</label>
          <input
            className={`${input} font-mono uppercase`}
            value={cell || selectedCell || ""}
            onChange={(e) => setCell(e.target.value)}
            placeholder={top ?? "E12"}
          />
        </div>
        <button className={btnPrimary} disabled={!valid} onClick={submit}>
          Assign
        </button>
      </div>

      {askReason && (
        <div className="mt-3 rounded-md border border-violet-500/50 bg-violet-950/30 p-3">
          <div className="text-sm text-violet-100">
            You chose <span className="font-mono font-semibold">{target}</span> over the top suggestion{" "}
            <span className="font-mono">{top}</span>. Your call — want to note why? (optional, logged for the after-action
            review)
          </div>
          <input
            autoFocus
            className={`${input} mt-2`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && finish(reason)}
            placeholder="e.g. family says he always follows streams downhill"
            maxLength={200}
          />
          <div className="mt-2 flex justify-end gap-2">
            <button className={btnSecondary} onClick={() => finish()}>
              Skip reason
            </button>
            <button className={btnPrimary} onClick={() => finish(reason)}>
              Assign with reason
            </button>
          </div>
        </div>
      )}

      {assignments.length > 0 && (
        <div className="mt-3">
          <div className={label}>Assignments</div>
          <ul className="space-y-1 text-xs">
            {[...assignments].reverse().map((a) => (
              <li key={a.id} className="flex justify-between gap-2 rounded bg-slate-950/50 px-2 py-1">
                <span>
                  <span className="font-medium">{a.team}</span> → <span className="font-mono">{a.cell}</span>
                  {a.override && <span className="ml-1 text-violet-300">(IC override{a.reason ? `: ${a.reason}` : ""})</span>}
                </span>
                <span className="text-slate-500">{new Date(a.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}
