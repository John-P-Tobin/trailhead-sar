"use client";

import { useState } from "react";
import Button from "./ui/Button";
import Card from "./ui/Card";
import Descriptions from "./ui/Descriptions";
import Statistic from "./ui/Statistic";
import Tag from "./ui/Tag";
import Alert from "./ui/Alert";
import { STEEP_DEG } from "@/lib/elevation";
import { CellTerrain, describeCell } from "@/lib/terrain";
import { formatLatLon } from "@/lib/geo";
import { input } from "./ui/styles";

export default function CellInspector({
  cell,
  terrain,
  poa,
  cumPod,
  sweeps,
  editable,
  onEdit,
  distance,
}: {
  cell: string;
  terrain: CellTerrain;
  poa: number;
  cumPod: number;
  sweeps: number;
  editable: boolean;
  onEdit: (value: number) => void;
  /** Distance from the LKP and the share of similar subjects the model expects within it. */
  distance?: { km: number; withinShare: number; isLkp: boolean };
}) {
  const [draft, setDraft] = useState((poa * 100).toFixed(2));
  const tags = describeCell(terrain).split(", ").filter(Boolean);
  return (
    <Card title={<span>Cell <span className="font-mono">{cell}</span></span>} size="small">
      <div className="grid grid-cols-3 gap-3">
        <Statistic label="POA" value={`${(poa * 100).toFixed(2)}%`} />
        <Statistic label="Cumulative POD" value={`${(cumPod * 100).toFixed(0)}%`} tone={cumPod >= 0.8 ? "success" : "default"} />
        <Statistic label="Sweeps" value={String(sweeps)} />
      </div>
      <Descriptions
        className="mt-3"
        items={[
          { label: "Terrain", span: 2, value: <span className="flex flex-wrap gap-1">{tags.map((t) => <Tag key={t}>{t}</Tag>)}</span> },
          {
            label: "Elevation",
            value:
              terrain.demMeanM !== undefined
                ? `${terrain.demMeanM} m · range ${terrain.elevationMinM}–${terrain.elevationMaxM} m`
                : terrain.elevationM !== undefined
                  ? `~${terrain.elevationM} m (estimate)`
                  : undefined,
          },
          { label: "Slope", value: terrain.slopeDeg !== undefined ? `${terrain.slopeDeg}°${terrain.aspect && terrain.aspect !== "flat" ? ` facing ${terrain.aspect}` : ""}` : undefined },
          ...(distance
            ? [
                {
                  label: "From the LKP",
                  span: 2 as const,
                  value: distance.isLkp
                    ? "This is the last known point"
                    : `${distance.km < 1 ? `${Math.round(distance.km * 1000)} m` : `${distance.km.toFixed(1)} km`} · the model expects about ${Math.round(distance.withinShare * 100)}% of similar subjects within this distance by now (illustrative)`,
                },
              ]
            : []),
          ...(terrain.demMeanM !== undefined && terrain.elevationM !== undefined ? [{ label: "Model's smoothed estimate", value: `~${terrain.elevationM} m (used for the downhill pull)` }] : []),
          { label: "Corners", value: <span className="font-mono text-xs">NW {formatLatLon(terrain.bounds.north, terrain.bounds.west)} · SE {formatLatLon(terrain.bounds.south, terrain.bounds.east)}</span>, span: 2 },
        ]}
      />
      {terrain.slopeDeg !== undefined && terrain.slopeDeg >= STEEP_DEG && (
        <Alert type="warning" compact className="mt-3" title={`Steep ground (${terrain.slopeDeg}°)`} description="Consider team safety and slower movement when assigning this cell." />
      )}
      {editable && (
        <form
          className="mt-3 flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const v = Number(draft);
            if (Number.isFinite(v)) onEdit(v / 100);
          }}
        >
          <label className="flex-1 text-xs text-fg-2">
            Set POA (%) — other cells rescale, ROW unchanged
            <input className={`${input} mt-1`} value={draft} onChange={(e) => setDraft(e.target.value)} inputMode="decimal" />
          </label>
          <Button type="submit">Set</Button>
        </form>
      )}
    </Card>
  );
}
