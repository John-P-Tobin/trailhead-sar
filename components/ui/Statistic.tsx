import { ReactNode } from "react";

const TONE = {
  default: "text-fg",
  primary: "text-primary-hover",
  success: "text-success",
  warning: "text-warning",
  error: "text-error",
  purple: "text-purple",
};

/** Ant-style statistic: small uppercase label, big tabular number, optional suffix and hint. */
export default function Statistic({
  label,
  value,
  suffix,
  hint,
  tone = "default",
  size = "md",
  mono = true,
  className = "",
}: {
  label: ReactNode;
  value: ReactNode;
  suffix?: ReactNode;
  hint?: ReactNode;
  tone?: keyof typeof TONE;
  size?: "sm" | "md" | "lg";
  mono?: boolean;
  className?: string;
}) {
  const v = { sm: "text-base", md: "text-2xl", lg: "text-3xl" }[size];
  return (
    <div className={`min-w-0 ${className}`}>
      <div className="text-xs uppercase tracking-wide text-fg-3">{label}</div>
      <div className={`${v} font-semibold leading-tight tabular-nums ${mono ? "font-mono" : ""} ${TONE[tone]}`}>
        {value}
        {suffix && <span className="ml-1 text-sm font-normal text-fg-2">{suffix}</span>}
      </div>
      {hint && <div className="mt-0.5 text-xs text-fg-2">{hint}</div>}
    </div>
  );
}
