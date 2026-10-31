import { FeatureKind } from "@/lib/terrain";

const Item = ({ swatch, text }: { swatch: React.ReactNode; text: string }) => (
  <span className="inline-flex items-center gap-1.5">
    {swatch}
    {text}
  </span>
);

/** Legend for the map; terrain items appear only when the current terrain has them. */
export default function MapLegend({ kinds, rings = false }: { kinds: Set<FeatureKind>; rings?: boolean }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-2">
      {kinds.has("trail") && <Item swatch={<span className="h-0 w-5 border-t-2 border-dashed border-[#e9c27a]" />} text="Trail" />}
      {kinds.has("road") && <Item swatch={<span className="h-0 w-5 border-t-2 border-[#d6cfc2]" />} text="Road" />}
      {kinds.has("stream") && <Item swatch={<span className="h-0 w-5 border-t-[3px] border-[#6cb6ef]" />} text="Stream / drainage" />}
      {kinds.has("water") && <Item swatch={<span className="h-3 w-3 bg-[#2f6f9f]" />} text="Pond / lake" />}
      {kinds.has("peak") && <Item swatch={<span className="text-xs leading-none text-fg">▲</span>} text="Peak" />}
      {kinds.has("ridge") && <Item swatch={<span className="h-0 w-5 border-t-[3px] border-dotted border-[#c9b89a]" />} text="Ridgeline" />}
      {kinds.has("cliff") && <Item swatch={<span className="h-3 w-3 bg-[repeating-linear-gradient(45deg,#1b1b1b_0_2px,#5f6152_2px_5px)]" />} text="Cliffs" />}
      <Item swatch={<span className="h-3 w-3 rounded-full border-2 border-rose-500" />} text="LKP" />
      {rings && <Item swatch={<span className="h-3 w-3 rounded-full border border-dashed border-rose-300/80" />} text="25 / 50 / 75 % distance rings" />}
      <Item swatch={<span className="h-3 w-3 bg-gradient-to-r from-yellow-300 via-orange-500 to-red-600" />} text="POA (relative)" />
      <Item swatch={<span className="h-3 w-3 bg-[repeating-linear-gradient(-45deg,#e8f1ff_0_1px,transparent_1px_5px)]" />} text="Searched" />
      <Item swatch={<span className="h-3 w-3 border-2 border-dashed border-sky-400" />} text="Suggestion (#)" />
      <Item swatch={<span className="h-2.5 w-2.5 rounded-full bg-purple-500" />} text="Clue" />
    </div>
  );
}
