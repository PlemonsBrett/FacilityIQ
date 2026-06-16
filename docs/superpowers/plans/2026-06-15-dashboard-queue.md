# Dashboard & Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Summary Dashboard and a Review Queue page behind an icon sidebar, giving analysts an at-a-glance overview of the dataset and a quick way to revisit their flagged and shortlisted facilities.

**Architecture:** No router — `App.tsx` holds a `view` state (`"desk" | "dashboard" | "queue"`) and renders the appropriate page. A new 40 px `Sidebar` component sits to the left of all views. Dashboard data is computed from the existing `DUMMY_LIST`/`DUMMY_DETAILS` in `dummy.ts`. Queue data reads analyst actions from localStorage via a new `allActedFacilityIds` helper.

**Tech Stack:** React 19, recharts (already installed), inline styles + CSS variable theme tokens, TypeScript.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `app/client/src/types.ts` | Modify | Export `overallScore` so Dashboard can reuse it |
| `app/client/src/lib/dummy.ts` | Modify | Add `allActedFacilityIds` helper |
| `app/client/src/index.css` | Modify | Add `.fiq-sidebar-btn:hover .fiq-sidebar-tip` tooltip rule |
| `app/client/src/components/Sidebar.tsx` | Create | Icon sidebar with nav + theme toggle + hover tooltips |
| `app/client/src/components/SearchPanel.tsx` | Modify | Remove theme toggle (moved to Sidebar) |
| `app/client/src/components/ScoreCard.tsx` | Modify | Import `overallScore` from `types` instead of defining locally |
| `app/client/src/App.tsx` | Modify | Add `view` state, render Sidebar, conditional pages |
| `app/client/src/pages/DashboardPage.tsx` | Create | KPIs + recharts charts + top/bottom facility lists |
| `app/client/src/pages/QueuePage.tsx` | Create | Tabbed flagged/shortlisted queue |

---

## Task 1: Foundation — `overallScore` in types.ts + `allActedFacilityIds` in dummy.ts

**Files:**
- Modify: `app/client/src/types.ts`
- Modify: `app/client/src/lib/dummy.ts`
- Modify: `app/client/src/components/ScoreCard.tsx`

- [ ] **Step 1: Export `overallScore` from `types.ts`**

Add this function at the bottom of `app/client/src/types.ts`:

```typescript
export function overallScore(signals: TrustSignal[]): number | null {
  const valid = signals
    .filter((s) => s.confidence_tier !== "insufficient_data" && s.trust_score !== null)
    .map((s) => parseScore(s.trust_score) as number);
  if (valid.length === 0) return null;
  return Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 100);
}
```

- [ ] **Step 2: Update `ScoreCard.tsx` to import `overallScore` from types**

Replace the local definition in `app/client/src/components/ScoreCard.tsx`. Change the import line and remove the local function:

```typescript
// Change:
import { trustColor, trustLabel, parseScore } from "../types";

// To:
import { trustColor, trustLabel, overallScore } from "../types";
```

Then delete the local `overallScore` function (the 7-line block starting with `function overallScore`).

- [ ] **Step 3: Add `allActedFacilityIds` to `dummy.ts`**

Add this at the bottom of `app/client/src/lib/dummy.ts`:

```typescript
export function allActedFacilityIds(analystId: string): string[] {
  const prefix = "fiq_actions_";
  const suffix = `_${analystId}`;
  const ids: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(prefix) && key.endsWith(suffix)) {
      const id = key.slice(prefix.length, key.length - suffix.length);
      if (id) ids.push(id);
    }
  }
  return ids;
}
```

- [ ] **Step 4: Type-check**

```bash
cd app && npm run typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd .. && git add app/client/src/types.ts app/client/src/lib/dummy.ts app/client/src/components/ScoreCard.tsx
git commit -m "refactor: export overallScore from types, add allActedFacilityIds helper"
```

---

## Task 2: Sidebar component + CSS tooltip + remove theme toggle from SearchPanel

**Files:**
- Modify: `app/client/src/index.css`
- Create: `app/client/src/components/Sidebar.tsx`
- Modify: `app/client/src/components/SearchPanel.tsx`

