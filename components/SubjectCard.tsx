"use client";

import { useEffect, useState } from "react";
import Alert from "./ui/Alert";
import Button from "./ui/Button";
import Card from "./ui/Card";
import Descriptions from "./ui/Descriptions";
import Tag from "./ui/Tag";
import { IconUser } from "./ui/icons";
import { input, label, quote } from "./ui/styles";
import { PROFILE_LIST, PROFILES, ProfileId } from "@/lib/profiles";
import { AGE_BAND_LABEL, AgeBand, defaultSubject, Equipment, Experience, Fitness, formatMissingFor, hoursSince, Medical, PartySize, Subject } from "@/lib/subject";
import { PriorSummary } from "@/lib/engine/priors";
import { SubjectSource } from "@/lib/store";

export interface SubjectDraft {
  subject: Subject;
  proposal: Subject | null;
  source: SubjectSource;
  rawText?: string;
  unclear: string[];
  key: number;
}

const LABEL = {
  experience: { none: "None", some: "Some", experienced: "Experienced" },
  fitness: { low: "Low", average: "Average", high: "High" },
  medical: { none: "None known", suspected: "Suspected condition", known: "Known condition / meds" },
  equipment: { adequate: "Adequate", questionable: "Questionable", inadequate: "Inadequate" },
};

