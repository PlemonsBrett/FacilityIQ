import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Pencil } from "lucide-react";
import type { FacilityDetail, ReviewStatus } from "../types";
import { overallScore, scoreToInt, trustColor, trustLabel } from "../types";
import Workbench from "./Workbench";
import { postAction, fetchReviewStatus, postReviewStatus } from "../lib/api";

// ── Review status config ──────────────────────────────────────────────────────

const REVIEW_STATUS_CONFIG: Record<ReviewStatus, { label: string; color: string }> = {
  not_started:         { label: "Not Started", color: "#94a3b8" },
  in_progress:         { label: "In Review",   color: "#60a5fa" },
  email_sent:          { label: "Email Sent",  color: "#a78bfa" },
  called:              { label: "Called",       color: "#fb923c" },
  parked:              { label: "Parked",       color: "#64748b" },
  validation_complete: { label: "Validated",    color: "#4ade80" },
};

// ── Local types ───────────────────────────────────────────────────────────────

type HighlightType = "evidence" | "contradiction" | "insufficient";

interface TextHighlight {
  id: string;
  match: string;
  type: HighlightType;
  bubble: string;
  score?: number | null;
  dimension?: string;
}

interface FacilityField {
  label: string;
  value: string | null;
  category: "Identity" | "Clinical" | "Capacity" | "Operations";
  highlights?: TextHighlight[];
  missing?: boolean;
}

type Segment =
  | { kind: "plain"; text: string }
  | { kind: "highlight"; text: string; hl: TextHighlight };

interface PlacedRect { l: number; t: number; h: number; }

interface ScoreBandDef {
  dimension: string;
  score: number | null;
  confidence_tier: string;
}

// ── Data helpers ──────────────────────────────────────────────────────────────

function segmentText(text: string, highlights: TextHighlight[]): Segment[] {
  const positioned = highlights
    .map((h) => ({ h, idx: text.indexOf(h.match) }))
    .filter(({ idx }) => idx >= 0)
    .sort((a, b) => a.idx - b.idx);
  const segs: Segment[] = [];
  let cursor = 0;
  for (const { h, idx } of positioned) {
    if (idx > cursor) segs.push({ kind: "plain", text: text.slice(cursor, idx) });
    segs.push({ kind: "highlight", text: h.match, hl: h });
    cursor = idx + h.match.length;
  }
  if (cursor < text.length) segs.push({ kind: "plain", text: text.slice(cursor) });
  return segs;
}

function buildFields(detail: FacilityDetail): FacilityField[] {
  const { facility, trust_signals } = detail;

  function getHighlights(sourceField: string, fieldValue: string | null): TextHighlight[] {
    if (!fieldValue) return [];
    return trust_signals
      .filter((s) => s.source_field === sourceField)
      .map((s) => {
        const evText = s.evidence_text ?? fieldValue;
        const match = fieldValue.includes(evText) ? evText : fieldValue;
        const rawScore = s.trust_score !== null ? parseFloat(s.trust_score) : null;
        const score = rawScore !== null
          ? rawScore <= 1 ? Math.round(rawScore * 100) : Math.round(rawScore)
          : null;
        if (s.confidence_tier === "insufficient_data") {
          return { id: `${sourceField}-insuff`, match, type: "insufficient" as const, bubble: evText, dimension: s.dimension };
        }
        if (s.contradiction) {
          return { id: `${sourceField}-contra`, match, type: "contradiction" as const, bubble: s.contradiction_detail ?? evText, dimension: s.dimension };
        }
        return { id: `${sourceField}-evid`, match, type: "evidence" as const, bubble: evText, score, dimension: s.dimension };
      });
  }

  function getDescriptionHighlights(): TextHighlight[] {
    const desc = facility.description;
    if (!desc) return [];
    return trust_signals
      .filter((s) => s.contradiction && s.contradiction_detail)
      .map((s) => {
        const detail = s.contradiction_detail!;
        const quoted = detail.match(/"([^"]+)"/)?.[1] ?? detail.match(/'([^']+)'/)?.[1];
        const match = quoted && desc.includes(quoted) ? quoted : desc;
        return { id: `desc-contra-${s.dimension}`, match, type: "contradiction" as const, bubble: detail, dimension: s.dimension };
      });
  }

  const capStr  = facility.capacity?.toString() ?? null;
  const yearStr = facility.year_established?.toString() ?? null;
  const docStr  = facility.number_doctors?.toString() ?? null;

  return [
    { label: "Facility Name",    value: facility.facility_name,    category: "Identity" },
    { label: "City",             value: facility.district,         category: "Identity" },
    { label: "State",            value: facility.state,            category: "Identity" },
    { label: "Facility Type",    value: facility.facility_type,    category: "Identity" },
    { label: "Phone",            value: facility.official_phone,   category: "Identity" },
    { label: "Email",            value: facility.email,            category: "Identity" },
    { label: "Website",          value: facility.official_website, category: "Identity" },
    { label: "Address",          value: facility.address_line1,    category: "Identity" },
    { label: "Description",      value: facility.description,      category: "Identity", highlights: getDescriptionHighlights() },
    { label: "Capability",       value: facility.capability,       category: "Clinical", highlights: getHighlights("capability", facility.capability) },
    { label: "Equipment",        value: facility.equipment,        category: "Clinical", highlights: getHighlights("equipment", facility.equipment) },
    { label: "Procedure",        value: facility.procedure,        category: "Clinical", highlights: getHighlights("procedure", facility.procedure) },
    { label: "Bed Capacity",     value: capStr,                    category: "Capacity", highlights: getHighlights("capacity", capStr), missing: capStr === null },
    { label: "Doctors",          value: docStr,                    category: "Capacity", missing: docStr === null },
    { label: "Year Established", value: yearStr,                   category: "Capacity", missing: yearStr === null },
  ];
}

