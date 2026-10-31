import { ReactNode } from "react";

/** CSS-only tooltip (hover / focus-within). Keep content short. */
export default function Tooltip({ content, placement = "top", children }: { content: ReactNode; placement?: "top" | "bottom"; children: ReactNode }) {
  const pos = placement === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5";
  return (
    <span className="group relative inline-flex">
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute left-1/2 z-30 w-max max-w-64 -translate-x-1/2 rounded-md border border-line-strong bg-surface-3 px-2 py-1 text-xs text-fg shadow-lg hidden group-hover:block group-focus-within:block ${pos}`}
      >
        {content}
      </span>
    </span>
  );
}
