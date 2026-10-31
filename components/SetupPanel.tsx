"use client";

import Button from "./ui/Button";
import Card from "./ui/Card";
import Tag from "./ui/Tag";
import { PROFILE_LIST, ProfileId } from "@/lib/profiles";
import { input, label } from "./ui/styles";

export default function SetupPanel({
  lkp,
  lkpInfo,
  profileId,
  row,
  suggestedRow,
  started,
  placingLkp,
  onTogglePlaceLkp,
  onProfile,
  onRow,
}: {
  lkp: string | null;
  /** Terrain description of the LKP cell. */
  lkpInfo?: string;
  profileId: ProfileId;
  row: number | null;
  /** The behaviour model's suggested share outside the grid, if known. */
  suggestedRow?: number;
  started: boolean;
  placingLkp: boolean;
  onTogglePlaceLkp: () => void;
  onProfile: (p: ProfileId) => void;
  onRow: (v: number) => void;
}) {
  return (
    <Card title="Search setup" size="small" extra={started && <Tag>Locked — search in progress</Tag>}>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <div className={label}>Last known point</div>
            {lkp ? (
              <div className="text-sm">
                <span className="font-mono font-semibold text-rose-400">{lkp}</span> <span className="text-fg-2">· {lkpInfo}</span>
              </div>
            ) : (
              <div className="text-sm text-warning">Click the map to place the LKP.</div>
            )}
          </div>
          {lkp && !started && (
            <Button size="sm" onClick={onTogglePlaceLkp}>
              {placingLkp ? "Cancel" : "Move LKP"}
            </Button>
          )}
        </div>

        <div>
          <label className={label} htmlFor="profile">
            Lost-person category
          </label>
          <select id="profile" className={input} value={profileId} disabled={started} onChange={(e) => onProfile(e.target.value as ProfileId)}>
            {PROFILE_LIST.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label} — {p.summary}
              </option>
            ))}
          </select>
        </div>

        {row !== null && !started && (
          <div>
            <label className={label} htmlFor="row">
              Starting Rest of World (ROW): {(row * 100).toFixed(0)}%
              {suggestedRow !== undefined && (
                <button type="button" className="ml-2 text-primary-hover hover:underline" onClick={() => onRow(suggestedRow)}>
                  model suggests {(suggestedRow * 100).toFixed(0)}%
                </button>
              )}
            </label>
            <input id="row" type="range" min={0} max={60} step={1} value={Math.round(row * 100)} onChange={(e) => onRow(Number(e.target.value) / 100)} className="w-full" />
          </div>
        )}
        <p className="text-xs text-fg-3">
          Priors are <strong className="text-fg-2">illustrative estimates</strong> (lost-person distance statistics × time missing × terrain), not operational
          guidance. Click any cell to review or edit its POA before the search starts.
        </p>
      </div>
    </Card>
  );
}
