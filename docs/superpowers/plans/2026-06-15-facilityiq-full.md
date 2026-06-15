# FacilityIQ Full Feature Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete FacilityIQ with expandable evidence panels, contradiction detail, insufficient-data badges, full analyst workbench (notes, overrides, shortlist, flags), search filters, pagination, and a final theme polish pass.

**Prerequisites:** MVP plan (`2026-06-15-facilityiq-mvp.md`) fully deployed. The app is live with search, a facility list, and basic ScoreCard working.

**Architecture:** Extends the MVP. All new features are additions to existing files — no architectural changes. Analyst workbench uses the existing `/api/facilities/:id/actions` routes added in the MVP.

**Tech Stack:** Same as MVP — AppKit, React, inline styles (Navy Dark), Lakebase Postgres.

---

## Task 1: Expandable `TrustDimension.tsx`

Replace the flat dimension rows in `ScoreCard.tsx` with a collapsible `TrustDimension` component that reveals evidence quotes and contradiction details on click.

**Files:**
- Create: `app/client/src/components/TrustDimension.tsx`
- Modify: `app/client/src/components/ScoreCard.tsx`

- [ ] **Step 1: Create `TrustDimension.tsx`**

```tsx
// app/client/src/components/TrustDimension.tsx
import { useState } from "react";
import type { TrustSignal } from "../types";
import { scoreToInt, trustColor, trustLabel } from "../types";

interface Props {
  signal: TrustSignal;
}

export default function TrustDimension({ signal }: Props) {
  const [open, setOpen] = useState(false);
  const dimScore = scoreToInt(signal.trust_score);
  const color = trustColor(dimScore);
  const isInsufficient = signal.confidence_tier === "insufficient_data";

  return (
    <div style={{
      border: `1px solid ${signal.contradiction ? "rgba(255,54,33,0.3)" : "rgba(255,255,255,0.07)"}`,
      borderRadius: 6, marginBottom: 8, overflow: "hidden",
    }}>
      {/* Header row — always visible, click to toggle */}
      <div
        onClick={() => setOpen((o) => !o)}
        style={{
          padding: "10px 14px", cursor: "pointer",
          background: open ? "rgba(255,255,255,0.03)" : "transparent",
          display: "flex", flexDirection: "column", gap: 6,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{
            fontSize: 10, fontWeight: 600, letterSpacing: "0.5px",
            textTransform: "uppercase", color: "rgba(255,255,255,0.7)",
          }}>
            {signal.dimension}
            {signal.contradiction && (
              <span style={{ color: "#FF3621", marginLeft: 6 }}>⚠</span>
            )}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {isInsufficient ? (
              <span style={{
                fontSize: 9, background: "rgba(251,191,36,0.12)",
                color: "#fbbf24", padding: "2px 8px", borderRadius: 4, fontWeight: 600,
              }}>
                INSUFFICIENT DATA
              </span>
            ) : (
              <span style={{ fontSize: 12, fontWeight: 700, color }}>
                {dimScore} · {trustLabel(dimScore)}
              </span>
            )}
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)" }}>
              {open ? "▲" : "▼"}
            </span>
          </div>
        </div>
        {!isInsufficient && dimScore !== null && (
          <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2 }}>
            <div style={{
              height: "100%", width: `${dimScore}%`,
              background: color, borderRadius: 2,
            }} />
          </div>
        )}
      </div>

      {/* Expanded panel */}
      {open && (
        <div style={{
          borderTop: "1px solid rgba(255,255,255,0.06)",
          padding: "10px 14px", background: "rgba(0,0,0,0.15)",
        }}>
          {/* Insufficient data explanation */}
          {isInsufficient && signal.evidence_text && (
            <p style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", margin: 0 }}>
              {signal.evidence_text}
            </p>
          )}

          {/* Evidence quote */}
          {!isInsufficient && signal.evidence_text && (
            <div style={{ marginBottom: signal.contradiction ? 10 : 0 }}>
              <div style={{
                fontSize: 8, fontWeight: 600, color: "rgba(255,255,255,0.3)",
                textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6,
              }}>
                Evidence · {signal.source_field ?? "unknown field"}
              </div>
              <div style={{
                borderLeft: "2px solid rgba(255,255,255,0.15)",
                paddingLeft: 10,
                fontSize: 11, color: "rgba(255,255,255,0.65)",
                fontStyle: "italic", lineHeight: 1.5,
              }}>
                "{signal.evidence_text}"
              </div>
            </div>
          )}

          {/* Contradiction detail */}
          {signal.contradiction && signal.contradiction_detail && (
            <div style={{
              background: "rgba(255,54,33,0.08)",
              border: "1px solid rgba(255,54,33,0.2)",
              borderRadius: 4, padding: "8px 10px",
              marginTop: signal.evidence_text ? 10 : 0,
            }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#FF3621", marginBottom: 3 }}>
                CONTRADICTION DETAIL
              </div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", lineHeight: 1.4 }}>
                {signal.contradiction_detail}
              </div>
            </div>
          )}

          {/* No evidence fallback */}
          {!isInsufficient && !signal.evidence_text && (
            <p style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", margin: 0 }}>
              No evidence text available for this dimension.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Replace dimension rows in `ScoreCard.tsx` with `TrustDimension`**

Find the `{trust_signals.map(...)}` block in `app/client/src/components/ScoreCard.tsx` and replace it:

```tsx
// Replace the existing trust_signals.map block with:
import TrustDimension from "./TrustDimension";

