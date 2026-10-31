import { ReactNode } from "react";
import { IconCheckCircle, IconInfo, IconWarning } from "./icons";

export type AlertType = "info" | "success" | "warning" | "error";

const STYLE: Record<AlertType, { box: string; icon: ReactNode }> = {
  info: { box: "border-info/40 bg-info/10 text-fg", icon: <IconInfo className="text-primary-hover" /> },
  success: { box: "border-success/40 bg-success/10 text-fg", icon: <IconCheckCircle className="text-success" /> },
  warning: { box: "border-warning/50 bg-warning/10 text-fg", icon: <IconWarning className="text-warning" /> },
  error: { box: "border-error/50 bg-error/10 text-fg", icon: <IconWarning className="text-error" /> },
};

export default function Alert({
  type,
  title,
  description,
  action,
  compact = false,
  className = "",
}: {
  type: AlertType;
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  const s = STYLE[type];
  return (
    <div role={type === "error" || type === "warning" ? "alert" : "status"} className={`flex gap-2.5 rounded-md border ${s.box} ${compact ? "px-2.5 py-1.5" : "px-3 py-2.5"} ${className}`}>
      <span className="mt-0.5 shrink-0">{s.icon}</span>
      <div className="min-w-0 flex-1">
        {title && <div className="text-sm font-semibold">{title}</div>}
        {description && <div className={`${title ? "mt-0.5" : ""} text-xs leading-relaxed text-fg-2`}>{description}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  );
}
