"use client";

import { ALL_CELLS, COLS, CellId, GRID_SIZE } from "@/lib/engine/grid";
import { cellSizeM } from "@/lib/geo";
import { heatCss, heatOpacity } from "@/lib/heat";
import { Cover, describeCell, MapFeature, TerrainModel } from "@/lib/terrain";

const CELL_H = 40;
const PAD = 22;

const COVER_FILL: Record<Cover, string> = {
  hardwood: "#3d5a38",
  spruce: "#2a4636",
  alpine: "#5f6152",
  open: "#6f7448",
};

/** Label the highest peaks, skipping any within two cells of one already labelled. */
function peaksToLabel(features: MapFeature[]): Set<MapFeature> {
  const peaks = features.filter((f) => f.kind === "peak" && f.point && f.name).sort((a, b) => (b.ele ?? 0) - (a.ele ?? 0));
  const out: MapFeature[] = [];
  for (const p of peaks) {
    if (out.every((q) => Math.hypot(q.point![0] - p.point![0], q.point![1] - p.point![1]) > 2)) out.push(p);
  }
  return new Set(out);
}

export interface GridMapProps {
  terrain: Pick<TerrainModel, "cells" | "features" | "bbox" | "osm">;
  poa?: Record<CellId, number>;
  cumulativePod?: Record<CellId, number>;
  lkp?: CellId | null;
  selected?: CellId[];
  suggested?: CellId[];
  clueCells?: CellId[];
  found?: CellId | null;
  /** Radii (km) of dashed distance rings drawn around the LKP. */
  ringsKm?: number[];
  showHeatmap?: boolean;
  onCellClick?: (id: CellId) => void;
}

