import { ReactNode } from "react";

/** Ant-style card: optional header with title + extra, body, optional footer. */
export default function Card({
  title,
  extra,
  footer,
  size = "default",
  tone = "default",
  className = "",
  bodyClassName = "",
  children,
}: {
  title?: ReactNode;
  extra?: ReactNode;
  footer?: ReactNode;
  size?: "default" | "small";
  /** Accent border for cards that need attention. */
  tone?: "default" | "primary" | "warning" | "success";
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  const pad = size === "small" ? "px-3 py-2.5" : "px-4 py-3";
  const border = { default: "border-line", primary: "border-primary/50", warning: "border-warning/50", success: "border-success/50" }[tone];
  return (
    <section className={`rounded-card border ${border} bg-surface ${className}`}>
      {(title || extra) && (
        <header className={`flex items-center justify-between gap-3 border-b border-line ${pad} ${size === "small" ? "py-2" : "py-2.5"}`}>
          {title && <h2 className="text-sm font-semibold text-fg">{title}</h2>}
          {extra && <div className="flex min-w-0 items-center gap-2 text-xs text-fg-2">{extra}</div>}
        </header>
      )}
      <div className={`${pad} ${bodyClassName}`}>{children}</div>
      {footer && <footer className={`border-t border-line ${pad} py-2 text-xs text-fg-3`}>{footer}</footer>}
    </section>
  );
}
