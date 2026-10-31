"use client";

import { useState } from "react";
import Alert from "./ui/Alert";
import Button from "./ui/Button";
import Card from "./ui/Card";
import Empty from "./ui/Empty";
import Tag from "./ui/Tag";
import Tooltip from "./ui/Tooltip";
import { IconTarget, IconWarning } from "./ui/icons";
import { input, label, listRow } from "./ui/styles";
import { Suggestion } from "@/lib/engine/rank";
import { isCellId } from "@/lib/engine/grid";
import { PodModifier } from "@/lib/weather";
import { CellTerrain, describeCell } from "@/lib/terrain";
import { Assignment } from "@/lib/store";

const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;

/** Short, honest reasons a cell ranks where it does: terrain pulls, clue proximity, how little it has been searched. */
function whyChips(s: Suggestion, t: CellTerrain | undefined, lkpCell: CellTerrain | undefined, clueCells: string[], terrain: Record<string, CellTerrain>): string[] {
  if (!t) return [];
  const out: string[] = [];
  const near = (a: CellTerrain, b: CellTerrain) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) <= 1;
  if (clueCells.some((c) => c === t.id)) out.push("clue here");
  else if (clueCells.some((c) => (terrain[c] ? near(t, terrain[c]) : false))) out.push("next to a clue");
  if (s.cumulativePod === 0) out.push("unsearched");
  else if (s.cumulativePod < 0.5) out.push(`only ${pct(s.cumulativePod, 0)} searched`);
  const lkpM = lkpCell?.demMeanM ?? lkpCell?.elevationM;
  const cellM = t.demMeanM ?? t.elevationM;
  if (lkpM !== undefined && cellM !== undefined && lkpM - cellM >= 75) out.push("downhill of LKP");
  if (t.drainage) out.push("drainage");
  if (lkpCell && near(t, lkpCell)) out.push("next to LKP");
  return out.slice(0, 2);
}


export default function SuggestionsPanel({
  suggestions,
  modifiers,
  weatherFactor,
  flaggedCells,
  assignments,
  selectedCell,
  prefill,
  terrain,
  clueCells = [],
  lkp = null,
  onAssign,
}: {
  suggestions: Suggestion[];
  modifiers: PodModifier[];
  weatherFactor: number;
  flaggedCells: Set<string>;
  assignments: Assignment[];
  selectedCell: string | null;
  terrain: Record<string, CellTerrain>;
  /** For the "why" chips: cells with clues, and the LKP cell. */
  clueCells?: string[];
  lkp?: string | null;
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
    onAssign({ team: team.trim(), cell: target, suggestedRank: rank >= 0 ? rank + 1 : null, topSuggestion: top, reason: withReason });
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
    <Card title="Suggestions" size="small" extra={<span>Suggestions only · you assign teams</span>}>
      <p className="mb-2 text-xs text-fg-2">Ranked by POA × expected POD for the next sweep.</p>
      {modifiers.length > 0 && (
        <Alert
          type="info"
          compact
          className="mb-2"
          description={
            <span className="flex flex-wrap items-center gap-1.5">
              Expected POD ×{weatherFactor.toFixed(2)} for current weather:
              {modifiers.map((m) => (
                <Tag key={m.key} color="info">
                  {m.label}
                </Tag>
              ))}
            </span>
          }
        />
      )}
      {suggestions.length === 0 ? (
        <Empty icon={<IconTarget width={22} height={22} />} title="No under-searched cells remain on the grid" hint="ROW is shown by the map; whether to expand or suspend stays your call." />
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-fg-3">
            <tr>
              <th className="py-1 pr-2 font-medium">#</th>
              <th className="pr-2 font-medium">Cell</th>
              <th className="px-2 text-right font-medium">POA</th>
              <th className="px-2 text-right font-medium whitespace-nowrap">Exp. POD</th>
              <th className="px-2 text-right font-medium">Score</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {suggestions.map((s, i) => (
              <tr key={s.cell} className="border-t border-line">
                <td className="py-1.5 pr-2 align-top text-primary-hover">{i + 1}</td>
                <td className="pr-2">
                  <span className="inline-flex items-center gap-1 font-mono font-semibold">
                    {s.cell}
                    {flaggedCells.has(s.cell) && (
                      <Tooltip content="Weather safety flag on this cell">
                        <IconWarning width={14} height={14} className="text-warning" />
                      </Tooltip>
                    )}
                  </span>
                  <div className="text-xs text-fg-3">{describeCell(terrain[s.cell])}</div>
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {whyChips(s, terrain[s.cell], lkp ? terrain[lkp] : undefined, clueCells, terrain).map((w) => (
                      <Tag key={w} color={w.startsWith("clue") || w.includes("clue") ? "purple" : w === "unsearched" ? "info" : "default"}>
                        {w}
                      </Tag>
                    ))}
                  </div>
                </td>
                <td className="px-2 text-right align-top font-mono tabular-nums">{pct(s.poa)}</td>
                <td className="px-2 text-right align-top font-mono tabular-nums">{pct(s.expectedPod, 0)}</td>
                <td className="px-2 text-right align-top font-mono tabular-nums">{(s.score * 1000).toFixed(1)}</td>
                <td className="text-right">
                  <Button variant="link" size="sm" onClick={() => setCell(s.cell)}>
                    Pick
                  </Button>
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
          <input className={`${input} font-mono uppercase`} value={cell || selectedCell || ""} onChange={(e) => setCell(e.target.value)} placeholder={top ?? "E12"} />
        </div>
        <Button variant="primary" disabled={!valid} onClick={submit}>
          Assign
        </Button>
      </div>

      {askReason && (
        <div className="mt-3 rounded-md border border-purple/50 bg-purple/10 p-3">
          <div className="text-sm text-fg">
            You chose <span className="font-mono font-semibold">{target}</span> over the top suggestion <span className="font-mono">{top}</span>. Your call — want to note why? (optional,
            logged for the after-action review)
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
            <Button onClick={() => finish()}>Skip reason</Button>
            <Button variant="primary" onClick={() => finish(reason)}>
              Assign with reason
            </Button>
          </div>
        </div>
      )}

      {assignments.length > 0 && (
        <div className="mt-3">
          <div className={label}>Assignments</div>
          <ul className="space-y-1 text-xs">
            {[...assignments].reverse().map((a) => (
              <li key={a.id} className={`${listRow} flex justify-between gap-2`}>
                <span>
                  <span className="font-medium">{a.team}</span> → <span className="font-mono">{a.cell}</span>
                  {a.override && <span className="ml-1 text-purple">(IC override{a.reason ? `: ${a.reason}` : ""})</span>}
                </span>
                <span className="text-fg-3">{new Date(a.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