export default function GridMap({
  terrain,
  poa,
  cumulativePod,
  lkp,
  selected = [],
  suggested = [],
  clueCells = [],
  found = null,
  ringsKm = [],
  showHeatmap = true,
  onCellClick,
}: GridMapProps) {
  const { w, h } = cellSizeM(terrain.bbox);
  const CELL_W = CELL_H * (w / h); // cells drawn at their real width:height
  const WIDTH = PAD + CELL_W * GRID_SIZE + 4;
  const HEIGHT = PAD + CELL_H * GRID_SIZE + 16;
  const X = (gx: number) => PAD + gx * CELL_W;
  const Y = (gy: number) => PAD + gy * CELL_H;
  const cellBox = (id: CellId) => {
    const t = terrain.cells[id];
    return { x: X(t.x), y: Y(t.y), cx: X(t.x + 0.5), cy: Y(t.y + 0.5) };
  };
  const linePath = (pts: [number, number][]) => pts.map(([gx, gy], i) => `${i ? "L" : "M"}${X(gx).toFixed(1)},${Y(gy).toFixed(1)}`).join("");
  const ringsPath = (rings: [number, number][][]) => rings.map((r) => `${linePath(r)}Z`).join("");
  const max = poa ? Math.max(...ALL_CELLS.map((c) => poa[c] ?? 0), 1e-9) : 1;
  const byKind = (k: MapFeature["kind"]) => terrain.features.filter((f) => f.kind === k);
  const labelled = peaksToLabel(terrain.features);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="block h-auto max-h-[calc(100vh-230px)] min-h-72 w-full select-none" role="img" aria-label="Search area grid map">
        <defs>
          <clipPath id="grid-clip">
            <rect x={X(0)} y={Y(0)} width={CELL_W * GRID_SIZE} height={CELL_H * GRID_SIZE} />
          </clipPath>
          <pattern id="cliff" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="#1b1b1b" strokeWidth="2.5" />
          </pattern>
          <pattern id="searched" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
            <line x1="0" y1="0" x2="0" y2="8" stroke="#e8f1ff" strokeWidth="1.2" />
          </pattern>
          <clipPath id="grid-clip">
            <rect x={PAD} y={PAD} width={CELL_W * GRID_SIZE} height={CELL_H * GRID_SIZE} />
          </clipPath>
        </defs>

        {/* Axis labels */}
        {Array.from({ length: GRID_SIZE }, (_, i) => (
          <g key={i} className="fill-slate-400" fontSize="11" fontFamily="ui-monospace, monospace">
            <text x={X(i + 0.5)} y={15} textAnchor="middle">
              {COLS[i]}
            </text>
            <text x={PAD - 6} y={Y(i + 0.5) + 4} textAnchor="end">
              {i + 1}
            </text>
          </g>
        ))}

        {/* Terrain base */}
        {ALL_CELLS.map((id) => {
          const t = terrain.cells[id];
          return (
            <rect
              key={id}
              x={X(t.x)}
              y={Y(t.y)}
              width={CELL_W}
              height={CELL_H}
              fill={COVER_FILL[t.cover]}
              fillOpacity={0.75 + 0.25 * t.elevation}
            />
          );
        })}

        {/* Map features */}
        <g clipPath="url(#grid-clip)" pointerEvents="none">
          {byKind("water").map((f, i) => (
            <path key={`w${i}`} d={ringsPath(f.rings ?? [])} fill="#2f6f9f" fillRule="evenodd" stroke="#6cb6ef" strokeWidth={0.6} />
          ))}
          {byKind("cliff").map((f, i) =>
            f.rings ? (
              <path key={`ca${i}`} d={ringsPath(f.rings)} fill="url(#cliff)" />
            ) : (
              <path key={`cl${i}`} d={(f.lines ?? []).map(linePath).join("")} fill="none" stroke="#1f1712" strokeWidth={3} strokeDasharray="2 1.5" />
            ),
          )}
          {byKind("ridge").map((f, i) => (
            <path key={`r${i}`} d={(f.lines ?? []).map(linePath).join("")} fill="none" stroke="#c9b89a" strokeWidth={3} strokeDasharray="1 5" strokeLinecap="round" />
          ))}
          {byKind("stream").map((f, i) => (
            <path key={`s${i}`} d={(f.lines ?? []).map(linePath).join("")} fill="none" stroke="#6cb6ef" strokeWidth={terrain.osm ? 1.8 : 3} strokeLinejoin="round" />
          ))}
          {byKind("road").map((f, i) => (
            <path key={`rd${i}`} d={(f.lines ?? []).map(linePath).join("")} fill="none" stroke="#d6cfc2" strokeWidth={2.2} strokeLinejoin="round" />
          ))}
          {byKind("trail").map((f, i) => (
            <path key={`t${i}`} d={(f.lines ?? []).map(linePath).join("")} fill="none" stroke="#e9c27a" strokeWidth={terrain.osm ? 1.6 : 2} strokeDasharray="6 4" />
          ))}
        </g>

        {/* Heatmap */}
        {showHeatmap &&
          poa &&
          ALL_CELLS.map((id) => {
            const t = terrain.cells[id];
            const v = (poa[id] ?? 0) / max;
            return (
              <rect
                key={`h-${id}`}
                x={X(t.x)}
                y={Y(t.y)}
                width={CELL_W}
                height={CELL_H}
                fill={heatCss(v)}
                fillOpacity={heatOpacity(v)}
                style={{ transition: "fill 0.9s ease, fill-opacity 0.9s ease" }}
              />
            );
          })}

        {/* Searched hatch */}
        {cumulativePod &&
          ALL_CELLS.filter((id) => (cumulativePod[id] ?? 0) > 0).map((id) => {
            const { x, y } = cellBox(id);
            return (
              <rect
                key={`s-${id}`}
                x={x}
                y={y}
                width={CELL_W}
                height={CELL_H}
                fill="url(#searched)"
                fillOpacity={0.25 + 0.6 * cumulativePod[id]}
              />
            );
          })}

        {/* Grid lines */}
        {Array.from({ length: GRID_SIZE + 1 }, (_, i) => (
          <g key={`g-${i}`} stroke="#0b1220" strokeOpacity={0.55} strokeWidth={1}>
            <line x1={X(i)} y1={PAD} x2={X(i)} y2={Y(GRID_SIZE)} />
            <line x1={PAD} y1={Y(i)} x2={X(GRID_SIZE)} y2={Y(i)} />
          </g>
        ))}

        {/* Peaks */}
        <g clipPath="url(#grid-clip)" pointerEvents="none">
          {byKind("peak").map((f, i) => {
            if (!f.point) return null;
            const px = X(f.point[0]);
            const py = Y(f.point[1]);
            const right = f.point[0] > GRID_SIZE - 3;
            return (
              <g key={`p${i}`}>
                <path d={`M${px},${py - 4}L${px + 3.5},${py + 2.5}L${px - 3.5},${py + 2.5}Z`} fill="#f1f5f9" stroke="#0b1220" strokeWidth={0.8} />
                {labelled.has(f) && (
                  <text
                    x={px + (right ? -5 : 5)}
                    y={py - 4}
                    textAnchor={right ? "end" : "start"}
                    fontSize="8"
                    fill="#f1f5f9"
                    style={{ paintOrder: "stroke", stroke: "#0b1220", strokeWidth: 2.5 }}
                  >
                    {f.name}
                  </text>
                )}
              </g>
            );
          })}
        </g>

        {/* POA labels (hidden on phone widths where they can't be read) */}
        <g className="max-sm:hidden">
          {showHeatmap &&
            poa &&
            ALL_CELLS.map((id) => {
              const { cx, cy } = cellBox(id);
              const pct = (poa[id] ?? 0) * 100;
              return (
                <text
                  key={`l-${id}`}
                  x={cx}
                  y={cy + 4}
                  textAnchor="middle"
                  fontSize="10"
                  fontFamily="ui-monospace, monospace"
                  fill="#f8fafc"
                  style={{ paintOrder: "stroke", stroke: "#0b1220", strokeWidth: 2.5, pointerEvents: "none" }}
                >
                  {pct >= 9.95 ? pct.toFixed(0) : pct.toFixed(1)}
                </text>
              );
            })}
        </g>

        {/* Suggestions, selection, clues */}
        {suggested.map((id, i) => {
          const { x, y } = cellBox(id);
          return (
            <g key={`sg-${id}`} pointerEvents="none">
              <rect x={x + 2} y={y + 2} width={CELL_W - 4} height={CELL_H - 4} fill="none" stroke="#38bdf8" strokeWidth={2} strokeDasharray="4 2" />
              <text x={x + 5} y={y + 11} fontSize="9" fill="#38bdf8" fontWeight="700">
                {i + 1}
              </text>
            </g>
          );
        })}
        {selected.map((id) => {
          const { x, y } = cellBox(id);
          return (
            <rect key={`sel-${id}`} x={x + 1} y={y + 1} width={CELL_W - 2} height={CELL_H - 2} fill="none" stroke="#f8fafc" strokeWidth={2.5} pointerEvents="none" />
          );
        })}
        {clueCells.map((id) => {
          const { x, y } = cellBox(id);
          return <circle key={`c-${id}`} cx={x + CELL_W - 7} cy={y + 7} r={5} fill="#a855f7" stroke="#0b1220" pointerEvents="none" />;
        })}
        {lkp && terrain.cells[lkp] && (
          <g pointerEvents="none">
            {ringsKm.map((r, i) => {
              const rx = ((r * 1000) / w) * CELL_W;
              const ry = ((r * 1000) / h) * CELL_H;
              const pct = [25, 50, 75][i];
              return (
                <g key={r} clipPath="url(#grid-clip)">
                  <ellipse cx={cellBox(lkp).cx} cy={cellBox(lkp).cy} rx={rx} ry={ry} fill="none" stroke="#fda4af" strokeWidth={1.2} strokeDasharray="5 4" opacity={0.85} />
                  {pct !== undefined && cellBox(lkp).cy - ry > PAD + 10 && (
                    <text x={cellBox(lkp).cx + 4} y={cellBox(lkp).cy - ry - 3} fontSize={10} fill="#fda4af">
                      {pct}%
                    </text>
                  )}
                </g>
              );
            })}
            <circle cx={cellBox(lkp).cx} cy={cellBox(lkp).cy} r={13} fill="none" stroke="#f43f5e" strokeWidth={3} />
            <circle cx={cellBox(lkp).cx} cy={cellBox(lkp).cy} r={3} fill="#f43f5e" />
          </g>
        )}
        {found && terrain.cells[found] && (
          <g pointerEvents="none">
            <rect x={cellBox(found).x + 1} y={cellBox(found).y + 1} width={CELL_W - 2} height={CELL_H - 2} fill="none" stroke="#34d399" strokeWidth={4} />
            <text
              x={cellBox(found).cx}
              y={cellBox(found).y + CELL_H - 5}
              textAnchor="middle"
              fontSize="8"
              fontWeight="700"
              fill="#34d399"
              style={{ paintOrder: "stroke", stroke: "#0b1220", strokeWidth: 2.5 }}
            >
              FOUND
            </text>
          </g>
        )}

        {/* Hit targets */}
        {onCellClick &&
          ALL_CELLS.map((id) => {
            const { x, y } = cellBox(id);
            return (
              <rect
                key={`hit-${id}`}
                x={x}
                y={y}
                width={CELL_W}
                height={CELL_H}
                fill="transparent"
                className="cursor-pointer hover:fill-white/10"
                onClick={() => onCellClick(id)}
              >
                <title>
                  {`${id} · ${describeCell(terrain.cells[id])}${poa ? ` · POA ${((poa[id] ?? 0) * 100).toFixed(1)}%` : ""}${
                    cumulativePod?.[id] ? ` · cum. POD ${(cumulativePod[id] * 100).toFixed(0)}%` : ""
                  }`}
                </title>
              </rect>
            );
          })}
      </svg>
      {terrain.osm && (
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-0 right-1 rounded bg-slate-950/80 px-1.5 py-0.5 text-xs text-slate-300 hover:text-white"
        >
          © OpenStreetMap contributors
        </a>
      )}
    </div>
  );
}
