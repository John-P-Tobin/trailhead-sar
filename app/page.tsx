import GridMap from "@/components/GridMap";
import { DEFAULT_LKP } from "@/lib/terrain";

export default function Home() {
  return (
    <main className="mx-auto max-w-6xl p-4">
      <h1 className="text-xl font-semibold tracking-tight">Trailhead · Search Planner</h1>
      <div className="mt-4 max-w-2xl rounded-lg border border-slate-800 bg-slate-900 p-2">
        <GridMap lkp={DEFAULT_LKP} />
      </div>
    </main>
  );
}
