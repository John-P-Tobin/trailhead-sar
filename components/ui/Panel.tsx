import { ReactNode } from "react";

export default function Panel({
  title,
  right,
  children,
  className = "",
}: {
  title: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-lg border border-slate-800 bg-slate-900/80 ${className}`}>
      <header className="flex items-center justify-between gap-2 border-b border-slate-800 px-3 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</h2>
        {right}
      </header>
      <div className="p-3">{children}</div>
    </section>
  );
}