// Inside the component JSX, replace the dimensions map:
{trust_signals.map((signal) => (
  <TrustDimension key={signal.dimension} signal={signal} />
))}
```

The full updated return in ScoreCard (dimensions section only — keep everything else):
```tsx
      {/* Dimension label */}
      <div style={{
        fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.3)",
        letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 10,
      }}>
        Trust Dimensions
      </div>

      {trust_signals.map((signal) => (
        <TrustDimension key={signal.dimension} signal={signal} />
      ))}
```

- [ ] **Step 3: Verify in browser — click a dimension to expand**

```bash
cd app && npm run dev
```

Click any facility, then click a dimension row. Evidence quote should appear. Click again to collapse. Stop with Ctrl+C.

- [ ] **Step 4: Commit**

```bash
cd .. && git add app/client/src/components/TrustDimension.tsx app/client/src/components/ScoreCard.tsx
git commit -m "feat: add expandable TrustDimension with evidence panel"
```

---

## Task 2: `ContradictionAlert.tsx` — full detail banner

**Files:**
- Create: `app/client/src/components/ContradictionAlert.tsx`
- Modify: `app/client/src/components/ScoreCard.tsx`

- [ ] **Step 1: Create `ContradictionAlert.tsx`**

```tsx
// app/client/src/components/ContradictionAlert.tsx
import type { TrustSignal } from "../types";

interface Props {
  signals: TrustSignal[];
}