- [ ] **Step 1: Add tooltip CSS to `index.css`**

Add these lines just before the final `:root {` block (the AppKit variables block) in `app/client/src/index.css`:

```css
/* Sidebar tooltip hover */
.fiq-sidebar-btn .fiq-sidebar-tip { opacity: 0; transition: opacity 0.15s; }
.fiq-sidebar-btn:hover .fiq-sidebar-tip { opacity: 1; }
```

- [ ] **Step 2: Create `app/client/src/components/Sidebar.tsx`**

```tsx
import { useState } from "react";
import type { View } from "../App";
import { getTheme, toggleTheme } from "../lib/theme";

interface Props {
  view: View;
  onViewChange: (v: View) => void;
}

const NAV: { view: View; icon: string; label: string }[] = [
  { view: "desk", icon: "⊞", label: "Trust Desk" },
  { view: "dashboard", icon: "◫", label: "Dashboard" },
  { view: "queue", icon: "⚑", label: "Queue" },
];

export default function Sidebar({ view, onViewChange }: Props) {
  const [isDark, setIsDark] = useState(getTheme() === "dark");

  function handleTheme() {
    setIsDark(toggleTheme() === "dark");
  }

  const btnBase: React.CSSProperties = {
    width: 28, height: 28, border: "none", cursor: "pointer",
    borderRadius: 5, fontSize: 14,
    display: "flex", alignItems: "center", justifyContent: "center",
    position: "relative", background: "transparent",
  };

  const tip: React.CSSProperties = {
    position: "absolute", left: 36, top: "50%", transform: "translateY(-50%)",
    background: "#1e3a42", color: "var(--fiq-text)",
    fontSize: 10, padding: "3px 8px", borderRadius: 4,
    whiteSpace: "nowrap", pointerEvents: "none",
    border: "1px solid var(--fiq-border-strong)", zIndex: 50,
  };

  return (
    <div style={{
      width: 40, flexShrink: 0,
      background: "var(--fiq-bg-surface)",
      borderRight: "1px solid var(--fiq-border)",
      display: "flex", flexDirection: "column",
      alignItems: "center", padding: "10px 0", gap: 6,
    }}>
      <div style={{ width: 4, height: 16, background: "#FF3621", borderRadius: 1, marginBottom: 8 }} />

      {NAV.map(({ view: v, icon, label }) => (
        <button
          key={v}
          onClick={() => onViewChange(v)}
          className="fiq-sidebar-btn"
          title={label}
          style={{
            ...btnBase,
            background: view === v ? "rgba(255,255,255,0.07)" : "transparent",
            color: view === v ? "var(--fiq-text)" : "var(--fiq-text-faintest)",
          }}
        >
          {icon}
          <span className="fiq-sidebar-tip" style={tip}>{label}</span>
        </button>
      ))}

      <div style={{ flex: 1 }} />

      <button
        onClick={handleTheme}
        className="fiq-sidebar-btn"
        title={isDark ? "Light mode" : "Dark mode"}
        style={{ ...btnBase, color: "var(--fiq-text-faintest)", fontSize: 13 }}
      >
        {isDark ? "☀" : "◑"}
        <span className="fiq-sidebar-tip" style={tip}>
          {isDark ? "Light mode" : "Dark mode"}
        </span>
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Remove the theme toggle from `SearchPanel.tsx`**

In `app/client/src/components/SearchPanel.tsx`, remove:
- The import of `getTheme` and `toggleTheme` from `../lib/theme`
- The `isDark` state declaration
- The `handleThemeToggle` function
- The theme toggle `<button>` element in the header JSX

The header JSX should end at the `TRUST DESK · INDIA` span with no button after it:

```tsx
// Remove these lines entirely:
import { getTheme, toggleTheme } from "../lib/theme";
// ...
const [isDark, setIsDark] = useState(getTheme() === "dark");
// ...
function handleThemeToggle() {
  const next = toggleTheme();
  setIsDark(next === "dark");
}
// ...
<button
  onClick={handleThemeToggle}
  title={isDark ? "Switch to light mode" : "Switch to dark mode"}
  style={{ ... }}
>
  {isDark ? "☀" : "◑"}
