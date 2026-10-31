import { ReactNode } from "react";
import { IconCheck } from "./icons";

export interface Step {
  key: string;
  title: ReactNode;
  description?: ReactNode;
}

/** Ant-style steps. `current` is the index in progress; earlier steps are finished. */
export default function Steps({
  steps,
  current,
  direction = "horizontal",
  size = "md",
  onStepClick,
}: {
  steps: Step[];
  current: number;
  direction?: "horizontal" | "vertical";
  size?: "sm" | "md";
  onStepClick?: (i: number) => void;
}) {
  const dot = size === "sm" ? "h-5 w-5 text-xs" : "h-6 w-6 text-xs";
  if (direction === "vertical") {
    return (
      <ol className="space-y-3">
        {steps.map((s, i) => {
          const st = i < current ? "finish" : i === current ? "process" : "wait";
          return (
            <li key={s.key} className="flex gap-3">
              <div className="flex flex-col items-center">
                <Dot state={st} i={i} cls={dot} />
                {i < steps.length - 1 && <span className={`mt-1 w-px flex-1 ${st === "finish" ? "bg-primary" : "bg-line-strong"}`} />}
              </div>
              <div className="min-w-0 pb-1">
                <div className={`text-sm ${st === "wait" ? "text-fg-3" : "text-fg"} font-medium`}>{s.title}</div>
                {s.description && <div className="text-xs leading-relaxed text-fg-2">{s.description}</div>}
              </div>
            </li>
          );
        })}
      </ol>
    );
  }
  return (
    <ol className="flex items-center gap-1 overflow-x-auto scroll-thin">
      {steps.map((s, i) => {
        const st = i < current ? "finish" : i === current ? "process" : "wait";
        const clickable = !!onStepClick;
        return (
          <li key={s.key} className="flex min-w-0 shrink-0 items-center gap-1">
            <button
              type="button"
              disabled={!clickable}
              onClick={() => onStepClick?.(i)}
              className={`flex items-center gap-1.5 rounded-md px-1.5 py-1 text-left ${clickable ? "hover:bg-surface-3" : "cursor-default"}`}
            >
              <Dot state={st} i={i} cls={dot} />
              <span className={`whitespace-nowrap text-xs font-medium ${st === "process" ? "text-fg" : st === "finish" ? "text-fg-2" : "text-fg-3"}`}>{s.title}</span>
            </button>
            {i < steps.length - 1 && <span className={`h-px w-4 ${st === "finish" ? "bg-primary" : "bg-line-strong"}`} />}
          </li>
        );
      })}
    </ol>
  );
}

function Dot({ state, i, cls }: { state: "finish" | "process" | "wait"; i: number; cls: string }) {
  const style =
    state === "finish"
      ? "bg-primary text-white"
      : state === "process"
        ? "border-2 border-primary text-primary-hover"
        : "border border-line-strong text-fg-3";
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${cls} ${style}`}>
      {state === "finish" ? <IconCheck width={12} height={12} strokeWidth={3} /> : i + 1}
    </span>
  );
}
