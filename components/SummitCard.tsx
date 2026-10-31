import Panel from "./ui/Panel";

// Link-out only: we do not scrape, hotlink or rehost the Observatory's images or video.
// Verify these URLs before the demo (they could not be checked from the build container).
export const MWOBS_LINKS = [
  {
    label: "Summit webcams",
    href: "https://www.mountwashington.org/experience-the-weather/mount-washington-weather-cams/",
  },
  {
    label: "Higher Summits Forecast",
    href: "https://www.mountwashington.org/experience-the-weather/higher-summit-forecast.aspx",
  },
];

export default function SummitCard() {
  return (
    <Panel title="Summit conditions">
      <p className="text-xs text-slate-400">
        Ridge and summit weather can differ sharply from the valley forecast. Check the Mount Washington Observatory&apos;s
        official pages:
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {MWOBS_LINKS.map((l) => (
          <a
            key={l.href}
            href={l.href}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-sky-200 hover:bg-slate-700"
          >
            {l.label} ↗
          </a>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-slate-500">Opens mountwashington.org. Content belongs to the Observatory.</p>
    </Panel>
  );
}
