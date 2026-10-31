"use client";

import { useState } from "react";
import Alert from "./ui/Alert";
import Button from "./ui/Button";
import { IconRadio } from "./ui/icons";
import { input } from "./ui/styles";

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
        className={`${input} min-h-24 font-mono text-xs leading-relaxed`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste or type the radio report, e.g. “Team 2 swept C4 through C6, thick spruce, spacing maybe 20 meters, fog rolling in, no clues.”"
        disabled={busy}
      />
      {error && <Alert type="warning" compact description={error} />}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" icon={<IconRadio />} loading={busy} disabled={!text.trim()} onClick={() => onParse(text.trim())}>
          {busy ? "Parsing…" : "Parse with Claude"}
        </Button>
        <Button disabled={busy} onClick={() => onManual(text.trim())}>
          Manual entry
        </Button>
        <span className="text-xs text-fg-3">Claude proposes; you confirm before anything changes.</span>
      </div>
    </div>
  );
}
