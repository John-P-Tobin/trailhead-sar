"use client";

import Panel from "./ui/Panel";
import { PROFILE_LIST, ProfileId } from "@/lib/profiles";
import { btnSecondary, input, label } from "./ui/styles";
import { describeCell } from "@/lib/terrain";

export default function SetupPanel({
  lkp,
  profileId,
  row,
  started,
  placingLkp,
  onTogglePlaceLkp,
  onProfile,
  onRow,
}: {
  lkp: string | null;
  profileId: ProfileId;
  row: number | null;
  started: boolean;
  placingLkp: boolean;
  onTogglePlaceLkp: () => void;
  onProfile: (p: ProfileId) => void;
  onRow: (v: number) => void;
}) {
  return (
    <Panel title="Setup" right={started && <span className="text-xs text-slate-500">Locked — search in progress</span>}>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <div className={label}>Last known point</div>
            {lkp ? (
              <div className="text-sm">
                <span className="font-mono font-semibold text-rose-400">{lkp}</span>{" "}
                <span className="text-slate-400">· {describeCell(lkp)}</span>
              </div>
            ) : (
              <div className="text-sm text-amber-300">Click the map to place the LKP.</div>
            )}
          </div>
          {lkp && !started && (
            <button className={btnSecondary} onClick={onTogglePlaceLkp}>
              {placingLkp ? "Cancel" : "Move LKP"}
            </button>
          )}
        </div>

        <div>
          <label className={label} htmlFor="profile">
            Lost-person profile
          </label>
          <select
            id="profile"
            className={input}
            value={profileId}
            disabled={started}
            onChange={(e) => onProfile(e.target.value as ProfileId)}
          >
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
            </label>
            <input
              id="row"
              type="range"
              min={0}
              max={40}
              step={1}
              value={Math.round(row * 100)}
              onChange={(e) => onRow(Number(e.target.value) / 100)}
              className="w-full accent-violet-400"
            />
          </div>
        )}
        <p className="text-xs text-slate-500">
          Priors are <strong className="text-slate-400">illustrative estimates</strong> (distance from LKP × terrain ×
          profile), not published statistics. Click any cell to review or edit its POA before the search starts.
        </p>
      </div>
    </Panel>
  );
}