const CATEGORY_ORDER: FacilityField["category"][] = ["Identity", "Clinical", "Capacity", "Operations"];

// ── Bubble positioning (imperative) ───────────────────────────────────────────

const BW = 240;
const GAP = 12;

function measureBubble(el: HTMLDivElement): number {
  el.style.cssText = `display:block!important;visibility:hidden!important;position:absolute!important;top:-9999px!important;left:0!important;width:${BW}px!important`;
  const h = el.offsetHeight;
  el.style.cssText = "display:none;";
  return h;
}

function clearBubble(el: HTMLDivElement) {
  el.style.cssText = "display:none;";
}

function placeBubble(
  container: HTMLDivElement,
  bubble: HTMLDivElement,
  spanEl: HTMLElement,
  placed: PlacedRect[],
  animate: boolean,
) {
  const bh = measureBubble(bubble);
  const tail = bubble.querySelector<HTMLElement>(".ga-tail")!;
  const isC = !bubble.classList.contains("ga-bubble-e");
  const tailBg = isC ? "var(--ga-bubble-c-tail)" : "var(--ga-bubble-e-tail)";

  const cRect = container.getBoundingClientRect();
  const sRect = spanEl.getBoundingClientRect();
  const sy = sRect.top  - cRect.top;
  const sx = sRect.left - cRect.left;
  const sw = sRect.width;
  const sh = sRect.height;
  const cx = sx + sw / 2;
  const vw = container.offsetWidth;

  const cands = [
    { l: cx - BW / 2,   t: sy - bh - GAP, dir: "down" as const, tl: "50%" },
    { l: sx,             t: sy - bh - GAP, dir: "down" as const, tl: "15%" },
    { l: sx + sw - BW,  t: sy - bh - GAP, dir: "down" as const, tl: "85%" },
    { l: cx - BW / 2,   t: sy + sh + GAP, dir: "up"   as const, tl: "50%" },
    { l: sx,             t: sy + sh + GAP, dir: "up"   as const, tl: "15%" },
    { l: sx + sw - BW,  t: sy + sh + GAP, dir: "up"   as const, tl: "85%" },
  ];

  let chosen = cands[0];
  for (const c of cands) {
    const cl = Math.max(4, Math.min(c.l, vw - BW - 4));
    if (c.t < 4) continue;
    const overlaps = placed.some(
      (p) => cl < p.l + BW + 6 && cl + BW > p.l - 6 && c.t < p.t + p.h + 6 && c.t + bh > p.t - 6,
    );
    if (!overlaps) { c.l = cl; chosen = c; break; }
  }

  const safeL = Math.max(4, Math.min(chosen.l, vw - BW - 4));
  bubble.style.cssText = `display:block;position:absolute;left:${safeL}px;top:${chosen.t}px;width:${BW}px;z-index:200;pointer-events:none;`;

  if (chosen.dir === "down") {
    tail.style.cssText = `border-left:8px solid transparent;border-right:8px solid transparent;border-top:9px solid ${tailBg};bottom:-9px;left:${chosen.tl};transform:translateX(-50%);`;
  } else {
    tail.style.cssText = `border-left:8px solid transparent;border-right:8px solid transparent;border-bottom:9px solid ${tailBg};top:-9px;left:${chosen.tl};transform:translateX(-50%);`;
  }

  if (animate) {
    bubble.style.animation = "none";
    void bubble.offsetWidth;
    bubble.style.animation = "ga-pop .18s cubic-bezier(.34,1.56,.64,1) both";
  }

  placed.push({ l: safeL, t: chosen.t, h: bh });
}

