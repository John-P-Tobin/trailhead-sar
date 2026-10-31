import { btnPrimary } from "./ui/styles";

const STEPS = [
  ["Place the LKP", "Click the map where the subject was last seen and pick a profile. Priors appear as a heatmap."],
  ["Enter radio reports", "Paste a team's report. Claude proposes cells and POD; you review and edit every value."],
  ["Apply", "Nothing changes until you click Apply. The Bayesian update runs locally and ROW stays visible."],
  ["Decide", "Suggestions rank cells by POA × expected POD. You assign teams, weigh clues, and override with a reason."],
];

export default function WelcomeCard({ onDemo }: { onDemo: () => void }) {
  return (
    <section className="rounded-lg border border-sky-800/60 bg-sky-950/20 p-4">
      <h2 className="text-sm font-semibold text-sky-200">Start a search</h2>
      <ol className="mt-3 space-y-2">
        {STEPS.map(([t, d], i) => (
          <li key={t} className="flex gap-2 text-sm">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-800 text-[11px] font-bold">
              {i + 1}
            </span>
            <span>
              <span className="font-medium text-slate-100">{t}.</span> <span className="text-slate-400">{d}</span>
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-4 flex items-center gap-3">
        <button className={btnPrimary} onClick={onDemo}>
          Load demo scenario
        </button>
        <span className="text-xs text-slate-500">or click the map to place the LKP</span>
      </div>
    </section>
  );
}
