import Statistic from "./ui/Statistic";

/** Rest-of-World share with a sparkline of how it has moved. */
export default function RowIndicator({ row, history }: { row: number; history: number[] }) {
  const pts = history.length > 1 ? history : [history[0] ?? row, row];
  const max = Math.max(...pts, 0.2);
  const w = 120;
  const h = 32;
  const path = pts.map((v, i) => `${i ? "L" : "M"}${(i / (pts.length - 1)) * w},${h - (v / max) * h}`).join(" ");
  const start = history[0] ?? row;
  return (
    <div className="flex items-center gap-3">
      <Statistic
        label="Rest of World"
        value={`${(row * 100).toFixed(1)}%`}
        tone="purple"
        size="lg"
        hint={<>Outside the grid{history.length > 1 && <> · started at {(start * 100).toFixed(1)}%</>}</>}
      />
      <svg width={w} height={h} className="ml-auto shrink-0" aria-hidden>
        <path d={path} fill="none" stroke="var(--color-purple)" strokeWidth={2} />
      </svg>
    </div>
  );
}
