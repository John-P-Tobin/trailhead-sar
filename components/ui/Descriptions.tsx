import { ReactNode } from "react";

export interface DescriptionItem {
  label: ReactNode;
  value: ReactNode;
  span?: 1 | 2;
}

/** Ant-style key/value grid. Undefined or empty values render as an em dash. */
export default function Descriptions({ items, columns = 2, className = "" }: { items: DescriptionItem[]; columns?: 1 | 2; className?: string }) {
  return (
    <dl className={`grid gap-x-4 gap-y-2 ${columns === 2 ? "grid-cols-2" : "grid-cols-1"} ${className}`}>
      {items.map((it, i) => (
        <div key={i} className={`min-w-0 ${it.span === 2 ? "col-span-2" : ""}`}>
          <dt className="text-xs text-fg-3">{it.label}</dt>
          <dd className="text-sm text-fg">{it.value === undefined || it.value === null || it.value === "" ? <span className="text-fg-3">—</span> : it.value}</dd>
        </div>
      ))}
    </dl>
  );
}