// ── ScoreBand ─────────────────────────────────────────────────────────────────

function ScoreBand({ ts, onEdit }: { ts: ScoreBandDef; onEdit: (dim: string) => void }) {
  const isInsuff = ts.confidence_tier === "insufficient_data" || ts.score === null;
  const tier = ts.score === null ? "INSUFFICIENT"
    : ts.score >= 70 ? "HIGH"
    : ts.score >= 40 ? "MED"
    : "LOW";

  const c = {
    HIGH:         { badge: "bg-emerald-50 text-emerald-700 border-emerald-200", ring: "ring-1 ring-emerald-200", bar: "bg-emerald-500", score: "text-emerald-700" },
    MED:          { badge: "bg-amber-50 text-amber-700 border-amber-200",       ring: "ring-1 ring-amber-200",   bar: "bg-amber-400",   score: "text-amber-700"   },
    LOW:          { badge: "bg-rose-50 text-rose-700 border-rose-200",           ring: "ring-1 ring-rose-200",    bar: "bg-rose-500",    score: "text-rose-700"    },
    INSUFFICIENT: { badge: "bg-slate-100 text-slate-500 border-slate-200",       ring: "ring-1 ring-slate-200",   bar: "bg-slate-300",   score: "text-slate-400"   },
  }[tier];

  return (
    <div
      className={`flex-1 min-w-[140px] rounded-xl border p-4 flex flex-col gap-3 ${c.ring}`}
      style={{ background: "var(--fiq-bg-surface)", borderColor: "var(--fiq-border)" }}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: "var(--fiq-text-code)" }}>
          {ts.dimension}
        </span>
        <div className="flex items-center gap-1">
          <span className={`text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full border ${c.badge}`}>
            {tier === "INSUFFICIENT" ? "NO DATA" : tier}
          </span>
          {!isInsuff && (
            <button
              onClick={() => onEdit(ts.dimension)}
              className="opacity-50 hover:opacity-100 transition-opacity ml-1 rounded p-1"
              style={{ color: "var(--fiq-text)" }}
              title={`Override ${ts.dimension} score`}
            >
              <Pencil size={14} />
            </button>
          )}
        </div>
      </div>

      {isInsuff ? (
        <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--fiq-text-faintest)" }}>
          <span>⊘</span><span>Score suppressed</span>
        </div>
      ) : (
        <div className="flex items-end gap-2">
          <span className={`text-3xl font-bold tabular-nums leading-none ${c.score}`}>{ts.score}</span>
          <span className="text-xs mb-0.5" style={{ color: "var(--fiq-text-faintest)" }}>/ 100</span>
        </div>
      )}

      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--fiq-border)" }}>
        <div className={`h-full rounded-full ${c.bar}`} style={{ width: isInsuff ? "0%" : `${ts.score ?? 0}%` }} />
      </div>
    </div>
  );
}

// ── HighlightSpan ─────────────────────────────────────────────────────────────