/** ISO → value for <input type="datetime-local"> in the browser's zone. */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function SubjectCard({
  subject,
  draft,
  summary,
  started,
  parsing,
  parseError,
  onParse,
  onOpenManual,
  onChangeDraft,
  onConfirm,
  onCancel,
}: {
  /** The confirmed subject (null until the IC confirms one). */
  subject: Subject | null;
  /** A proposal under review. */
  draft: SubjectDraft | null;
  summary: PriorSummary | null;
  started: boolean;
  parsing: boolean;
  parseError: string | null;
  onParse: (text: string) => void;
  onOpenManual: () => void;
  onChangeDraft: (s: Subject) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState("");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const km = (v: number) => (v < 1 ? `${Math.round(v * 1000)} m` : `${v.toFixed(1)} km`);
  const model = summary && (
    <Alert
      type="info"
      compact
      title="What the model will assume (illustrative)"
      description={
        <>
          Missing {formatMissingFor(summary.hoursElapsed)}; could have travelled about {km(summary.reachKm)}. Half of similar subjects are found within {km(summary.quartilesKm[1])}, three in four within{" "}
          {km(summary.quartilesKm[2])}. Nearest grid edge is {km(summary.nearestEdgeKm)} away, so the model suggests about {(summary.suggestedRow * 100).toFixed(0)}% outside this grid. You set ROW.
        </>
      }
    />
  );

  // Review / edit form
  if (draft) {
    const s = draft.subject;
    const set = <K extends keyof Subject>(k: K, v: Subject[K]) => onChangeDraft({ ...s, [k]: v });
    const changed = (k: keyof Subject) => (draft.proposal && JSON.stringify(draft.proposal[k]) !== JSON.stringify(s[k]) ? "border-primary ring-1 ring-primary/40" : "");
    const sourceTag =
      draft.source === "claude" ? <Tag color="primary">Proposed by Claude — review every field</Tag> : draft.source === "canned" ? <Tag color="warning">Demo fallback (Claude unavailable) — review every field</Tag> : <Tag>Manual entry</Tag>;
    return (
      <Card title="Subject" size="small" tone="primary" extra={sourceTag}>
        <div className="space-y-3">
          {draft.rawText && <blockquote className={`${quote} border-line-strong font-sans`}>{draft.rawText}</blockquote>}
          {parseError && <Alert type="warning" compact description={parseError} />}
          {draft.unclear.length > 0 && (
            <Alert
              type="warning"
              compact
              title="Confirm with the caller"
              description={
                <ul className="list-disc pl-4">
                  {draft.unclear.map((u, i) => (
                    <li key={i}>{u}</li>
                  ))}
                </ul>
              }
            />
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Name</label>
              <input className={`${input} ${changed("name")}`} value={s.name ?? ""} onChange={(e) => set("name", e.target.value || undefined)} placeholder="optional" />
            </div>
            <div>
              <label className={label}>Category</label>
              <select
                className={`${input} ${changed("category")}`}
                value={s.category}
                onChange={(e) => {
                  const c = e.target.value as ProfileId;
                  const d = defaultSubject(c);
                  onChangeDraft({ ...s, category: c, ageBand: d.ageBand, experience: d.experience, fitness: d.fitness });
                }}
              >
                {PROFILE_LIST.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={label}>Age</label>
              <select className={`${input} ${changed("ageBand")}`} value={s.ageBand} onChange={(e) => set("ageBand", e.target.value as AgeBand)}>
                {(Object.keys(AGE_BAND_LABEL) as AgeBand[]).map((k) => (
                  <option key={k} value={k}>
                    {AGE_BAND_LABEL[k]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={label}>Last seen</label>
              <input
                type="datetime-local"
                className={`${input} ${changed("lastSeenAt")}`}
                value={toLocalInput(s.lastSeenAt)}
                max={toLocalInput(new Date(now).toISOString())}
                onChange={(e) => {
                  const t = new Date(e.target.value).getTime();
                  if (Number.isFinite(t)) set("lastSeenAt", new Date(t).toISOString());
                }}
              />
            </div>
            <Select label="Experience" value={s.experience} cls={changed("experience")} options={LABEL.experience} onChange={(v) => set("experience", v as Experience)} />
            <Select label="Fitness" value={s.fitness} cls={changed("fitness")} options={LABEL.fitness} onChange={(v) => set("fitness", v as Fitness)} />
            <Select label="Medical" value={s.medical} cls={changed("medical")} options={LABEL.medical} onChange={(v) => set("medical", v as Medical)} />
            <Select label="Equipment for conditions" value={s.equipment} cls={changed("equipment")} options={LABEL.equipment} onChange={(v) => set("equipment", v as Equipment)} />
            <div>
              <label className={label}>Party size</label>
              <select className={`${input} ${changed("partySize")}`} value={s.partySize} onChange={(e) => set("partySize", Number(e.target.value) as PartySize)}>
                <option value={1}>Alone</option>
                <option value={2}>Two</option>
                <option value={3}>Three or more</option>
              </select>
            </div>
            <div>
              <label className={label}>Intent / destination</label>
              <input className={`${input} ${changed("intent")}`} value={s.intent ?? ""} onChange={(e) => set("intent", e.target.value || undefined)} placeholder="e.g. heading for the summit" />
            </div>
            <div className="col-span-2">
              <label className={label}>Notes for searchers</label>
              <input className={`${input} ${changed("notes")}`} value={s.notes ?? ""} onChange={(e) => set("notes", e.target.value || undefined)} placeholder="clothing colours, gear, phone status" />
            </div>
          </div>
          {started && <Alert type="info" compact description="The search has started, so the priors stay locked. These details still update the urgency rating and the record." />}
          <div className="flex items-center justify-end gap-2">
            <Button variant="text" onClick={onCancel}>
              Discard
            </Button>
            <Button variant="primary" onClick={onConfirm}>
              Confirm subject
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  // Confirmed summary
  if (subject) {
    return (
      <Card
        title="Subject"
        size="small"
        extra={
          <Button size="sm" variant="text" onClick={onOpenManual}>
            Edit
          </Button>
        }
      >
        <Descriptions
          items={[
            { label: "Who", value: `${subject.name ? `${subject.name} · ` : ""}${PROFILES[subject.category].label} · ${AGE_BAND_LABEL[subject.ageBand]}` , span: 2 },
            { label: "Missing for", value: formatMissingFor(hoursSince(subject.lastSeenAt, now)) },
            { label: "Party", value: subject.partySize === 1 ? "Alone" : subject.partySize === 2 ? "Two" : "Three or more" },
            { label: "Experience · fitness", value: `${LABEL.experience[subject.experience]} · ${LABEL.fitness[subject.fitness]}` },
            { label: "Medical · equipment", value: `${LABEL.medical[subject.medical]} · ${LABEL.equipment[subject.equipment]}` },
            { label: "Intent", value: subject.intent, span: 2 },
            { label: "Notes", value: subject.notes, span: 2 },
          ]}
        />
        {model && <div className="mt-3">{model}</div>}
      </Card>
    );
  }

  // Nothing yet: paste the call-out
  return (
    <Card title="Subject" size="small" extra={<span>Who is missing?</span>}>
      <div className="space-y-2">
        <textarea
          className={`${input} min-h-20 text-xs leading-relaxed`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste the call-out, e.g. “Wife reports Dan Harper, 58, fit day hiker, left the hut alone at 1 p.m. for the summit, light rain shell, no meds, overdue since 5 p.m.”"
          disabled={parsing}
        />
        {parseError && <Alert type="warning" compact description={parseError} />}
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" icon={<IconUser />} loading={parsing} disabled={!text.trim()} onClick={() => onParse(text.trim())}>
            {parsing ? "Reading…" : "Pre-fill with Claude"}
          </Button>
          <Button disabled={parsing} onClick={onOpenManual}>
            Fill in manually
          </Button>
          <span className="text-xs text-fg-3">Claude proposes; you confirm every field. Details stay on this device.</span>
        </div>
        {model}
      </div>
    </Card>
  );
}

function Select<T extends string>({ label: l, value, options, onChange, cls }: { label: string; value: T; options: Record<string, string>; onChange: (v: string) => void; cls: string }) {
  return (
    <div>
      <label className={label}>{l}</label>
      <select className={`${input} ${cls}`} value={value} onChange={(e) => onChange(e.target.value)}>
        {Object.entries(options).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
    </div>
  );
}
