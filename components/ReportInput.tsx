"use client";

import { useState } from "react";
import { btnPrimary, btnSecondary, input } from "./ui/styles";

export default function ReportInput({
  busy,
  error,
  onParse,
  onManual,
  initialText = "",
}: {
  busy: boolean;
  error: string | null;
  onParse: (text: string) => void;
  onManual: (text: string) => void;
  initialText?: string;
}) {
  const [text, setText] = useState(initialText);
  return (
    <div className="space-y-2">
      <textarea
        className={`${input} min-h-24 font-mono`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste or type the radio report, e.g. “Team 2 swept C4 through C6, thick spruce, spacing maybe 20 meters, fog rolling in, no clues.”"
        disabled={busy}
      />
      {error && (
        <div className="rounded-md border border-amber-500/50 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
          {error}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button className={btnPrimary} disabled={busy || !text.trim()} onClick={() => onParse(text.trim())}>
          {busy ? (
            <>
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" /> Parsing…
            </>
          ) : (
            "Parse with Claude"
          )}
        </button>
        <button className={btnSecondary} disabled={busy} onClick={() => onManual(text.trim())}>
          Manual entry
        </button>
        <span className="text-xs text-slate-500">Claude proposes; you confirm before anything changes.</span>
      </div>
    </div>
  );
}