function HighlightSpan({
  hl,
  onEnter,
  onLeave,
}: {
  hl: TextHighlight;
  onEnter: (span: HTMLElement) => void;
  onLeave: () => void;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const isE = hl.type === "evidence";

  return (
    <span
      ref={ref}
      style={{
        borderRadius: "3px",
        padding: "1px 3px",
        cursor: "default",
        background: isE ? "var(--ga-hl-e-bg)" : "var(--ga-hl-c-bg)",
        color: isE ? "var(--ga-hl-e-color)" : "var(--ga-hl-c-color)",
        textDecoration: "underline",
        textDecorationStyle: "dotted",
        textDecorationColor: isE ? "var(--ga-hl-e-underline)" : "var(--ga-hl-c-underline)",
        textUnderlineOffset: "2px",
      }}
      data-bubble-anchor={hl.id}
      onMouseEnter={() => ref.current && onEnter(ref.current)}
      onMouseLeave={onLeave}
    >
      {hl.match}
    </span>
  );
}

// ── FieldRow ──────────────────────────────────────────────────────────────────

function FieldRow({
  field,
  onSpanEnter,
  onSpanLeave,
  onVerify,
  onEdit,
}: {
  field: FacilityField;
  onSpanEnter: (span: HTMLElement, id: string) => void;
  onSpanLeave: (id: string) => void;
  onVerify: (label: string) => void;
  onEdit: (label: string, currentValue: string) => void;
}) {
  const isMissing = field.missing || field.value === null;
  const [verified, setVerified] = useState(false);

  function handleVerify() {
    setVerified(true);
    onVerify(field.label);
    setTimeout(() => setVerified(false), 2000);
  }

  return (
    <div
      className="flex items-start gap-3 py-2.5"
      style={{ borderBottom: "1px solid var(--fiq-border)" }}
    >
      <span
        className="w-32 shrink-0 text-[10px] font-semibold uppercase tracking-wide pt-0.5"
        style={{ color: "var(--fiq-text-faintest)" }}
      >
        {field.label}
      </span>
      {isMissing ? (
        <span className="flex-1 text-sm italic" style={{ color: "var(--fiq-text-faintest)" }}>
          Not provided
        </span>
      ) : (
        <div className="flex-1">
          <span className="text-sm leading-relaxed" style={{ color: "var(--fiq-text-muted)" }}>
            {field.highlights?.length ? (
              segmentText(field.value!, field.highlights).map((seg, i) =>
                seg.kind === "plain" ? (
                  <span key={i}>{seg.text}</span>
                ) : (
                  <HighlightSpan
                    key={i}
                    hl={seg.hl}
                    onEnter={(el) => onSpanEnter(el, seg.hl.id)}
                    onLeave={() => onSpanLeave(seg.hl.id)}
                  />
                ),
              )
            ) : (
              field.value
            )}
          </span>
          <div className="flex gap-1.5 mt-1.5">
            <button
              onClick={handleVerify}
              className="text-[10px] font-semibold px-2 py-0.5 rounded border transition-colors hover:text-emerald-600 hover:border-emerald-300"
              style={{
                color: verified ? "#059669" : "var(--fiq-text-faintest)",
                borderColor: verified ? "#a7f3d0" : "var(--fiq-border)",
              }}
            >
              {verified ? "✓ Verified" : "✓ Verify"}
            </button>
            <button
              onClick={() => onEdit(field.label, field.value!)}
              className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded border transition-colors hover:text-indigo-600 hover:border-indigo-300"
              style={{ color: "var(--fiq-text-faintest)", borderColor: "var(--fiq-border)" }}
            >
              <Pencil size={11} />
              Edit
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── CategorySection ───────────────────────────────────────────────────────────

function CategorySection({
  name,
  fields,
  onSpanEnter,
  onSpanLeave,
  onVerify,
  onEdit,
}: {
  name: string;
  fields: FacilityField[];
  onSpanEnter: (span: HTMLElement, id: string) => void;
  onSpanLeave: (id: string) => void;
  onVerify: (label: string) => void;
  onEdit: (label: string, currentValue: string) => void;
}) {
  if (fields.length === 0) return null;
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--fiq-text-faintest)" }}>
          {name}
        </span>
        <div className="flex-1 h-px" style={{ background: "var(--fiq-border)" }} />
      </div>
      {fields.map((f) => (
        <FieldRow
          key={f.label}
          field={f}
          onSpanEnter={onSpanEnter}
          onSpanLeave={onSpanLeave}
          onVerify={onVerify}
          onEdit={onEdit}
        />
      ))}
    </div>
  );
}

// ── EditFieldModal ────────────────────────────────────────────────────────────

function EditFieldModal({
  fieldLabel,
  currentValue,
  onSubmit,
  onClose,
}: {
  fieldLabel: string;
  currentValue: string;
  onSubmit: (newValue: string, reason: string) => void;
  onClose: () => void;
}) {
  const [newValue, setNewValue] = useState(currentValue);
  const [reason, setReason] = useState("");
  const valid = newValue.trim() !== currentValue.trim() && reason.trim().length > 0;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-sm mx-4 rounded-2xl p-6 shadow-2xl"
        style={{ background: "var(--fiq-bg-surface)", border: "1px solid var(--fiq-border)" }}
      >
        <h3 className="font-semibold text-sm mb-1" style={{ color: "var(--fiq-text)" }}>
          Edit Field
        </h3>
        <p className="text-[10px] font-semibold uppercase tracking-wide mb-4" style={{ color: "var(--fiq-text-faintest)" }}>
          {fieldLabel}
        </p>
        <textarea
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          rows={3}
          className="w-full rounded-lg px-3 py-2 text-sm resize-none outline-none mb-3"
          style={{ background: "var(--fiq-bg-input)", border: "1px solid var(--fiq-border-strong)", color: "var(--fiq-text)" }}
        />
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason for edit (required)"
          rows={2}
          className="w-full rounded-lg px-3 py-2 text-sm resize-none outline-none mb-4"
          style={{ background: "var(--fiq-bg-input)", border: "1px solid var(--fiq-border-strong)", color: "var(--fiq-text)" }}
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold rounded-lg border"
            style={{ borderColor: "var(--fiq-border)", color: "var(--fiq-text-faintest)" }}
          >
            Cancel
          </button>
          <button
            onClick={() => valid && onSubmit(newValue.trim(), reason.trim())}
            disabled={!valid}
            className="px-4 py-1.5 text-xs font-semibold rounded-lg disabled:opacity-40"
            style={{ background: "var(--fiq-text)", color: "var(--fiq-bg)" }}
          >
            Submit Edit
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── FlagModal ─────────────────────────────────────────────────────────────────

function FlagModal({
  facilityId,
  analystId,
  onClose,
}: {
  facilityId: string;
  analystId: string;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!reason.trim()) return;
    setSaving(true);
    await postAction(facilityId, analystId, "flag", reason.trim());
    setSaving(false);
    onClose();
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-sm mx-4 rounded-2xl p-6 shadow-2xl"
        style={{ background: "var(--fiq-bg-surface)", border: "1px solid var(--fiq-border)" }}
      >
        <h3 className="font-semibold text-sm mb-1" style={{ color: "var(--fiq-text)" }}>Flag for Review</h3>
        <p className="text-xs mb-4" style={{ color: "var(--fiq-text-faintest)" }}>
          This facility will be added to the review queue.
        </p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason for flagging (required)"
          rows={3}
          className="w-full rounded-lg px-3 py-2 text-sm resize-none outline-none mb-4"
          style={{ background: "var(--fiq-bg-input)", border: "1px solid var(--fiq-border-strong)", color: "var(--fiq-text)" }}
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold rounded-lg border"
            style={{ borderColor: "var(--fiq-border)", color: "var(--fiq-text-faintest)" }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!reason.trim() || saving}
            className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-rose-500 text-white disabled:opacity-40"
          >
            {saving ? "Flagging…" : "⚑ Flag"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── OverrideModal ─────────────────────────────────────────────────────────────

function OverrideModal({
  facilityId,
  analystId,
  dimension,
  onClose,
}: {
  facilityId: string;
  analystId: string;
  dimension: string;
  onClose: () => void;
}) {
  const [score, setScore] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const n = parseFloat(score);
  const valid = reason.trim() !== "" && !isNaN(n) && n >= 0 && n <= 100;

  async function handleSubmit() {
    if (!valid) return;
    setSaving(true);
    await postAction(facilityId, analystId, "override", reason.trim(), dimension.toLowerCase(), n);
    setSaving(false);
    setSaved(true);
    setTimeout(onClose, 900);
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-sm mx-4 rounded-2xl p-6 shadow-2xl"
        style={{ background: "var(--fiq-bg-surface)", border: "1px solid var(--fiq-border)" }}
      >
        <h3 className="font-semibold text-sm mb-1" style={{ color: "var(--fiq-text)" }}>Override Score</h3>
        <p className="text-[10px] font-semibold uppercase tracking-wide mb-4" style={{ color: "var(--fiq-text-faintest)" }}>
          {dimension}
        </p>
        <input
          type="number"
          min={0}
          max={100}
          value={score}
          onChange={(e) => setScore(e.target.value)}
          placeholder="New score (0–100)"
          className="w-full rounded-lg px-3 py-2 text-sm outline-none mb-3"
          style={{ background: "var(--fiq-bg-input)", border: "1px solid var(--fiq-border-strong)", color: "var(--fiq-text)" }}
        />
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason for override (required)"
          rows={3}
          className="w-full rounded-lg px-3 py-2 text-sm resize-none outline-none mb-4"
          style={{ background: "var(--fiq-bg-input)", border: "1px solid var(--fiq-border-strong)", color: "var(--fiq-text)" }}
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold rounded-lg border"
            style={{ borderColor: "var(--fiq-border)", color: "var(--fiq-text-faintest)" }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!valid || saving}
            className="px-4 py-1.5 text-xs font-semibold rounded-lg disabled:opacity-40"
            style={{ background: "var(--fiq-text)", color: "var(--fiq-bg)" }}
          >
            {saved ? "✓ Saved" : saving ? "Saving…" : "Apply Override"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── ParkedStatusModal ─────────────────────────────────────────────────────────

function ParkedStatusModal({
  onConfirm,
  onCancel,
}: {
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        className="w-full max-w-sm mx-4 rounded-2xl p-6 shadow-2xl"
        style={{ background: "var(--fiq-bg-surface)", border: "1px solid var(--fiq-border)" }}
      >
        <h3 className="font-semibold text-sm mb-1" style={{ color: "var(--fiq-text)" }}>Park for Later</h3>
        <p className="text-xs mb-4" style={{ color: "var(--fiq-text-faintest)" }}>
          Provide a reason — visible on the Kanban board.
        </p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason for parking (required)"
          rows={3}
          className="w-full rounded-lg px-3 py-2 text-sm resize-none outline-none mb-4"
          style={{ background: "var(--fiq-bg-input)", border: "1px solid var(--fiq-border-strong)", color: "var(--fiq-text)" }}
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-1.5 text-xs font-semibold rounded-lg border"
            style={{ borderColor: "var(--fiq-border)", color: "var(--fiq-text-faintest)" }}
          >
            Cancel
          </button>
          <button
            onClick={() => reason.trim() && onConfirm(reason.trim())}
            disabled={!reason.trim()}
            className="px-4 py-1.5 text-xs font-semibold rounded-lg disabled:opacity-40"
            style={{ background: "var(--fiq-text)", color: "var(--fiq-bg)" }}
          >
            Park
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── GuidedAnalysis (main export) ──────────────────────────────────────────────

interface Props {
  detail: FacilityDetail;
  analystId: string;
}

export default function GuidedAnalysis({ detail, analystId }: Props) {
  const { facility, trust_signals } = detail;
  const [showAll, setShowAll] = useState(false);
  const [flagOpen, setFlagOpen] = useState(false);
  const [flagHover, setFlagHover] = useState(false);
  const [overrideDim, setOverrideDim] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<{ label: string; value: string } | null>(null);

  const [reviewStatus, setReviewStatus] = useState<ReviewStatus>("not_started");
  const [_reviewParkedReason, setReviewParkedReason] = useState<string | null>(null);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [parkingFromStatus, setParkingFromStatus] = useState(false);

  useEffect(() => {
    fetchReviewStatus(facility.facility_id).then((r) => {
      setReviewStatus(r.status);
      setReviewParkedReason(r.parked_reason);
    });
  }, [facility.facility_id]);

  async function handleStatusChange(toStatus: ReviewStatus) {
    setStatusMenuOpen(false);
    if (toStatus === "parked") { setParkingFromStatus(true); return; }
    setReviewStatus(toStatus);
    setReviewParkedReason(null);
    await postReviewStatus(facility.facility_id, toStatus);
  }

  async function confirmParkedStatus(reason: string) {
    setParkingFromStatus(false);
    setReviewStatus("parked");
    setReviewParkedReason(reason);
    await postReviewStatus(facility.facility_id, "parked", reason);
  }

  const containerRef = useRef<HTMLDivElement>(null);
  const bubbleRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const lastHoverRef = useRef<HTMLDivElement | null>(null);
  const showAllRef = useRef(showAll);
  useEffect(() => { showAllRef.current = showAll; }, [showAll]);

  const fields = useMemo(() => buildFields(detail), [detail]);

  const scoreBands = useMemo((): ScoreBandDef[] =>
    ["capability", "equipment", "procedure", "completeness"].map((dim) => {
      const sig = trust_signals.find((s) => s.dimension === dim);
      return {
        dimension: dim.charAt(0).toUpperCase() + dim.slice(1),
        score: sig ? scoreToInt(sig.trust_score) : null,
        confidence_tier: sig?.confidence_tier ?? "insufficient_data",
      };
    }),
  [trust_signals]);

  const overall = useMemo(() => overallScore(trust_signals), [trust_signals]);

  const grouped = useMemo(() => {
    const map = new Map<string, FacilityField[]>([
      ["Identity", []], ["Clinical", []], ["Capacity", []], ["Operations", []],
    ]);
    for (const f of fields) map.get(f.category)?.push(f);
    return map;
  }, [fields]);

  const allHighlights = useMemo(() => fields.flatMap((f) => f.highlights ?? []), [fields]);

  // Mount / unmount bubble DOM elements inside the container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    allHighlights.forEach((hl) => {
      if (bubbleRefs.current.has(hl.id)) return;
      const el = document.createElement("div");
      el.className = `ga-bubble ${hl.type === "evidence" ? "ga-bubble-e" : "ga-bubble-c"}`;
      el.style.cssText = "display:none;";

      const body = document.createElement("div");
      body.className = "ga-bubble-body";

      const icon = document.createElement("span");
      icon.className = "ga-bubble-icon";
      icon.textContent = hl.type === "evidence" ? "💬" : "⚠";

      const text = document.createElement("span");
      text.className = "ga-bubble-text";
      text.textContent = hl.bubble;

      if (hl.type === "evidence" && hl.score != null) {
        const chip = document.createElement("span");
        chip.className = `ga-score-chip ga-score-${hl.score >= 70 ? "high" : hl.score >= 40 ? "med" : "low"}`;
        chip.textContent = ` ${hl.score} · ${hl.score >= 70 ? "HIGH" : hl.score >= 40 ? "MED" : "LOW"}`;
        text.appendChild(chip);
      }

      body.appendChild(icon);
      body.appendChild(text);

      const tail = document.createElement("div");
      tail.className = "ga-tail";
      tail.style.cssText = "position:absolute;width:0;height:0;";

      el.appendChild(body);
      el.appendChild(tail);
      container.appendChild(el);
      bubbleRefs.current.set(hl.id, el);
    });

    return () => {
      bubbleRefs.current.forEach((el) => el.remove());
      bubbleRefs.current.clear();
    };
  }, [allHighlights]);

  // Show-all: place every bubble avoiding overlaps.
  // allHighlights in deps so re-placement fires when facility changes while showAll=true.
  useEffect(() => {
    const container = containerRef.current;
    if (!showAll) {
      bubbleRefs.current.forEach(clearBubble);
      return;
    }
    if (!container) return;
    const placed: PlacedRect[] = [];
    container.querySelectorAll<HTMLElement>("[data-bubble-anchor]").forEach((span) => {
      const id = span.dataset.bubbleAnchor!;
      const bubble = bubbleRefs.current.get(id);
      if (bubble) placeBubble(container, bubble, span, placed, true);
    });
  }, [showAll, allHighlights]);

  const handleSpanEnter = useCallback((spanEl: HTMLElement, id: string) => {
    if (showAllRef.current) return;
    const container = containerRef.current;
    if (!container) return;
    if (lastHoverRef.current) clearBubble(lastHoverRef.current);
    const bubble = bubbleRefs.current.get(id);
    if (!bubble) return;
    placeBubble(container, bubble, spanEl, [], true);
    lastHoverRef.current = bubble;
  }, []);

  const handleSpanLeave = useCallback(() => {
    if (showAllRef.current) return;
    if (lastHoverRef.current) { clearBubble(lastHoverRef.current); lastHoverRef.current = null; }
  }, []);

  return (
    <div ref={containerRef} className="relative min-h-screen" style={{ background: "var(--fiq-bg)" }}>
      <div className="max-w-3xl mx-auto px-6 py-8 flex flex-col gap-6">

        {/* Facility header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight mb-2" style={{ color: "var(--fiq-text)" }}>
              {facility.facility_name}
            </h1>
            <div className="flex items-center gap-3 text-xs flex-wrap" style={{ color: "var(--fiq-text-subdued)" }}>
              {facility.state && <span>📍 {facility.state}</span>}
              {facility.facility_type && (
                <>
                  <span className="h-3 w-px" style={{ background: "var(--fiq-border)" }} />
                  <span>🏥 {facility.facility_type}</span>
                </>
              )}
              {facility.district && (
                <>
                  <span className="h-3 w-px" style={{ background: "var(--fiq-border)" }} />
                  <span>{facility.district}</span>
                </>
              )}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-5xl font-bold tabular-nums leading-none" style={{ color: "var(--fiq-text)" }}>
              {overall ?? "—"}
            </div>
            <div
              className="text-[10px] font-semibold uppercase tracking-widest mt-1"
              style={{ color: overall !== null ? trustColor(overall) : "var(--fiq-text-faintest)" }}
            >
              Overall · {overall !== null ? trustLabel(overall) : "Insufficient Data"}
            </div>
            <button
              onClick={() => setFlagOpen(true)}
              onMouseEnter={() => setFlagHover(true)}
              onMouseLeave={() => setFlagHover(false)}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors"
              style={{
                color: "var(--fiq-trust-low)",
                borderColor: "var(--fiq-trust-low)",
                background: flagHover ? "rgba(220,38,38,0.16)" : "rgba(220,38,38,0.08)",
              }}
            >
              ⚑ Flag for Review
            </button>
            <div className="relative mt-2">
              <button
                onClick={() => setStatusMenuOpen((o) => !o)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors"
                style={{
                  color: REVIEW_STATUS_CONFIG[reviewStatus].color,
                  borderColor: REVIEW_STATUS_CONFIG[reviewStatus].color,
                  background: `${REVIEW_STATUS_CONFIG[reviewStatus].color}14`,
                }}
              >
                ● {REVIEW_STATUS_CONFIG[reviewStatus].label}
              </button>
              {statusMenuOpen && (
                <div
                  className="absolute right-0 top-full mt-1 rounded-xl overflow-hidden z-30 shadow-xl"
                  style={{ minWidth: 160, background: "var(--fiq-bg-surface)", border: "1px solid var(--fiq-border)" }}
                >
                  {(Object.keys(REVIEW_STATUS_CONFIG) as ReviewStatus[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => handleStatusChange(s)}
                      className="w-full text-left flex items-center gap-2 px-3 py-2 text-[11px] transition-opacity hover:opacity-70"
                      style={{ color: s === reviewStatus ? REVIEW_STATUS_CONFIG[s].color : "var(--fiq-text-muted)", fontWeight: s === reviewStatus ? 700 : 400 }}
                    >
                      <span style={{ color: REVIEW_STATUS_CONFIG[s].color }}>●</span>
                      {REVIEW_STATUS_CONFIG[s].label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Trust dimensions */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "var(--fiq-text-faintest)" }}>
            Trust Dimensions
          </p>
          <div className="flex flex-wrap gap-3">
            {scoreBands.map((ts) => (
              <ScoreBand key={ts.dimension} ts={ts} onEdit={setOverrideDim} />
            ))}
          </div>
        </div>

        {/* Facility data */}
        <div
          className="rounded-2xl p-6 flex flex-col gap-5"
          style={{ background: "var(--fiq-bg-surface)", border: "1px solid var(--fiq-border)" }}
        >
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold" style={{ color: "var(--fiq-text)" }}>Facility Data</h2>
              <span
                className="text-[10px] px-2 py-0.5 rounded-full"
                style={{ color: "var(--fiq-text-faintest)", background: "var(--fiq-bg-input)", border: "1px solid var(--fiq-border)" }}
              >
                Hover highlighted text to read evidence
              </span>
            </div>
            <button
              onClick={() => setShowAll((v) => !v)}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-all duration-150 ${
                showAll ? "bg-indigo-600 text-white border-indigo-600" : "text-indigo-500 border-indigo-300 hover:border-indigo-500"
              }`}
              style={showAll ? {} : { background: "var(--fiq-bg-surface)" }}
            >
              {showAll ? "◉ Hide evidence" : "◈ Show all evidence"}
            </button>
          </div>

          {CATEGORY_ORDER.map((cat) => (
            <CategorySection
              key={cat}
              name={cat}
              fields={grouped.get(cat) ?? []}
              onSpanEnter={handleSpanEnter}
              onSpanLeave={handleSpanLeave}
              onVerify={(label) =>
                postAction(facility.facility_id, analystId, "note", `Verified: ${label}`)
              }
              onEdit={(label, value) => setEditingField({ label, value })}
            />
          ))}
        </div>

        {/* Workbench (notes only) */}
        <Workbench facilityId={facility.facility_id} analystId={analystId} />
      </div>

      {flagOpen && (
        <FlagModal facilityId={facility.facility_id} analystId={analystId} onClose={() => setFlagOpen(false)} />
      )}
      {editingField && (
        <EditFieldModal
          fieldLabel={editingField.label}
          currentValue={editingField.value}
          onSubmit={(newValue, reason) => {
            postAction(facility.facility_id, analystId, "note", `Edit ${editingField.label}: "${newValue}" — ${reason}`);
            setEditingField(null);
          }}
          onClose={() => setEditingField(null)}
        />
      )}
      {parkingFromStatus && (
        <ParkedStatusModal
          onConfirm={confirmParkedStatus}
          onCancel={() => setParkingFromStatus(false)}
        />
      )}
      {overrideDim && (
        <OverrideModal
          facilityId={facility.facility_id}
          analystId={analystId}
          dimension={overrideDim}
          onClose={() => setOverrideDim(null)}
        />
      )}
    </div>
  );
}
