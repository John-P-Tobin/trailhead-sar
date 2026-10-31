import { ReactNode } from "react";
import { IconSearch } from "./icons";

export default function Empty({ title, hint, action, icon }: { title: string; hint?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1.5 py-5 text-center">
      <span className="text-fg-3">{icon ?? <IconSearch width={22} height={22} />}</span>
      <div className="text-sm text-fg-2">{title}</div>
      {hint && <div className="max-w-xs text-xs text-fg-3">{hint}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
