import { ReactNode } from "react";

export type TagColor = "default" | "primary" | "success" | "warning" | "error" | "info" | "purple";

const COLOR: Record<TagColor, string> = {
  default: "border-line-strong bg-surface-2 text-fg-2",
  primary: "border-primary/40 bg-primary/15 text-primary-hover",
  success: "border-success/40 bg-success/15 text-success",
  warning: "border-warning/40 bg-warning/15 text-warning",
  error: "border-error/40 bg-error/15 text-error",
  info: "border-info/40 bg-info/15 text-primary-hover",
  purple: "border-purple/40 bg-purple/15 text-purple",
};

export default function Tag({
  color = "default",
  icon,
  title,
  mono = false,
  className = "",
  children,
}: {
  color?: TagColor;
  icon?: ReactNode;
  title?: string;
  mono?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      title={title}
      className={`inline-flex h-5.5 items-center gap-1 whitespace-nowrap rounded border px-1.5 text-xs font-medium leading-none ${mono ? "font-mono" : ""} ${COLOR[color]} ${className}`}
    >
      {icon}
      {children}
    </span>
  );
}
