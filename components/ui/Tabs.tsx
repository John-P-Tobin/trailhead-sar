"use client";

import { KeyboardEvent, ReactNode } from "react";

export interface Tab {
  key: string;
  label: ReactNode;
  badge?: ReactNode;
  content: ReactNode;
}

/** Ant-style underline tabs with arrow-key navigation. Only the active panel is rendered. */
export default function Tabs({ tabs, active, onChange, className = "" }: { tabs: Tab[]; active: string; onChange: (key: string) => void; className?: string }) {
  const idx = Math.max(0, tabs.findIndex((t) => t.key === active));
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = (idx + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length;
    onChange(tabs[next].key);
  };
  return (
    <div className={className}>
      <div role="tablist" aria-orientation="horizontal" onKeyDown={onKey} className="flex gap-1 overflow-x-auto border-b border-line scroll-thin">
        {tabs.map((t, i) => {
          const sel = i === idx;
          return (
            <button
              key={t.key}
              role="tab"
              id={`tab-${t.key}`}
              aria-selected={sel}
              aria-controls={`panel-${t.key}`}
              tabIndex={sel ? 0 : -1}
              onClick={() => onChange(t.key)}
              className={`-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${
                sel ? "border-primary text-fg" : "border-transparent text-fg-2 hover:text-fg"
              }`}
            >
              {t.label}
              {t.badge}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id={`panel-${tabs[idx].key}`} aria-labelledby={`tab-${tabs[idx].key}`} className="pt-3">
        {tabs[idx].content}
      </div>
    </div>
  );
}
