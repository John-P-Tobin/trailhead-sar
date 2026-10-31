"use client";

import dynamic from "next/dynamic";
import { ConfirmProvider } from "./ui/ConfirmProvider";

// Client-only: state is restored from localStorage on first render.
const Console = dynamic(() => import("./Console"), {
  ssr: false,
  loading: () => <div className="p-8 text-sm text-fg-2">Loading console…</div>,
});

export default function ConsoleLoader() {
  return (
    <ConfirmProvider>
      <Console />
    </ConfirmProvider>
  );
}
