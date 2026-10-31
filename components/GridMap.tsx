"use client";

import { ALL_CELLS, COLS, CellId, GRID_SIZE } from "@/lib/engine/grid";
import { CLIFFS, Cover, RIDGES, STREAMS, TERRAIN, TRAILS, WATER } from "@/lib/terrain";

const CELL = 40;
const PAD = 22;
const SIZE = PAD + CELL * GRID_SIZE + 4;

const COVER_FILL: Record<Cover, string> = {
  hardwood: "#3d5a38",
  spruce: "#2a4636",
  alpine: "#5f6152",
  open: "#6f7448",
};

const center = (id: CellId) => {
  const t = TERRAIN[id];
  return { cx: PAD + t.x * CELL + CELL / 2, cy: PAD + t.y * CELL + CELL / 2 };
};

const linePath = (cells: CellId[]) =>
  cells
    .map((c, i) => {
      const { cx, cy } = center(c);
      return `${i ? "L" : "M"}${cx},${cy}`;
    })
    .join(" ");

/** Yellow → orange → red ramp for t in [0,1]. */
function heatColor(t: number): string {
  const hue = 55 - 55 * t;
  return `hsl(${hue}, 95%, ${55 - 8 * t}%)`;
}

export interface GridMapProps {
  poa?: Record<CellId, number>;
  cumulativePod?: Record<CellId, number>;
  lkp?: CellId | null;
  selected?: CellId[];
  suggested?: CellId[];
  clueCells?: CellId[];
  found?: CellId | null;
  showHeatmap?: boolean;
  onCellClick?: (id: CellId) => void;
}

