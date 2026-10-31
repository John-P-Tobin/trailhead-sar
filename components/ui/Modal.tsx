"use client";

import { ReactNode, useEffect, useRef } from "react";
import Button from "./Button";
import { IconClose } from "./icons";

/** Ant-style modal: overlay, Escape and overlay click close, focus moves inside. */
export default function Modal({
  open,
  title,
  onClose,
  footer,
  width = "max-w-md",
  children,
}: {
  open: boolean;
  title: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
  width?: string;
  children: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const first = box.current?.querySelector<HTMLElement>("button, input, select, textarea, [tabindex]");
    first?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-[12vh] backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={box} role="dialog" aria-modal="true" className={`w-full ${width} rounded-card border border-line-strong bg-surface shadow-2xl`}>
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold text-fg">{title}</h2>
          <Button variant="text" size="sm" aria-label="Close" onClick={onClose} icon={<IconClose />} />
        </header>
        <div className="px-4 py-3 text-sm text-fg-2">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-line px-4 py-3">{footer}</footer>}
      </div>
    </div>
  );
}
