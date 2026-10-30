"use client";

import dynamic from "next/dynamic";

// Client-only: state is restored from localStorage on first render.
const Console = dynamic(() => import("./Console"), {
  ssr: false,
  loading: () => <div className="p-8 text-sm text-slate-400">Loading console…</div>,
});

export default function ConsoleLoader() {
  return <Console />;
}