export default function GridMap({
  poa,
  cumulativePod,
  lkp,
  selected = [],
  suggested = [],
  clueCells = [],
  found = null,
  showHeatmap = true,
  onCellClick,
}: GridMapProps) {
  const max = poa ? Math.max(...ALL_CELLS.map((c) => poa[c] ?? 0), 1e-9) : 1;

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="w-full h-auto select-none"
      role="img"
      aria-label="Search area grid map"
    >
      <defs>
        <pattern id="cliff" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="#1b1b1b" strokeWidth="2.5" />
        </pattern>
        <pattern id="searched" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
          <line x1="0" y1="0" x2="0" y2="8" stroke="#e8f1ff" strokeWidth="1.2" />
        </pattern>
      </defs>

      {/* Axis labels */}
      {Array.from({ length: GRID_SIZE }, (_, i) => (
        <g key={i} className="fill-slate-400" fontSize="11" fontFamily="ui-monospace, monospace">
          <text x={PAD + i * CELL + CELL / 2} y={15} textAnchor="middle">
            {COLS[i]}
          </text>
          <text x={PAD - 6} y={PAD + i * CELL + CELL / 2 + 4} textAnchor="end">
            {i + 1}
          </text>
        </g>
      ))}

      {/* Terrain base */}
      {ALL_CELLS.map((id) => {
        const t = TERRAIN[id];
        return (
          <rect
            key={id}
            x={PAD + t.x * CELL}
            y={PAD + t.y * CELL}
            width={CELL}
            height={CELL}
            fill={COVER_FILL[t.cover]}
            fillOpacity={0.75 + 0.25 * t.elevation}
          />
        );
      })}
      {WATER.map((id) => {
        const { cx, cy } = center(id);
        return <rect key={id} x={cx - CELL / 2} y={cy - CELL / 2} width={CELL} height={CELL} fill="#2f6f9f" />;
      })}
      {CLIFFS.map((id) => {
        const { cx, cy } = center(id);
        return <rect key={id} x={cx - CELL / 2} y={cy - CELL / 2} width={CELL} height={CELL} fill="url(#cliff)" />;
      })}

      {/* Line features */}
      {RIDGES.map((r) => (
        <path key={r.name} d={linePath(r.cells)} fill="none" stroke="#c9b89a" strokeWidth={3} strokeDasharray="1 5" strokeLinecap="round" />
      ))}
      {STREAMS.map((s) => (
        <path key={s.name} d={linePath(s.cells)} fill="none" stroke="#6cb6ef" strokeWidth={3} strokeLinejoin="round" />
      ))}
      {TRAILS.map((t) => (
        <path key={t.name} d={linePath(t.cells)} fill="none" stroke="#e9c27a" strokeWidth={2} strokeDasharray="6 4" />
      ))}

      {/* Heatmap */}
      {showHeatmap &&
        poa &&
        ALL_CELLS.map((id) => {
          const t = TERRAIN[id];
          const v = (poa[id] ?? 0) / max;
          return (
            <rect
              key={`h-${id}`}
              x={PAD + t.x * CELL}
              y={PAD + t.y * CELL}
              width={CELL}
              height={CELL}
              fill={heatColor(v)}
              fillOpacity={0.08 + 0.62 * v}
              style={{ transition: "fill 0.9s ease, fill-opacity 0.9s ease" }}
            />
          );
        })}

      {/* Searched hatch */}
      {cumulativePod &&
        ALL_CELLS.filter((id) => (cumulativePod[id] ?? 0) > 0).map((id) => {
          const t = TERRAIN[id];
          return (
            <rect
              key={`s-${id}`}
              x={PAD + t.x * CELL}
              y={PAD + t.y * CELL}
              width={CELL}
              height={CELL}
              fill="url(#searched)"
              fillOpacity={0.25 + 0.6 * cumulativePod[id]}
            />
          );
        })}

      {/* Grid lines */}
      {Array.from({ length: GRID_SIZE + 1 }, (_, i) => (
        <g key={`g-${i}`} stroke="#0b1220" strokeOpacity={0.55} strokeWidth={1}>
          <line x1={PAD + i * CELL} y1={PAD} x2={PAD + i * CELL} y2={PAD + GRID_SIZE * CELL} />
          <line x1={PAD} y1={PAD + i * CELL} x2={PAD + GRID_SIZE * CELL} y2={PAD + i * CELL} />
        </g>
      ))}

      {/* POA labels (hidden on phone widths where they can't be read) */}
      <g className="max-sm:hidden">
      {showHeatmap &&
        poa &&
        ALL_CELLS.map((id) => {
          const { cx, cy } = center(id);
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
        const { cx, cy } = center(id);
        return (
          <g key={`sg-${id}`} pointerEvents="none">
            <rect x={cx - CELL / 2 + 2} y={cy - CELL / 2 + 2} width={CELL - 4} height={CELL - 4} fill="none" stroke="#38bdf8" strokeWidth={2} strokeDasharray="4 2" />
            <text x={cx - CELL / 2 + 5} y={cy - CELL / 2 + 11} fontSize="9" fill="#38bdf8" fontWeight="700">
              {i + 1}
            </text>
          </g>
        );
      })}
      {selected.map((id) => {
        const { cx, cy } = center(id);
        return (
          <rect key={`sel-${id}`} x={cx - CELL / 2 + 1} y={cy - CELL / 2 + 1} width={CELL - 2} height={CELL - 2} fill="none" stroke="#f8fafc" strokeWidth={2.5} pointerEvents="none" />
        );
      })}
      {clueCells.map((id) => {
        const { cx, cy } = center(id);
        return (
          <g key={`c-${id}`} pointerEvents="none">
            <circle cx={cx + CELL / 2 - 7} cy={cy - CELL / 2 + 7} r={5} fill="#a855f7" stroke="#0b1220" />
          </g>
        );
      })}
      {lkp && TERRAIN[lkp] && (
        <g pointerEvents="none">
          <circle cx={center(lkp).cx} cy={center(lkp).cy} r={13} fill="none" stroke="#f43f5e" strokeWidth={3} />
          <circle cx={center(lkp).cx} cy={center(lkp).cy} r={3} fill="#f43f5e" />
        </g>
      )}

      {found && TERRAIN[found] && (
        <g pointerEvents="none">
          <rect
            x={center(found).cx - CELL / 2 + 1}
            y={center(found).cy - CELL / 2 + 1}
            width={CELL - 2}
            height={CELL - 2}
            fill="none"
            stroke="#34d399"
            strokeWidth={4}
          />
          <text
            x={center(found).cx}
            y={center(found).cy + CELL / 2 - 5}
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
          const t = TERRAIN[id];
          return (
            <rect
              key={`hit-${id}`}
              x={PAD + t.x * CELL}
              y={PAD + t.y * CELL}
              width={CELL}
              height={CELL}
              fill="transparent"
              className="cursor-pointer hover:fill-white/10"
              onClick={() => onCellClick(id)}
            >
              <title>{`${id}${poa ? ` · POA ${((poa[id] ?? 0) * 100).toFixed(1)}%` : ""}${cumulativePod?.[id] ? ` · cum. POD ${(cumulativePod[id] * 100).toFixed(0)}%` : ""}`}</title>
            </rect>
          );
        })}
    </svg>
  );
}