export default function ContradictionAlert({ signals }: Props) {
  const contradictions = signals.filter((s) => s.contradiction);
  if (contradictions.length === 0) return null;

  return (
    <div style={{
      background: "rgba(255,54,33,0.08)",
      border: "1px solid rgba(255,54,33,0.25)",
      borderRadius: 6, padding: "12px 14px", marginBottom: 16,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#FF3621", marginBottom: 6 }}>
        ⚠ CONTRADICTION{contradictions.length > 1 ? "S" : ""} DETECTED · {contradictions.length} DIMENSION{contradictions.length > 1 ? "S" : ""}
      </div>
      {contradictions.map((s) => (
        <div key={s.dimension} style={{
          marginTop: 8, paddingTop: 8,
          borderTop: "1px solid rgba(255,54,33,0.15)",
        }}>
          <div style={{
            fontSize: 9, fontWeight: 700, color: "rgba(255,54,33,0.8)",
            textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4,
          }}>
            {s.dimension}
          </div>
          {s.contradiction_detail && (
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", lineHeight: 1.4 }}>
              {s.contradiction_detail}
            </div>
          )}
          <div style={{ fontSize: 9, color: "rgba(255,54,33,0.7)", marginTop: 4, fontWeight: 600 }}>
            Do not rely on the conflicting structured field.
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Replace the inline contradiction banner in `ScoreCard.tsx`**

Replace the existing `{hasContradiction && (...)}` block:

```tsx
import ContradictionAlert from "./ContradictionAlert";

// Replace:
{hasContradiction && (
  <div style={{ ... }}>...</div>
)}

// With:
<ContradictionAlert signals={trust_signals} />
```

- [ ] **Step 3: Verify in browser — find a facility with `⚠ CONTRADICTION` in the list**

Contradiction banner should now list each affected dimension and its explanation.

- [ ] **Step 4: Commit**

```bash
cd .. && git add app/client/src/components/ContradictionAlert.tsx app/client/src/components/ScoreCard.tsx
git commit -m "feat: add ContradictionAlert banner with per-dimension detail"
```

---

## Task 3: Analyst Workbench

**Files:**
- Create: `app/client/src/components/Workbench.tsx`
- Modify: `app/client/src/components/ScoreCard.tsx`

- [ ] **Step 1: Create `Workbench.tsx`**

```tsx
// app/client/src/components/Workbench.tsx
import { useState, useEffect } from "react";
import type { UserAction, TrustSignal } from "../types";

interface Props {
  facilityId: string;
  analystId: string;
  signals: TrustSignal[];
}

export default function Workbench({ facilityId, analystId, signals }: Props) {
  const [actions, setActions] = useState<UserAction[]>([]);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [shortlisted, setShortlisted] = useState(false);
  const [flagged, setFlagged] = useState(false);

  // Load existing actions
  useEffect(() => {
    fetch(`/api/facilities/${facilityId}/actions?analyst_id=${analystId}`)
      .then((r) => r.json())
      .then((data: UserAction[]) => {
        setActions(data);
        const note = data.find((a) => a.action_type === "note");
        if (note?.content) setNoteText(note.content);
        // Use latest content value (DISTINCT ON returns most recent row per action_type)
        setShortlisted(data.some((a) => a.action_type === "shortlist" && a.content === "added"));
        setFlagged(data.some((a) => a.action_type === "flag" && a.content === "flagged"));
      })
      .catch(() => {});
  }, [facilityId, analystId]);

  async function postAction(
    action_type: "note" | "override" | "shortlist" | "flag",
    content?: string,
    dimension?: string,
    override_score?: number,
  ) {
    const res = await fetch(`/api/facilities/${facilityId}/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ analyst_id: analystId, action_type, content, dimension, override_score }),
    });
    return res.ok;
  }

  async function saveNote() {
    if (!noteText.trim()) return;
    setSavingNote(true);
    await postAction("note", noteText.trim());
    setSavingNote(false);
  }

  async function toggleShortlist() {
    const next = !shortlisted;
    const ok = await postAction("shortlist", next ? "added" : "removed");
    if (ok) setShortlisted(next);
  }

  async function toggleFlag() {
    const next = !flagged;
    const ok = await postAction("flag", next ? "flagged" : "cleared");
    if (ok) setFlagged(next);
  }

  const dimensionOptions = signals
    .filter((s) => s.confidence_tier !== "insufficient_data")
    .map((s) => s.dimension);

  const [overrideDimension, setOverrideDimension] = useState(dimensionOptions[0] ?? "");
  const [overrideScore, setOverrideScore] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [savingOverride, setSavingOverride] = useState(false);
  const [overrideSaved, setOverrideSaved] = useState(false);

  async function saveOverride() {
    if (!overrideDimension || !overrideScore || !overrideReason.trim()) return;
    setSavingOverride(true);
    const score = parseFloat(overrideScore);
    const ok = await postAction("override", overrideReason.trim(), overrideDimension, score);
    if (ok) { setOverrideSaved(true); setTimeout(() => setOverrideSaved(false), 2000); }
    setSavingOverride(false);
  }

  const cellStyle: React.CSSProperties = {
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 5, padding: "10px 12px",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 9, fontWeight: 600, color: "rgba(255,255,255,0.4)",
    letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 7,
  };
  const inputStyle: React.CSSProperties = {
    width: "100%", boxSizing: "border-box",
    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 4, color: "white", fontSize: 11, outline: "none", resize: "none",
  };
  const btnStyle = (active?: boolean): React.CSSProperties => ({
    display: "block", width: "100%", marginTop: 6,
    background: active ? "#FF3621" : "rgba(255,255,255,0.06)",
    color: active ? "white" : "rgba(255,255,255,0.7)",
    border: "none", borderRadius: 4, padding: "5px 8px",
    fontSize: 10, cursor: "pointer", fontWeight: 600,
  });

  return (
    <div style={{ marginTop: 20 }}>
      {/* Header */}
      <div style={{
        background: "#081519", padding: "8px 14px",
        fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.5)",
        letterSpacing: "1px", borderRadius: "6px 6px 0 0",
        border: "1px solid rgba(255,255,255,0.07)", borderBottom: "none",
      }}>
        ANALYST WORKBENCH
      </div>

      <div style={{
        border: "1px solid rgba(255,255,255,0.07)", borderRadius: "0 0 6px 6px",
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1,
        background: "rgba(255,255,255,0.07)",
        overflow: "hidden",
      }}>
        {/* Notes */}
        <div style={{ ...cellStyle, background: "#0B2026" }}>
          <div style={labelStyle}>📝 Notes</div>
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            rows={3}
            placeholder="Add a note about this facility..."
            style={{ ...inputStyle, padding: "6px 8px" }}
          />
          <button onClick={saveNote} disabled={savingNote} style={btnStyle()}>
            {savingNote ? "Saving..." : "Save Note"}
          </button>
        </div>

        {/* Override */}
        <div style={{ ...cellStyle, background: "#0B2026" }}>
          <div style={labelStyle}>✏️ Override Score</div>
          <select
            value={overrideDimension}
            onChange={(e) => setOverrideDimension(e.target.value)}
            style={{ ...inputStyle, padding: "5px 7px", marginBottom: 4 }}
          >
            {dimensionOptions.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <input
            type="number" min={0} max={100}
            value={overrideScore}
            onChange={(e) => setOverrideScore(e.target.value)}
            placeholder="New score (0–100)"
            style={{ ...inputStyle, padding: "5px 7px", marginBottom: 4 }}
          />
          <input
            value={overrideReason}
            onChange={(e) => setOverrideReason(e.target.value)}
            placeholder="Reason (required)"
            style={{ ...inputStyle, padding: "5px 7px" }}
          />
          <button onClick={saveOverride} disabled={savingOverride} style={btnStyle()}>
            {overrideSaved ? "✓ Saved" : savingOverride ? "Saving..." : "Apply Override"}
          </button>
        </div>

        {/* Shortlist */}
        <div style={{ ...cellStyle, background: "#0B2026" }}>
          <div style={labelStyle}>⊞ Shortlist</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>
            {shortlisted
              ? "Added to your shortlist"
              : "Add this facility to your shortlist for review."}
          </div>
          <button onClick={toggleShortlist} style={btnStyle(shortlisted)}>
            {shortlisted ? "★ Shortlisted" : "☆ Add to Shortlist"}
          </button>
        </div>

        {/* Flag */}
        <div style={{ ...cellStyle, background: "#0B2026" }}>
          <div style={labelStyle}>⚑ Flag for Review</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>
            {flagged
              ? "Flagged — manual review required"
              : "Flag this facility for manual follow-up."}
          </div>
          <button onClick={toggleFlag} style={btnStyle(flagged)}>
            {flagged ? "⚑ Flagged" : "⚐ Flag for Review"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add `Workbench` below dimensions in `ScoreCard.tsx`**

At the bottom of the `ScoreCard` return, after the dimensions list:

```tsx
import Workbench from "./Workbench";

// Add after trust_signals.map(...):
<Workbench
  facilityId={facility.facility_id}
  analystId={analystId}
  signals={trust_signals}
/>
```

Also verify `ScoreCard` receives `analystId` in its Props interface. It already does from the MVP.

- [ ] **Step 3: Verify in browser — add a note and shortlist a facility**

```bash
cd app && npm run dev
```

Select a facility. Workbench panel appears at the bottom of the right panel. Type a note, click Save. Refresh the page, select the same facility — note should persist. Toggle shortlist. Stop with Ctrl+C.

- [ ] **Step 4: Commit**

```bash
cd .. && git add app/client/src/components/Workbench.tsx app/client/src/components/ScoreCard.tsx
git commit -m "feat: implement analyst Workbench with notes, override, shortlist, flag"
```

---

## Task 4: Search filters in `SearchPanel.tsx`

**Files:**
- Modify: `app/client/src/components/SearchPanel.tsx`
- Modify: `app/server/server.ts`

- [ ] **Step 1: Update the `/api/facilities` route in `server.ts` to support filters**

Add filter parameters to the existing route. Replace the `/api/facilities` handler:

```typescript
app.get("/api/facilities", async (req, res) => {
  const q = String(req.query.q ?? "");
  const page = Math.max(1, parseInt(String(req.query.page ?? "1")));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "25"))));
  const offset = (page - 1) * limit;
  const state = String(req.query.state ?? "");
  const facility_type = String(req.query.facility_type ?? "");
  const min_score = parseFloat(String(req.query.min_score ?? "0")) / 100; // convert 0–100 → 0–1
  const contradictions_only = req.query.contradictions_only === "true";
  const search = q ? `%${q}%` : null;

  const { rows } = await appkit.lakebase.query(`
    SELECT
      f.facility_id,
      f.facility_name,
      f.state,
      f.facility_type,
      AVG(t.trust_score)::real AS overall_trust_score,
      MAX(CASE WHEN t.contradiction THEN 1 ELSE 0 END)::int AS has_contradiction,
      COUNT(t.dimension)::int AS signal_count
    FROM public.facilities f
    LEFT JOIN public.trust_signals t ON f.facility_id = t.facility_id
    WHERE ($1::text IS NULL OR
      f.facility_name ILIKE $1 OR
      f.description ILIKE $1 OR
      f.capability ILIKE $1 OR
      f.state ILIKE $1)
      AND ($2::text = '' OR f.state = $2)
      AND ($3::text = '' OR f.facility_type = $3)
    GROUP BY f.facility_id, f.facility_name, f.state, f.facility_type
    HAVING ($4 = 0 OR COALESCE(AVG(t.trust_score), 0) >= $4)
       AND ($5 = false OR MAX(CASE WHEN t.contradiction THEN 1 ELSE 0 END) = 1)
    ORDER BY overall_trust_score DESC NULLS LAST
    LIMIT $6 OFFSET $7
  `, [search, state, facility_type, min_score, contradictions_only, limit, offset]);

  res.json(rows);
});
```

- [ ] **Step 2: Add a `GET /api/facilities/meta` route for filter options**

Add inside the same `appkit.server.extend` block, before the closing `});`:

```typescript
// GET /api/facilities/meta — distinct states and types for filter dropdowns
// Register BEFORE /api/facilities/:id to avoid route conflict
app.get("/api/facilities/meta", async (_req, res) => {
  const [statesResult, typesResult] = await Promise.all([
    appkit.lakebase.query(
      `SELECT DISTINCT state FROM public.facilities WHERE state IS NOT NULL ORDER BY state`
    ),
    appkit.lakebase.query(
      `SELECT DISTINCT facility_type FROM public.facilities WHERE facility_type IS NOT NULL ORDER BY facility_type`
    ),
  ]);
  res.json({
    states: statesResult.rows.map((r: { state: string }) => r.state),
    facility_types: typesResult.rows.map((r: { facility_type: string }) => r.facility_type),
  });
});
```

**Important:** Register `/api/facilities/meta` BEFORE `/api/facilities/:id` in `server.ts` or Express will match `meta` as the `:id` param.

- [ ] **Step 3: Update `SearchPanel.tsx` with filter row and pagination**

Replace the entire `SearchPanel.tsx` with the updated version:

```tsx
// app/client/src/components/SearchPanel.tsx
import { useState, useEffect, useRef } from "react";
import type { FacilityListItem } from "../types";
import FacilityCard from "./FacilityCard";

interface Meta {
  states: string[];
  facility_types: string[];
}

interface Props {
  onSelect: (id: string) => void;
  selectedId: string | null;
}

export default function SearchPanel({ onSelect, selectedId }: Props) {
  const [query, setQuery] = useState("");
  const [state, setState] = useState("");
  const [facilityType, setFacilityType] = useState("");
  const [contradictionsOnly, setContradictionsOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [facilities, setFacilities] = useState<FacilityListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState<Meta>({ states: [], facility_types: [] });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const LIMIT = 25;

  useEffect(() => {
    fetch("/api/facilities/meta")
      .then((r) => r.json())
      .then(setMeta)
      .catch(() => {});
  }, []);

  function buildUrl(q: string, p: number) {
    const params = new URLSearchParams({
      q,
      page: String(p),
      limit: String(LIMIT),
    });
    if (state) params.set("state", state);
    if (facilityType) params.set("facility_type", facilityType);
    if (contradictionsOnly) params.set("contradictions_only", "true");
    return `/api/facilities?${params}`;
  }

  function fetchFacilities(q: string, p: number) {
    setLoading(true);
    fetch(buildUrl(q, p))
      .then((r) => r.json())
      .then((data: FacilityListItem[]) => { setFacilities(data); setLoading(false); })
      .catch(() => setLoading(false));
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { setPage(1); fetchFacilities(query, 1); }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, state, facilityType, contradictionsOnly]);

  useEffect(() => { fetchFacilities(query, page); }, [page]);
  useEffect(() => { fetchFacilities("", 1); }, []);

  const selectStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 4, color: "white", fontSize: 10, padding: "3px 6px", outline: "none",
  };

  return (
    <>
      {/* App header */}
      <div style={{
        background: "#081519", padding: "10px 16px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        display: "flex", alignItems: "center", gap: 8, flexShrink: 0,
      }}>
        <div style={{ width: 4, height: 16, background: "#FF3621", borderRadius: 1 }} />
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "1.5px" }}>FACILITYIQ</span>
        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", marginLeft: "auto" }}>
          TRUST DESK · INDIA
        </span>
      </div>

      {/* Search input */}
      <div style={{ padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search facilities, specialties, states..."
          style={{
            width: "100%", boxSizing: "border-box",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 6, padding: "7px 10px",
            color: "white", fontSize: 12, outline: "none",
          }}
        />
      </div>

      {/* Filter row */}
      <div style={{
        padding: "6px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)",
        display: "flex", gap: 5, flexWrap: "wrap", flexShrink: 0,
      }}>
        <select value={state} onChange={(e) => setState(e.target.value)} style={selectStyle}>
          <option value="">All States</option>
          {meta.states.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={facilityType} onChange={(e) => setFacilityType(e.target.value)} style={selectStyle}>
          <option value="">All Types</option>
          {meta.facility_types.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <button
          onClick={() => setContradictionsOnly((c) => !c)}
          style={{
            background: contradictionsOnly ? "rgba(255,54,33,0.2)" : "rgba(255,255,255,0.05)",
            border: `1px solid ${contradictionsOnly ? "rgba(255,54,33,0.5)" : "rgba(255,255,255,0.1)"}`,
            borderRadius: 4, color: contradictionsOnly ? "#FF3621" : "rgba(255,255,255,0.5)",
            fontSize: 9, padding: "3px 7px", cursor: "pointer", fontWeight: 600,
          }}
        >
          ⚠ Contradictions
        </button>
      </div>

      {/* Results count */}
      <div style={{
        padding: "5px 14px", fontSize: 9,
        color: "rgba(255,255,255,0.25)", letterSpacing: "0.5px", flexShrink: 0,
      }}>
        {loading ? "Searching..." : `${facilities.length} results · page ${page}`}
      </div>

      {/* Scrollable list */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {facilities.map((f) => (
          <FacilityCard
            key={f.facility_id}
            facility={f}
            selected={f.facility_id === selectedId}
            onClick={() => onSelect(f.facility_id)}
          />
        ))}
        {!loading && facilities.length === 0 && (
          <div style={{ padding: 16, fontSize: 11, color: "rgba(255,255,255,0.25)" }}>
            No results
          </div>
        )}
      </div>

      {/* Pagination */}
      <div style={{
        padding: "6px 12px", borderTop: "1px solid rgba(255,255,255,0.06)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        flexShrink: 0,
      }}>
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
          style={{
            background: "transparent", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 4, color: page === 1 ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.6)",
            fontSize: 10, padding: "3px 10px", cursor: page === 1 ? "default" : "pointer",
          }}
        >← Prev</button>
        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>Page {page}</span>
        <button
          onClick={() => setPage((p) => p + 1)}
          disabled={facilities.length < LIMIT}
          style={{
            background: "transparent", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 4, color: facilities.length < LIMIT ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.6)",
            fontSize: 10, padding: "3px 10px", cursor: facilities.length < LIMIT ? "default" : "pointer",
          }}
        >Next →</button>
      </div>
    </>
  );
}
```

- [ ] **Step 4: Verify filters work in browser**

```bash
cd app && npm run dev
```

Test: select a state from the dropdown → list filters. Toggle "⚠ Contradictions" → only contradiction facilities show. Click Next → page 2 loads. Stop with Ctrl+C.

- [ ] **Step 5: Commit**

```bash
cd .. && git add app/client/src/components/SearchPanel.tsx app/server/server.ts
git commit -m "feat: add state/type filters, contradictions toggle, and pagination"
```

---

## Task 5: Workbench badges in `FacilityCard.tsx`

Show shortlist and flag status inline in the list so Maya can see her annotations at a glance.

**Files:**
- Modify: `app/client/src/components/FacilityCard.tsx`
- Modify: `app/client/src/components/SearchPanel.tsx`

- [ ] **Step 1: Accept `actions` prop in `FacilityCard`**

Replace `FacilityCard.tsx` with the updated version:

```tsx
// app/client/src/components/FacilityCard.tsx
import type { FacilityListItem, UserAction } from "../types";
import { scoreToInt, trustColor, trustLabel } from "../types";

interface Props {
  facility: FacilityListItem;
  selected: boolean;
  onClick: () => void;
  actions?: UserAction[];
}

export default function FacilityCard({ facility, selected, onClick, actions = [] }: Props) {
  const score = scoreToInt(facility.overall_trust_score);
  const color = trustColor(score);
  const isShortlisted = actions.some(
    (a) => a.action_type === "shortlist" && a.content === "added"
  );
  const isFlagged = actions.some(
    (a) => a.action_type === "flag" && a.content === "flagged"
  );

  return (
    <div
      onClick={onClick}
      style={{
        padding: "10px 14px",
        borderLeft: `2px solid ${selected ? "#FF3621" : "transparent"}`,
        background: selected ? "rgba(255,255,255,0.04)" : "transparent",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
        cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ flex: 1, marginRight: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 2, lineHeight: 1.3 }}>
            {facility.facility_name}
          </div>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", letterSpacing: "0.3px" }}>
            {[facility.state, facility.facility_type].filter(Boolean).join(" · ")}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color, lineHeight: 1 }}>
            {score ?? "—"}
          </div>
          <div style={{ fontSize: 8, color, fontWeight: 600, letterSpacing: "0.3px" }}>
            {trustLabel(score)}
          </div>
        </div>
      </div>
      {(facility.has_contradiction === 1 || isShortlisted || isFlagged) && (
        <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
          {facility.has_contradiction === 1 && (
            <span style={{ fontSize: 8, color: "#FF3621", fontWeight: 600 }}>⚠ Contradiction</span>
          )}
          {isShortlisted && (
            <span style={{ fontSize: 8, color: "#60a5fa", fontWeight: 600 }}>★ Shortlisted</span>
          )}
          {isFlagged && (
            <span style={{ fontSize: 8, color: "#fbbf24", fontWeight: 600 }}>⚑ Flagged</span>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Load actions for the selected facility in `SearchPanel.tsx` and pass them down**

In `SearchPanel.tsx`, add actions state and pass to FacilityCard. Only load actions for the currently selected facility (no need to batch-load for all 25 in the list):

Add to SearchPanel imports and state:
```tsx
import type { UserAction } from "../types";
import { ANALYST_ID } from "../lib/analyst";  // avoids circular dependency with App.tsx

// Add to SearchPanel state:
const [selectedActions, setSelectedActions] = useState<UserAction[]>([]);

// Add useEffect to load actions when selectedId changes:
useEffect(() => {
  if (!selectedId) { setSelectedActions([]); return; }
  fetch(`/api/facilities/${selectedId}/actions?analyst_id=${ANALYST_ID}`)
    .then((r) => r.json())
    .then(setSelectedActions)
    .catch(() => {});
}, [selectedId]);
```

Update the FacilityCard in the list render:
```tsx
<FacilityCard
  key={f.facility_id}
  facility={f}
  selected={f.facility_id === selectedId}
  onClick={() => onSelect(f.facility_id)}
  actions={f.facility_id === selectedId ? selectedActions : []}
/>
```

- [ ] **Step 3: Verify in browser — shortlist a facility and see the badge appear in the list**

After clicking "★ Add to Shortlist" in the workbench, the facility card in the left panel should show "★ Shortlisted".

- [ ] **Step 4: Commit**

```bash
cd .. && git add app/client/src/components/FacilityCard.tsx app/client/src/components/SearchPanel.tsx
git commit -m "feat: show shortlist/flag badges in facility list"
```

---

## Task 6: Implement validation notebook

**Files:**
- Modify: `notebooks/02_validate_signals.py`

- [ ] **Step 1: Implement `02_validate_signals.py`**

```python
# Databricks notebook — run after 01_trust_extraction.py
CATALOG = "YOUR_CATALOG"
SCHEMA = "facilityiq"

signals_df = spark.table(f"{CATALOG}.{SCHEMA}.facilities_trust_signals")
raw_df = spark.table(f"{CATALOG}.{SCHEMA}.facilities_raw")
errors_df = spark.table(f"{CATALOG}.{SCHEMA}.extraction_errors")

total_raw = raw_df.count()
total_signals = signals_df.count()
covered = signals_df.select("facility_id").distinct().count()
error_count = errors_df.count()
contradiction_count = signals_df.filter("contradiction = true").count()
insufficient_count = signals_df.filter("confidence_tier = 'insufficient_data'").count()

print("=" * 60)
print("FACILITYIQ EXTRACTION VALIDATION REPORT")
print("=" * 60)
print(f"Facilities in raw table:        {total_raw}")
print(f"Facilities with signals:        {covered} ({covered/total_raw*100:.1f}%)")
print(f"Total signal rows:              {total_signals} (expect ~{total_raw*4})")
print(f"Extraction errors:              {error_count}")
print(f"Contradiction signals:          {contradiction_count}")
print(f"Insufficient data signals:      {insufficient_count}")

# Score distribution
print("\nScore distribution:")
signals_df.filter("trust_score IS NOT NULL") \
    .selectExpr(
        "dimension",
        "ROUND(trust_score * 100) AS score_int"
    ) \
    .groupBy("dimension") \
    .agg(
        {"score_int": "avg"},
    ).withColumnRenamed("avg(score_int)", "avg_score") \
    .orderBy("dimension") \
    .show()

# Sample contradictions
print("\nSample contradictions:")
signals_df.filter("contradiction = true") \
    .select("facility_id", "dimension", "contradiction_detail") \
    .limit(5) \
    .show(truncate=80)

# Check for facilities with no signals (might need retry)
missing = raw_df.join(
    signals_df.select("facility_id").distinct(),
    on="facility_id",
    how="left_anti"
).select("facility_id")
missing_count = missing.count()
print(f"\nFacilities missing signals: {missing_count}")
if missing_count > 0 and missing_count <= 20:
    missing.show()

assert covered > total_raw * 0.95, f"Coverage too low: {covered}/{total_raw}"
print("\nValidation PASSED.")
```

- [ ] **Step 2: Run the notebook on the cluster**

Expected output: Validation PASSED, coverage ≥95%, scores across all 4 dimensions, sample contradictions visible.

- [ ] **Step 3: Commit**

```bash
git add notebooks/02_validate_signals.py
git commit -m "feat: implement validation notebook with coverage and score distribution checks"
```

---

## Task 7: Final deploy and smoke test

**Files:** none

- [ ] **Step 1: Run `databricks apps validate` one final time**

```bash
cd app && databricks apps validate --profile <PROFILE>
```

Expected: Playwright smoke test passes.

- [ ] **Step 2: Deploy**

```bash
databricks apps deploy facilityiq --profile <PROFILE>
```

- [ ] **Step 3: End-to-end verification on the deployed app**

Open the deployed URL. Walk through the full Maya demo flow:

1. Search for "dialysis" → results appear ranked by trust score
2. Filter by a state → list narrows
3. Toggle "⚠ Contradictions" → only contradiction facilities show
4. Click a contradiction facility → red alert banner appears with detail
5. Click the capability dimension → evidence quote expands
6. Add a note → save → refresh page → note persists
7. Click "☆ Add to Shortlist" → badge appears in left panel list
8. Verify INSUFFICIENT DATA badge on completeness dimension

- [ ] **Step 4: Check logs for any errors**

```bash
databricks apps logs facilityiq --profile <PROFILE>
```

Fix any errors, redeploy.

- [ ] **Step 5: Tag the release**

```bash
git tag v1.0-hackathon
git push origin main --tags
```

---

**Full feature set complete.** FacilityIQ is deployed with all PRD features: search + filters + pagination, trust scorecard with expandable evidence, contradiction alerts, insufficient data badges, and analyst workbench (notes, overrides, shortlist, flags) with full persistence.
