import Tag, { TagColor } from "./ui/Tag";
import Tooltip from "./ui/Tooltip";
import { IconLoader, IconMap } from "./ui/icons";
import { TerrainSource } from "@/lib/terrain";

const COLOR: Record<TerrainSource, TagColor> = { live: "success", bundled: "info", stylized: "default" };

/** Where the map's terrain came from: Live OSM, Bundled Mt Washington, or Stylized. */
export default function TerrainBadge({ source, label, fetchedAt, loading }: { source: TerrainSource; label: string; fetchedAt?: string; loading: boolean }) {
  const tip = fetchedAt ? `Terrain: ${label}. OpenStreetMap data as of ${new Date(fetchedAt).toLocaleString()}` : `Terrain: ${label}`;
  return (
    <span className="inline-flex items-center gap-2">
      {loading && (
        <span className="inline-flex items-center gap-1 text-xs text-fg-2">
          <IconLoader width={12} height={12} /> Fetching live OSM…
        </span>
      )}
      <Tooltip content={tip}>
        <Tag color={COLOR[source]} icon={<IconMap width={12} height={12} />}>
          {label}
        </Tag>
      </Tooltip>
    </span>
  );
}
