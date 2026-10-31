"use client";

import { useState } from "react";
import Panel from "./ui/Panel";
import { CellTerrain, describeCell } from "@/lib/terrain";
import { formatLatLon } from "@/lib/geo";
import { btnSecondary, input } from "./ui/styles";

export default function CellInspector({
  cell,
  terrain,
  poa,
  cumPod,
  sweeps,
  editable,
  onEdit,
}: {
  cell: string;
  terrain: CellTerrain;
  poa: number;
  cumPod: number;
  sweeps: number;
  editable: boolean;
  onEdit: (value: number) => void;
}) {
  const [draft, setDraft] = useState((poa * 100).toFixed(2));
  return (
    <Panel title={`Cell ${cell}`}>
      <div className="grid grid-cols-3 gap-2 text-sm">
        <Stat label="POA" value={`${(poa * 100).toFixed(2)}%`} />
        <Stat label="Cumulative POD" value={`${(cumPod * 100).toFixed(0)}%`} />
        <Stat label="Sweeps" value={String(sweeps)} />
      </div>
      <div className="mt-2 text-xs text-slate-400">Terrain: {describeCell(terrain)}</div>
      <div className="mt-1 font-mono text-[11px] text-slate-500">
        NW {formatLatLon(terrain.bounds.north, terrain.bounds.west)} · SE {formatLatLon(terrain.bounds.south, terrain.bounds.east)}
      </div>
      {editable && (
        <form
          className="mt-3 flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const v = Number(draft);
            if (Number.isFinite(v)) onEdit(v / 100);
          }}
        >
          <label className="flex-1 text-xs text-slate-400">
            Set POA (%) — other cells rescale, ROW unchanged
            <input className={`${input} mt-1`} value={draft} onChange={(e) => setDraft(e.target.value)} inputMode="decimal" />
          </label>
          <button className={btnSecondary} type="submit">
            Set
          </button>
        </form>
      )}
    </Panel>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-slate-950/60 px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="font-mono tabular-nums">{value}</div>
    </div>
  );
}
