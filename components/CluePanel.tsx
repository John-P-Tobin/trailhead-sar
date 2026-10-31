"use client";

import { useMemo, useState } from "react";
import Alert from "./ui/Alert";
import Button from "./ui/Button";
import Card from "./ui/Card";
import Empty from "./ui/Empty";
import { IconClue } from "./ui/icons";
import { input, label, listRow } from "./ui/styles";
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
    <Card title="Clues" size="small" extra={<span>You decide the weight</span>}>
      <p className="mb-2 text-xs text-fg-2">You decide how much a clue matters. The AI never weights clues on its own.</p>
      <div className="space-y-2">
        <input className={input} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Granola wrapper found at F10 / wife says he always takes the ridge" />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={label}>Near cell</label>
            <input className={`${input} font-mono uppercase`} value={cell || selectedCell || ""} onChange={(e) => setCell(e.target.value)} placeholder="F10" />
          </div>
          <div>
            <label className={label}>Radius</label>
            <select className={input} value={radius} onChange={(e) => setRadius(Number(e.target.value))}>
              <option value={0}>Cell only</option>
              <option value={1}>1 cell</option>
              <option value={2}>2 cells</option>
            </select>
          </div>
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
        {preview && (
          <Alert
            type="info"
            compact
            description={
              <>
                Preview: the {preview.n} cell{preview.n > 1 ? "s" : ""} near <span className="font-mono">{target}</span> go from {(preview.before * 100).toFixed(1)}% to{" "}
                {(preview.after * 100).toFixed(1)}% of total probability.
              </>
            }
          />
        )}
        <div className="flex justify-end">
          <Button
            variant="primary"
            icon={<IconClue />}
            disabled={!valid}
            onClick={() => {
              onAdd({ text: text.trim(), cell: target, radius, boost });
              setText("");
              setCell("");
              setBoost("none");
            }}
          >
            Add clue
          </Button>
        </div>
      </div>
      {clues.length === 0 ? (
        <Empty icon={<IconClue width={22} height={22} />} title="No clues yet" hint="Physical finds and family statements go here. Each one is logged with the weight you chose." />
      ) : (
        <ul className="mt-3 space-y-1 text-xs">
          {[...clues].reverse().map((c) => (
            <li key={c.id} className={listRow}>
              <span className="font-mono text-purple">{c.cell}</span> “{c.text}” ·{" "}
              <span className="text-fg-2">{c.boost === "none" ? "logged only" : `IC boost ${c.boost} ×${c.factor}, radius ${c.radius}`}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
