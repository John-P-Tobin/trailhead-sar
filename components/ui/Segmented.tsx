import { ReactNode } from "react";

/** Ant-style segmented control (radio group). */
export default function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  block = false,
  disabled = false,
  "aria-label": ariaLabel,
}: {
  options: { value: T; label: ReactNode; title?: string; disabled?: boolean }[];
  value: T;
  onChange: (v: T) => void;
  size?: "sm" | "md";
  block?: boolean;
  disabled?: boolean;
  "aria-label": string;
}) {
  const h = size === "sm" ? "h-6 px-2 text-xs" : "h-7 px-2.5 text-sm";
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={`inline-flex rounded-md bg-surface-2 p-0.5 ${block ? "w-full" : ""}`}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={o.title}
            disabled={disabled || o.disabled}
            onClick={() => onChange(o.value)}
            className={`${h} ${block ? "flex-1" : ""} rounded font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 disabled:cursor-not-allowed disabled:opacity-45 ${
              active ? "bg-surface-3 text-fg shadow-sm" : "text-fg-2 hover:text-fg"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
