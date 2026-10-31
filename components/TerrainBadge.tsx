import { TerrainSource } from "@/lib/terrain";

const STYLE: Record<TerrainSource, string> = {
  live: "border-emerald-500/50 bg-emerald-500/10 text-emerald-300",
  bundled: "border-sky-500/50 bg-sky-500/10 text-sky-300",
  stylized: "border-slate-500/50 bg-slate-500/10 text-slate-300",
};

/** Where the map's terrain came from: Live OSM, Bundled Mt Washington, or Stylized. */
export default function TerrainBadge({
  source,
  label,
  fetchedAt,
  loading,
}: {
  source: TerrainSource;
  label: string;
  fetchedAt?: string;
  loading: boolean;
}) {
  const title = [`Terrain: ${label}`, fetchedAt && `OpenStreetMap data as of ${new Date(fetchedAt).toLocaleString()}`]
    .filter(Boolean)
    .join("\n");
  return (
    <span className="inline-flex items-center gap-1.5" title={title}>
      {loading && (
        <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
          <span className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-slate-500 border-t-slate-200" /> Fetching live OSM…
        </span>
      )}
      <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${STYLE[source]}`}>{label}</span>
    </span>
  );
}