</button>
```

- [ ] **Step 4: Type-check**

```bash
cd app && npm run typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd .. && git add app/client/src/index.css app/client/src/components/Sidebar.tsx app/client/src/components/SearchPanel.tsx
git commit -m "feat: add icon sidebar with tooltips, move theme toggle into sidebar"
```

---

## Task 3: Update `App.tsx` with view state and navigation

**Files:**
- Modify: `app/client/src/App.tsx`

- [ ] **Step 1: Replace `App.tsx` with the view-aware version**

```tsx
import { useState, useEffect } from "react";
import type { FacilityDetail } from "./types";
import SearchPanel from "./components/SearchPanel";
import ScoreCard from "./components/ScoreCard";
import Sidebar from "./components/Sidebar";
import DashboardPage from "./pages/DashboardPage";
import QueuePage from "./pages/QueuePage";
import { ANALYST_ID } from "./lib/analyst";
import { fetchFacilityDetail } from "./lib/api";

export type View = "desk" | "dashboard" | "queue";
export { ANALYST_ID };

export default function App() {
  const [view, setView] = useState<View>("desk");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<FacilityDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    setLoadingDetail(true);
    fetchFacilityDetail(selectedId)
      .then((data) => { setDetail(data); setLoadingDetail(false); })
      .catch(() => setLoadingDetail(false));
  }, [selectedId]);

  function navigateToFacility(id: string) {
    setSelectedId(id);
    setView("desk");
  }

  return (
    <div style={{
      display: "flex", height: "100vh", overflow: "hidden",
      background: "var(--fiq-bg)", color: "var(--fiq-text)",
      fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
    }}>
      <Sidebar view={view} onViewChange={setView} />

      {view === "desk" && (
        <>
          <div style={{
            width: 360, minWidth: 360, flexShrink: 0,
            borderRight: "1px solid var(--fiq-border)",
            display: "flex", flexDirection: "column", overflow: "hidden",
          }}>
            <SearchPanel onSelect={setSelectedId} selectedId={selectedId} />
          </div>
          <div style={{ flex: 1, overflowY: "auto", background: "var(--fiq-bg)" }}>
            {loadingDetail ? (
              <div style={{ padding: 32, color: "var(--fiq-text-faintest)", fontSize: 13 }}>Loading...</div>
            ) : detail ? (
              <ScoreCard detail={detail} analystId={ANALYST_ID} />
            ) : (
              <div style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", height: "100%", gap: 8,
                color: "var(--fiq-text-faintest)",
              }}>
                <div style={{ fontSize: 28 }}>⊞</div>
                <div style={{ fontSize: 12 }}>Select a facility to view its trust scorecard</div>
              </div>
            )}
          </div>
        </>
      )}

      {view === "dashboard" && (
        <div style={{ flex: 1, overflowY: "auto" }}>
          <DashboardPage analystId={ANALYST_ID} onNavigateToFacility={navigateToFacility} />
        </div>
      )}

      {view === "queue" && (
        <div style={{ flex: 1, overflowY: "auto" }}>
          <QueuePage analystId={ANALYST_ID} onNavigateToFacility={navigateToFacility} />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd app && npm run typecheck
```

Expected: errors only about missing `DashboardPage` and `QueuePage` modules — that's fine, they're created in the next tasks.

- [ ] **Step 3: Commit**

```bash
cd .. && git add app/client/src/App.tsx
git commit -m "feat: add view state and navigation shell to App"
```

---

## Task 4: DashboardPage

**Files:**
- Create: `app/client/src/pages/DashboardPage.tsx`

- [ ] **Step 1: Create the pages directory**

```bash
mkdir -p app/client/src/pages
```

- [ ] **Step 2: Create `app/client/src/pages/DashboardPage.tsx`**

```tsx
import { useMemo, useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer,
  PieChart, Pie, Tooltip,
} from "recharts";
import { DUMMY_LIST, DUMMY_DETAILS, allActedFacilityIds, latestLocalActions } from "../lib/dummy";
import { overallScore, scoreToInt, trustColor, trustLabel } from "../types";
import type { FacilityListItem } from "../types";

interface Props {
  analystId: string;
  onNavigateToFacility: (id: string) => void;
}

function useChartColors() {
  const [isDark, setIsDark] = useState(
    document.documentElement.getAttribute("data-theme") !== "light",
  );
  useEffect(() => {
    const obs = new MutationObserver(() => {
      setIsDark(document.documentElement.getAttribute("data-theme") !== "light");
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);
  return {
    high: isDark ? "#4ade80" : "#16a34a",
    med: isDark ? "#fbbf24" : "#b45309",
    low: isDark ? "#f87171" : "#dc2626",
    insuff: isDark ? "rgba(255,255,255,0.12)" : "rgba(15,23,42,0.1)",
  };
}

export default function DashboardPage({ analystId, onNavigateToFacility }: Props) {
  const colors = useChartColors();

  const stats = useMemo(() => {
    const facilityScores = DUMMY_LIST.map((f) => ({
      ...f,
      score: overallScore(DUMMY_DETAILS[f.facility_id]?.trust_signals ?? []),
    }));

    const buckets = [
      { label: "0–29", min: 0, max: 29 },
      { label: "30–39", min: 30, max: 39 },
      { label: "40–49", min: 40, max: 49 },
      { label: "50–59", min: 50, max: 59 },
      { label: "60–69", min: 60, max: 69 },
      { label: "70–79", min: 70, max: 79 },
      { label: "80–89", min: 80, max: 89 },
      { label: "90–100", min: 90, max: 100 },
    ];

    const distribution = buckets.map((b) => ({
      label: b.label,
      count: facilityScores.filter(
        (f) => f.score !== null && f.score >= b.min && f.score <= b.max,
      ).length,
      tier: b.max < 40 ? "low" : b.max < 70 ? "med" : "high",
    }));

    const allScoredDims = Object.values(DUMMY_DETAILS)
      .flatMap((d) => d.trust_signals)
      .filter((s) => s.confidence_tier !== "insufficient_data" && s.trust_score !== null)
      .map((s) => scoreToInt(s.trust_score) as number);
    const avgScore =
      allScoredDims.length
        ? Math.round(allScoredDims.reduce((a, b) => a + b, 0) / allScoredDims.length)
        : null;

    const dimensions = ["capability", "equipment", "procedure", "completeness"];
    const dimAvgs = dimensions.map((dim) => {
      const vals = Object.values(DUMMY_DETAILS)
        .flatMap((d) => d.trust_signals)
        .filter((s) => s.dimension === dim && s.confidence_tier !== "insufficient_data" && s.trust_score !== null)
        .map((s) => scoreToInt(s.trust_score) as number);
      return {
        dim,
        avg: vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null,
      };
    });

    const types = [
      ...new Set(DUMMY_LIST.map((f) => f.facility_type).filter(Boolean)),
    ] as string[];
    const typeBreakdown = types.map((t) => ({
      type: t,
      count: DUMMY_LIST.filter((f) => f.facility_type === t).length,
      contradictions: DUMMY_LIST.filter(
        (f) => f.facility_type === t && f.has_contradiction === 1,
      ).length,
    }));

    const scored = facilityScores
      .filter((f) => f.score !== null)
      .sort((a, b) => b.score! - a.score!);
    const top3 = scored.slice(0, 3);
    const bottom3 = [...scored].reverse().slice(0, 3);

    const actedIds = allActedFacilityIds(analystId);
    const shortlistedCount = actedIds.filter((id) =>
      latestLocalActions(id, analystId).some(
        (a) => a.action_type === "shortlist" && a.content === "added",
      ),
    ).length;
    const flaggedCount = actedIds.filter((id) =>
      latestLocalActions(id, analystId).some(
        (a) => a.action_type === "flag" && a.content === "flagged",
      ),
    ).length;

    const tierData = [
      { name: "High ≥70", value: facilityScores.filter((f) => f.score !== null && f.score >= 70).length, tier: "high" },
      { name: "Med 40–69", value: facilityScores.filter((f) => f.score !== null && f.score >= 40 && f.score < 70).length, tier: "med" },
      { name: "Low <40", value: facilityScores.filter((f) => f.score !== null && f.score < 40).length, tier: "low" },
      { name: "Insuff. data", value: facilityScores.filter((f) => f.score === null).length, tier: "insuff" },
    ];

    return {
      total: DUMMY_LIST.length,
      contradictionCount: DUMMY_LIST.filter((f) => f.has_contradiction === 1).length,
      avgScore,
      distribution,
      tierData,
      dimAvgs,
      typeBreakdown,
      top3,
      bottom3,
      shortlistedCount,
      flaggedCount,
    };
  }, [analystId]);

  const tierColor = (tier: string) =>
    tier === "high" ? colors.high : tier === "med" ? colors.med : tier === "low" ? colors.low : colors.insuff;

  const card: React.CSSProperties = {
    background: "var(--fiq-bg-surface)", border: "1px solid var(--fiq-border-md)",
    borderRadius: 8, padding: "14px 16px",
  };
  const sectionLabel: React.CSSProperties = {
    fontSize: 9, fontWeight: 700, color: "var(--fiq-text-code)",
    letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 14,
  };

  return (
    <div style={{ padding: "24px 28px" }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, marginBottom: 4, color: "var(--fiq-text)" }}>
          Overview
        </h1>
        <p style={{ fontSize: 10, color: "var(--fiq-text-subdued)", margin: 0, letterSpacing: "0.5px", textTransform: "uppercase" }}>
          India Healthcare Facility Trust · {stats.total} facilities · Extraction complete
        </p>
      </div>

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 16 }}>
        {[
          { label: "Facilities", value: stats.total, color: "var(--fiq-text)" },
          { label: "Avg Trust Score", value: stats.avgScore ?? "—", color: trustColor(stats.avgScore) },
          { label: "Contradictions", value: stats.contradictionCount, color: "#FF3621" },
          { label: "Shortlisted", value: stats.shortlistedCount, color: "#60a5fa" },
          { label: "Flagged", value: stats.flaggedCount, color: "var(--fiq-trust-med)" },
        ].map(({ label, value, color }) => (
          <div key={label} style={card}>
            <div style={{ fontSize: 8, fontWeight: 700, color: "var(--fiq-text-code)", letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 6 }}>
              {label}
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Row 1: Bar chart + Donut */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 12, marginBottom: 12 }}>
        {/* Score distribution */}
        <div style={card}>
          <div style={sectionLabel}>Score Distribution — All Facilities</div>
          <ResponsiveContainer width="100%" height={130}>
            <BarChart data={stats.distribution} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
              <XAxis dataKey="label" tick={{ fontSize: 8, fill: "var(--fiq-text-code)" as string }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 8, fill: "var(--fiq-text-code)" as string }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: "var(--fiq-bg-surface)", border: "1px solid var(--fiq-border-strong)", borderRadius: 4, fontSize: 10 }}
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
              />
              <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                {stats.distribution.map((entry, i) => (
                  <Cell key={i} fill={tierColor(entry.tier)} fillOpacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Trust tier donut */}
        <div style={card}>
          <div style={sectionLabel}>Trust Tier Breakdown</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <PieChart width={120} height={120}>
              <Pie
                data={stats.tierData}
                cx={55} cy={55}
                innerRadius={36} outerRadius={54}
                dataKey="value"
                startAngle={90} endAngle={-270}
                strokeWidth={0}
              >
                {stats.tierData.map((entry, i) => (
                  <Cell key={i} fill={tierColor(entry.tier)} />
                ))}
              </Pie>
            </PieChart>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {stats.tierData.map((t) => (
                <div key={t.name} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: tierColor(t.tier), flexShrink: 0 }} />
                  <span style={{ fontSize: 9, color: "var(--fiq-text-subdued)" }}>{t.name}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: tierColor(t.tier), marginLeft: 4 }}>{t.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Dimension averages + Facility type breakdown */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        {/* Dimension averages */}
        <div style={card}>
          <div style={sectionLabel}>Average Score by Dimension</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {stats.dimAvgs.map(({ dim, avg }) => (
              <div key={dim} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ fontSize: 9, color: "var(--fiq-text-subdued)", width: 84, textTransform: "uppercase", letterSpacing: "0.3px", flexShrink: 0 }}>
                  {dim}
                </div>
                <div style={{ flex: 1, height: 8, background: "var(--fiq-border)", borderRadius: 4, overflow: "hidden" }}>
                  {avg !== null && (
                    <div style={{ width: `${avg}%`, height: "100%", background: trustColor(avg), borderRadius: 4, transition: "width 0.4s ease" }} />
                  )}
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: avg !== null ? trustColor(avg) : "var(--fiq-text-faintest)", width: 30, textAlign: "right" }}>
                  {avg ?? "—"}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Facility type breakdown */}
        <div style={card}>
          <div style={sectionLabel}>Facilities by Type</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            {stats.typeBreakdown.map(({ type, count }) => (
              <div key={type} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ fontSize: 10, color: "var(--fiq-text-muted)", flex: 1 }}>{type}</div>
                <div style={{ width: 90, height: 5, background: "var(--fiq-border)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${(count / stats.total) * 100}%`, height: "100%", background: "#60a5fa", borderRadius: 3 }} />
                </div>
                <div style={{ fontSize: 10, color: "var(--fiq-text-subdued)", width: 16, textAlign: "right" }}>{count}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 9, fontWeight: 700, color: "var(--fiq-text-code)", letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 8 }}>
            Contradiction Rate by Type
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {stats.typeBreakdown.map(({ type, count, contradictions }) => (
              <div key={type} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ fontSize: 10, color: "var(--fiq-text-muted)", flex: 1 }}>{type}</div>
                <div style={{ width: 90, height: 5, background: "var(--fiq-border)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${(contradictions / count) * 100}%`, height: "100%", background: "#FF3621", borderRadius: 3, opacity: 0.7 }} />
                </div>
                <div style={{ fontSize: 9, color: contradictions > 0 ? "#FF3621" : "var(--fiq-text-faintest)", width: 28, textAlign: "right", fontWeight: contradictions > 0 ? 700 : 400 }}>
                  {contradictions}/{count}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top / Bottom facilities */}
      <div style={card}>
        <div style={sectionLabel}>Top & Bottom Facilities by Trust Score</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          {[
            { heading: "HIGHEST TRUST", facilities: stats.top3 },
            { heading: "LOWEST TRUST", facilities: stats.bottom3 },
          ].map(({ heading, facilities }) => (
            <div key={heading}>
              <div style={{ fontSize: 8, color: "var(--fiq-text-faintest)", marginBottom: 8, letterSpacing: "0.5px" }}>{heading}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {(facilities as (FacilityListItem & { score: number | null })[]).map((f) => (
                  <div
                    key={f.facility_id}
                    onClick={() => onNavigateToFacility(f.facility_id)}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "7px 10px", borderRadius: 5, cursor: "pointer",
                      border: "1px solid var(--fiq-border-md)",
                      background: "var(--fiq-bg-hover)",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: "var(--fiq-text)" }}>{f.facility_name}</div>
                      <div style={{ fontSize: 8, color: "var(--fiq-text-subdued)" }}>{f.state}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: trustColor(f.score) }}>{f.score ?? "—"}</div>
                      <div style={{ fontSize: 8, color: trustColor(f.score), fontWeight: 600 }}>{trustLabel(f.score)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

```bash
cd app && npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd .. && git add app/client/src/pages/DashboardPage.tsx
git commit -m "feat: add Dashboard page with KPIs, charts, and top/bottom facility lists"
```

---

## Task 5: QueuePage

**Files:**
- Create: `app/client/src/pages/QueuePage.tsx`

- [ ] **Step 1: Create `app/client/src/pages/QueuePage.tsx`**

```tsx
import { useState, useMemo } from "react";
import { DUMMY_LIST, DUMMY_DETAILS, allActedFacilityIds, latestLocalActions } from "../lib/dummy";
import { overallScore, trustColor } from "../types";
import type { FacilityListItem } from "../types";

interface QueueEntry {
  facility: FacilityListItem;
  score: number | null;
  note: string | null;
  hasContradiction: boolean;
}

interface Props {
  analystId: string;
  onNavigateToFacility: (id: string) => void;
}

type Tab = "flagged" | "shortlisted";

export default function QueuePage({ analystId, onNavigateToFacility }: Props) {
  const [tab, setTab] = useState<Tab>("flagged");

  const { flagged, shortlisted } = useMemo(() => {
    const actedIds = allActedFacilityIds(analystId);
    const flaggedList: QueueEntry[] = [];
    const shortlistedList: QueueEntry[] = [];

    for (const id of actedIds) {
      const facility = DUMMY_LIST.find((f) => f.facility_id === id);
      if (!facility) continue;
      const actions = latestLocalActions(id, analystId);
      const isFlagged = actions.some((a) => a.action_type === "flag" && a.content === "flagged");
      const isShortlisted = actions.some((a) => a.action_type === "shortlist" && a.content === "added");
      if (!isFlagged && !isShortlisted) continue;
      const note = actions.find((a) => a.action_type === "note")?.content ?? null;
      const score = overallScore(DUMMY_DETAILS[id]?.trust_signals ?? []);
      const entry: QueueEntry = { facility, score, note, hasContradiction: facility.has_contradiction === 1 };
      if (isFlagged) flaggedList.push(entry);
      if (isShortlisted) shortlistedList.push(entry);
    }

    return { flagged: flaggedList, shortlisted: shortlistedList };
  }, [analystId]);

  const tabItems = tab === "flagged" ? flagged : shortlisted;
  const emptyMessage =
    tab === "flagged"
      ? "No flagged facilities yet. Flag a facility from its scorecard."
      : "No shortlisted facilities yet. Add one from the workbench.";

  const tabBtn = (t: Tab, icon: string, label: string, count: number, activeColor: string): React.CSSProperties => ({
    padding: "9px 18px", fontSize: 11, fontWeight: 600, cursor: "pointer", border: "none",
    background: "transparent", borderBottom: `2px solid ${tab === t ? activeColor : "transparent"}`,
    color: tab === t ? "var(--fiq-text)" : "var(--fiq-text-subdued)",
    marginBottom: -1, display: "flex", alignItems: "center", gap: 6,
  });

  return (
    <div style={{ padding: "24px 28px" }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, marginBottom: 4, color: "var(--fiq-text)" }}>
          Review Queue
        </h1>
        <p style={{ fontSize: 10, color: "var(--fiq-text-subdued)", margin: 0, letterSpacing: "0.5px", textTransform: "uppercase" }}>
          Your flagged and shortlisted facilities
        </p>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--fiq-border)", marginBottom: 16 }}>
        <button onClick={() => setTab("flagged")} style={tabBtn("flagged", "⚑", "Flagged", flagged.length, "var(--fiq-trust-med)")}>
          <span>⚑ Flagged</span>
          <span style={{
            fontSize: 9, padding: "1px 6px", borderRadius: 8,
            background: tab === "flagged" ? "rgba(251,191,36,0.15)" : "var(--fiq-bg-input)",
            color: tab === "flagged" ? "var(--fiq-trust-med)" : "var(--fiq-text-faintest)",
            fontWeight: 700,
          }}>{flagged.length}</span>
        </button>
        <button onClick={() => setTab("shortlisted")} style={tabBtn("shortlisted", "★", "Shortlisted", shortlisted.length, "#60a5fa")}>
          <span>★ Shortlisted</span>
          <span style={{
            fontSize: 9, padding: "1px 6px", borderRadius: 8,
            background: tab === "shortlisted" ? "rgba(96,165,250,0.15)" : "var(--fiq-bg-input)",
            color: tab === "shortlisted" ? "#60a5fa" : "var(--fiq-text-faintest)",
            fontWeight: 700,
          }}>{shortlisted.length}</span>
        </button>
      </div>

      {/* List */}
      {tabItems.length === 0 ? (
        <div style={{
          padding: "48px 24px", textAlign: "center",
          color: "var(--fiq-text-faintest)", fontSize: 12,
          background: "var(--fiq-bg-surface)", borderRadius: 8,
          border: "1px solid var(--fiq-border-md)",
        }}>
          {emptyMessage}
        </div>
      ) : (
        <div style={{
          background: "var(--fiq-bg-surface)", border: "1px solid var(--fiq-border-md)",
          borderRadius: 8, overflow: "hidden",
        }}>
          {tabItems.map(({ facility, score, note, hasContradiction }, i) => (
            <div
              key={facility.facility_id}
              onClick={() => onNavigateToFacility(facility.facility_id)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 16px", cursor: "pointer",
                borderTop: i === 0 ? "none" : "1px solid var(--fiq-border)",
                transition: "background 0.12s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--fiq-bg-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--fiq-text)" }}>
                    {facility.facility_name}
                  </span>
                  {hasContradiction && (
                    <span style={{ fontSize: 9, color: "#FF3621", fontWeight: 700 }}>⚠</span>
                  )}
                </div>
                <div style={{ fontSize: 9, color: "var(--fiq-text-subdued)" }}>
                  {[facility.state, facility.facility_type].filter(Boolean).join(" · ")}
                </div>
                {note && (
                  <div style={{
                    fontSize: 10, color: "var(--fiq-text-faint)", fontStyle: "italic",
                    marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    maxWidth: 500,
                  }}>
                    "{note}"
                  </div>
                )}
              </div>
              <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 16 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: trustColor(score), lineHeight: 1 }}>
                  {score ?? "—"}
                </div>
                <div style={{ fontSize: 8, color: trustColor(score), fontWeight: 600, letterSpacing: "0.3px" }}>
                  {score !== null ? (score >= 70 ? "HIGH" : score >= 40 ? "MED" : "LOW") : "—"}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd app && npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd .. && git add app/client/src/pages/QueuePage.tsx
git commit -m "feat: add Queue page with flagged and shortlisted tabs"
```

---

## Task 6: Browser verification

- [ ] **Step 1: Start the dev server (kill any existing instance first)**

```bash
pkill -f "tsx watch.*server.ts" 2>/dev/null; sleep 1
cd app && npm run dev > /tmp/facilityiq-dev.log 2>&1 &
echo $! > /tmp/facilityiq.pid
```

Wait for it: `for i in $(seq 1 20); do curl -sf http://localhost:8000 >/dev/null 2>&1 && echo "ready" && break || sleep 1; done`

- [ ] **Step 2: Open the app and verify the sidebar**

Open `http://localhost:8000`. Confirm:
- Sidebar visible on the left (40 px, dark surface)
- Three icons: ⊞ ◫ ⚑
- Hovering each icon shows a tooltip label
- Theme toggle (☀/◑) is at the bottom of the sidebar, not in the search panel header
- Trust Desk works as before (click a facility, scorecard opens)

- [ ] **Step 3: Verify the Dashboard**

Click the ◫ icon. Confirm:
- Page title "Overview" with subtitle
- 5 KPI cards across the top (Facilities = 15, Contradictions = 5, etc.)
- Score distribution bar chart renders with colored bars
- Trust tier donut renders with legend
- Dimension averages show 4 bars (completeness should be lowest)
- Facility type breakdown shows Hospital / PHC / CHC
- Top 3 show NIMHANS / CMC / AIIMS; Bottom 3 show PHC Nanded / CHC Silchar / Govt. Hospital
- Clicking a facility row navigates to the Trust Desk with that facility open

- [ ] **Step 4: Verify the Queue (after adding actions on Trust Desk)**

Switch to Trust Desk. Open any facility. In the Workbench, click "★ Add to Shortlist" and "⚑ Flag for Review" on two different facilities. Then click the ⚑ Queue icon. Confirm:
- Flagged tab shows the flagged facility with its score and name
- Shortlisted tab shows the shortlisted facility
- Clicking a row navigates back to the Trust Desk with the correct facility open
- Empty state message appears when a tab has no items

- [ ] **Step 5: Verify light mode**

Click the ☀ button in the sidebar. Confirm all three pages render correctly in light mode — KPI values visible, chart bars visible, list text readable.

- [ ] **Step 6: Stop the server and commit**

```bash
pkill -f "tsx watch.*server.ts" 2>/dev/null
cd /Users/brett.plemons/Documents/Development/facilityiq && git add -A
git commit -m "feat: complete dashboard and queue pages with sidebar navigation"
```
