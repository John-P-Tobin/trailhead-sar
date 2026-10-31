import Card from "./ui/Card";
import { IconExternal } from "./ui/icons";

// Link-out only: we do not scrape, hotlink or rehost the Observatory's images or video.
export const MWOBS_LINKS = [
  { label: "Summit webcams", href: "https://www.mountwashington.org/experience-the-weather/mount-washington-weather-cams/" },
  { label: "Higher Summits Forecast", href: "https://www.mountwashington.org/experience-the-weather/higher-summit-forecast.aspx" },
];

export default function SummitCard() {
  return (
    <Card title="Summit conditions" size="small" footer="Opens mountwashington.org. Content belongs to the Observatory.">
      <p className="text-xs text-fg-2">Ridge and summit weather can differ sharply from the valley forecast. Check the Mount Washington Observatory&apos;s official pages:</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {MWOBS_LINKS.map((l) => (
          <a
            key={l.href}
            href={l.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line-strong bg-surface-2 px-3 text-sm text-primary-hover hover:bg-surface-3"
          >
            {l.label} <IconExternal width={14} height={14} />
          </a>
        ))}
      </div>
    </Card>
  );
}
