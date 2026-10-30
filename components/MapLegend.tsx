const Item = ({ swatch, text }: { swatch: React.ReactNode; text: string }) => (
  <span className="inline-flex items-center gap-1.5">
    {swatch}
    {text}
  </span>
);

export default function MapLegend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
      <Item swatch={<span className="h-0 w-5 border-t-2 border-dashed border-[#e9c27a]" />} text="Trail" />
      <Item swatch={<span className="h-0 w-5 border-t-[3px] border-[#6cb6ef]" />} text="Stream / drainage" />
      <Item swatch={<span className="h-0 w-5 border-t-[3px] border-dotted border-[#c9b89a]" />} text="Ridgeline" />
      <Item swatch={<span className="h-3 w-3 bg-[repeating-linear-gradient(45deg,#1b1b1b_0_2px,#5f6152_2px_5px)]" />} text="Cliffs" />
      <Item swatch={<span className="h-3 w-3 bg-[#2f6f9f]" />} text="Water" />
      <Item swatch={<span className="h-3 w-3 rounded-full border-2 border-rose-500" />} text="LKP" />
      <Item swatch={<span className="h-3 w-3 bg-gradient-to-r from-yellow-300 via-orange-500 to-red-600" />} text="POA (relative)" />
      <Item swatch={<span className="h-3 w-3 bg-[repeating-linear-gradient(-45deg,#e8f1ff_0_1px,transparent_1px_5px)]" />} text="Searched" />
    </div>
  );
}
