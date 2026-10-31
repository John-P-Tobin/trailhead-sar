"use client";

import { useMemo, useState } from "react";
import Panel from "./ui/Panel";
import { btnPrimary, input, label } from "./ui/styles";
import { applyClue, BOOST_FACTORS, BoostLevel } from "@/lib/engine/clues";
import { cellsWithin, isCellId } from "@/lib/engine/grid";
import { ProbState } from "@/lib/engine/bayes";
import { Clue } from "@/lib/store";

const BOOSTS: { id: BoostLevel; text: string }[] = [
  { id: "none", text: "Log only (no change)" },
  { id: "small", text: `Small (×${BOOST_FACTORS.small})` },
  { id: "medium", text: `Medium (×${BOOST_FACTORS.medium})` },
  { id: "large", text: `Large (×${BOOST_FACTORS.large})` },
];

export default function CluePanel({
  prob,
  clues,
  selectedCell,
  onAdd,
}: {
  prob: ProbState;
  clues: Clue[];
  selectedCell: string | null;
  onAdd: (c: { text: string; cell: string; radius: number; boost: BoostLevel }) => void;
}) {
  const [text, setText] = useState("");
  const [cell, setCell] = useState("");
  const [radius, setRadius] = useState(1);
  const [boost, setBoost] = useState<BoostLevel>("none");
  const target = (cell || selectedCell || "").toUpperCase();
  const valid = text.trim().length > 0 && isCellId(target);

  const preview = useMemo(() => {
    if (!valid || boost === "none") return null;
    const area = cellsWithin(target, radius);
    const after = applyClue(prob, target, radius, BOOST_FACTORS[boost]);
    const sum = (s: ProbState) => area.reduce((a, c) => a + s.cells[c], 0);
    return { before: sum(prob), after: sum(after), n: area.length };
  }, [valid, boost, target, radius, prob]);

  return (
    <Panel title="Clues">
      <p className="mb-2 text-xs text-slate-400">
        You decide how much a clue matters. The AI never weights clues on its own.
      </p>
      <div className="space-y-2">
        <input
          className={input}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. Granola wrapper found at F10 / wife says he always takes the ridge"
        />
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className={label}>Near cell</label>
            <input
              className={`${input} font-mono uppercase`}
              value={cell || selectedCell || ""}
              onChange={(e) => setCell(e.target.value)}
              placeholder="F10"
            />
          </div>
          <div>
            <label className={label}>Radius</label>
            <select className={input} value={radius} onChange={(e) => setRadius(Number(e.target.value))}>
              <option value={0}>Cell only</option>
              <option value={1}>1 cell</option>
              <option value={2}>2 cells</option>
            </select>
          </div>
          <div>
            <label className={label}>Boost (your call)</label>
            <select className={input} value={boost} onChange={(e) => setBoost(e.target.value as BoostLevel)}>
              {BOOSTS.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.text}
                </option>
              ))}
            </select>
          </div>
        </div>
        {preview && (
          <div className="text-xs text-violet-200">
            Preview: the {preview.n} cell{preview.n > 1 ? "s" : ""} near {target} go from{" "}
            {(preview.before * 100).toFixed(1)}% to {(preview.after * 100).toFixed(1)}% of total probability.
          </div>
        )}
        <div className="flex justify-end">
          <button
            className={btnPrimary}
            disabled={!valid}
            onClick={() => {
              onAdd({ text: text.trim(), cell: target, radius, boost });
              setText("");
              setCell("");
              setBoost("none");
            }}
          >
            Add clue
          </button>
        </div>
      </div>
      {clues.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs">
          {[...clues].reverse().map((c) => (
            <li key={c.id} className="rounded bg-slate-950/50 px-2 py-1">
              <span className="font-mono text-violet-300">{c.cell}</span> “{c.text}” ·{" "}
              <span className="text-slate-400">
                {c.boost === "none" ? "logged only" : `IC boost ${c.boost} ×${c.factor}, radius ${c.radius}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
