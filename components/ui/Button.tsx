import { ButtonHTMLAttributes, ReactNode } from "react";
import { IconLoader } from "./icons";

export type ButtonVariant = "primary" | "default" | "text" | "danger" | "link";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-primary text-white hover:bg-primary-hover shadow-sm",
  default: "border border-line-strong bg-surface-2 text-fg hover:bg-surface-3 hover:border-fg-3",
  text: "text-fg-2 hover:bg-surface-3 hover:text-fg",
  danger: "border border-error/50 text-error hover:bg-error/10",
  link: "text-primary-hover hover:underline px-0",
};

const SIZE = { sm: "h-7 px-2.5 text-xs gap-1", md: "h-8 px-3 text-sm gap-1.5" };

export default function Button({
  variant = "default",
  size = "md",
  loading = false,
  icon,
  block = false,
  className = "",
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "sm" | "md";
  loading?: boolean;
  icon?: ReactNode;
  block?: boolean;
}) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center rounded-md font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 disabled:cursor-not-allowed disabled:opacity-45 ${SIZE[size]} ${VARIANT[variant]} ${block ? "w-full" : ""} ${className}`}
    >
      {loading ? <IconLoader width={14} height={14} /> : icon}
      {children}
    </button>
  );
}
