# Guided Demo Tour Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate React Joyride for a 9-step guided demo tour that auto-starts after the splash screen, navigates between views, and can be replayed or fully reset (splash + tour) via sidebar controls.

**Architecture:** Single `Joyride` instance in `App.tsx` drives all tour state. The callback handles view navigation and facility auto-select. `main.tsx` gates tour auto-start until the splash `onComplete` fires. `data-tour` attributes on target elements decouple step targeting from component internals.

**Tech Stack:** `react-joyride` (new), React 19, TypeScript, existing CSS variables for styling.

---

## File Map

| File | Change |
|---|---|
| `app/client/src/lib/tour.ts` | NEW — 9 step definitions with `meta` for view/select |
| `app/client/src/main.tsx` | Add `splashDone` flag; pass to `App` |
| `app/client/src/App.tsx` | Joyride component, tour state, callback, `selectFirstFacility`, accept new props |
| `app/client/src/components/Sidebar.tsx` | "Start Tour" button + hidden reset button |
| `app/client/src/pages/DashboardPage.tsx` | `data-tour` on KPI row + score distribution card |
| `app/client/src/components/SearchPanel.tsx` | `data-tour` on search input wrapper + filters row; `onFirstFacilityId` prop |
| `app/client/src/components/GuidedAnalysis.tsx` | `data-tour` on facility header + evidence panel |
| `app/client/src/components/Workbench.tsx` | `data-tour` on root div |
| `app/client/src/pages/KanbanPage.tsx` | `data-tour` on columns container |

---

## Task 1: Install react-joyride

**Files:** `app/package.json`

- [ ] **Install the package**

```bash
cd /Users/brett.plemons/Documents/Development/facilityiq/app
npm install react-joyride
```

- [ ] **Verify it's in package.json**

```bash
grep '"react-joyride"' package.json
```
Expected: `"react-joyride": "^2.x.x"`

- [ ] **Commit**

```bash
git add app/package.json app/package-lock.json
git commit -m "feat: install react-joyride"
```

---

## Task 2: Add `data-tour` attributes

**Files:**
- Modify: `app/client/src/pages/DashboardPage.tsx`
- Modify: `app/client/src/components/SearchPanel.tsx`
- Modify: `app/client/src/components/GuidedAnalysis.tsx`
- Modify: `app/client/src/components/Workbench.tsx`
- Modify: `app/client/src/pages/KanbanPage.tsx`

- [ ] **DashboardPage.tsx — KPI row** (find `gridTemplateColumns: "repeat(5, 1fr)"`)

```tsx
// Before:
<div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 16 }}>

// After:
<div data-tour="dashboard-kpis" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 16 }}>
```

- [ ] **DashboardPage.tsx — score distribution card** (first `<div style={card}>` after `{/* Row 1 */}`)

```tsx
// Before:
        {/* Score distribution */}
        <div style={card}>
          <div style={sectionLabel}>Score Distribution — All Facilities</div>

// After:
        {/* Score distribution */}
        <div data-tour="score-distribution" style={card}>
          <div style={sectionLabel}>Score Distribution — All Facilities</div>
```

- [ ] **SearchPanel.tsx — search input wrapper** (line ~72, the `<div>` wrapping the `<input>`)

```tsx
// Before:
      <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--fiq-border)", flexShrink: 0 }}>
        <input

// After:
      <div data-tour="search-bar" style={{ padding: "10px 12px", borderBottom: "1px solid var(--fiq-border)", flexShrink: 0 }}>
        <input
```

- [ ] **SearchPanel.tsx — filters row** (line ~87, the `<div>` with `gap: 5, flexWrap: "wrap"`)

```tsx
// Before:
      <div style={{
        padding: "6px 12px", borderBottom: "1px solid var(--fiq-border)",
        display: "flex", gap: 5, flexWrap: "wrap", flexShrink: 0,
      }}>

// After:
      <div data-tour="search-filters" style={{
        padding: "6px 12px", borderBottom: "1px solid var(--fiq-border)",
        display: "flex", gap: 5, flexWrap: "wrap", flexShrink: 0,
      }}>
```

- [ ] **GuidedAnalysis.tsx — trust scorecard** (line ~865, the facility header div)

```tsx
// Before:
        {/* Facility header */}
        <div className="flex items-start justify-between gap-4">

// After:
        {/* Facility header */}
        <div data-tour="trust-scorecard" className="flex items-start justify-between gap-4">
```

- [ ] **GuidedAnalysis.tsx — evidence panel** (line ~956, the Facility Data card)

```tsx
// Before:
        {/* Facility data */}
        <div
          className="rounded-2xl p-6 flex flex-col gap-5"
          style={{ background: "var(--fiq-bg-surface)", border: "1px solid var(--fiq-border)" }}
        >

// After:
        {/* Facility data */}
        <div
          data-tour="evidence-panel"
          className="rounded-2xl p-6 flex flex-col gap-5"
          style={{ background: "var(--fiq-bg-surface)", border: "1px solid var(--fiq-border)" }}
        >
```

- [ ] **Workbench.tsx — root div** (line ~32)

```tsx
// Before:
    <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--fiq-border)" }}>

// After:
    <div data-tour="workbench" className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--fiq-border)" }}>
```

- [ ] **KanbanPage.tsx — columns container** (line ~367, inside the `else` branch of the `loading` check)

```tsx
// Before:
          <div
            className="flex-1 overflow-x-auto overflow-y-hidden px-6 py-4"
            style={{ display: "flex", gap: 12, alignItems: "flex-start" }}
          >

// After:
          <div
            data-tour="kanban-board"
            className="flex-1 overflow-x-auto overflow-y-hidden px-6 py-4"
            style={{ display: "flex", gap: 12, alignItems: "flex-start" }}
          >
```

- [ ] **Commit**

```bash
git add app/client/src/pages/DashboardPage.tsx \
        app/client/src/components/SearchPanel.tsx \
        app/client/src/components/GuidedAnalysis.tsx \
        app/client/src/components/Workbench.tsx \
        app/client/src/pages/KanbanPage.tsx
git commit -m "feat: add data-tour attributes for joyride step targets"
```

---

## Task 3: Create tour step definitions

**Files:**
- Create: `app/client/src/lib/tour.ts`

- [ ] **Create the file**

```typescript
// app/client/src/lib/tour.ts
import type { Step } from "react-joyride";

type AppView = "desk" | "dashboard" | "board";

export interface TourStep extends Step {
  meta?: {
    view?: AppView;
    selectFirst?: boolean;
  };
}

export const TOUR_STEPS: TourStep[] = [
  {
    target: "body",
    placement: "center",
    disableBeacon: true,
    title: "FacilityIQ",
    content:
      "An LLM-powered trust desk for 10,000 India healthcare facilities — built on Databricks. Let's walk through how it works.",
  },
  {
    target: '[data-tour="dashboard-kpis"]',
    placement: "bottom",
    disableBeacon: true,
    title: "The scale",
    content:
      "10,000 healthcare facilities processed in a single Databricks batch. One LLM call per facility extracts four trust dimensions simultaneously and writes results to Delta Lake.",
    meta: { view: "dashboard" },
  },
  {
    target: '[data-tour="score-distribution"]',
    placement: "right",
    disableBeacon: true,
    title: "Honest scoring",
    content:
      "Every facility gets a trust score per dimension. Fields with low coverage — like capacity at 25% — are never scored. We surface 'Insufficient Data' rather than manufacture false confidence.",
  },
  {
    target: '[data-tour="search-bar"]',
    placement: "right",
    disableBeacon: true,
    title: "Finding what matters",
    content:
      "Search across all 10,000 facilities by name, description, or clinical capability — with filters for state, type, and trust tier.",
    meta: { view: "desk" },
  },
  {
    target: '[data-tour="search-filters"]',
    placement: "right",
    disableBeacon: true,
    title: "The contradiction filter",
    content:
      "This filter surfaces facilities where the LLM detected a conflict between structured fields and free text — the highest-priority cases for human review.",
  },
  {
    target: '[data-tour="trust-scorecard"]',
    placement: "right",
    disableBeacon: true,
    title: "Trust scorecard",
    content:
      "Each facility shows scores across capability, equipment, procedure, and completeness — with a confidence tier on each that tells you exactly how much weight to place on it.",
    meta: { selectFirst: true },
  },
  {
    target: '[data-tour="evidence-panel"]',
    placement: "top",
    disableBeacon: true,
    title: "Grounded in evidence",
    content:
      "Every score links back to an exact quote from the source text, highlighted in context. If the text doesn't support a claim, the system says so — no inferences.",
  },
  {
    target: '[data-tour="workbench"]',
    placement: "top",
    disableBeacon: true,
    title: "Analyst actions",
    content:
      "Shortlist high-trust facilities, flag contradictions for follow-up, leave notes for teammates, or override a score with a reason — all persisted instantly.",
  },
  {
    target: '[data-tour="kanban-board"]',
    placement: "top",
    disableBeacon: true,
    title: "The review pipeline",
    content:
      "A full workflow tracks each facility from first look through email outreach, calls, and final validation — giving the whole team a shared view of 10,000 facilities.",
    meta: { view: "board" },
  },
];
```

- [ ] **Commit**

```bash
git add app/client/src/lib/tour.ts
git commit -m "feat: add tour step definitions"
```

---

## Task 4: Update main.tsx — splash/tour sequencing

**Files:**
- Modify: `app/client/src/main.tsx`

- [ ] **Replace the entire file**

```tsx
// app/client/src/main.tsx
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { ErrorBoundary } from './ErrorBoundary.tsx';
import SplashScreen from './components/SplashScreen.tsx';
import { initTheme } from './lib/theme.ts';

initTheme();

function Root() {
  const splashEnabled = new URLSearchParams(window.location.search).get('splash') === 'on';
  const [showSplash, setShowSplash] = useState(() => splashEnabled);
  const [splashDone, setSplashDone] = useState(() => !splashEnabled);

  function handleSplashComplete() {
    setShowSplash(false);
    setSplashDone(true);
  }

  return (
    <>
      <App splashDone={splashDone} />
      {showSplash && <SplashScreen onComplete={handleSplashComplete} />}
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <Root />
    </ErrorBoundary>
  </StrictMode>
);
```

- [ ] **Commit**

```bash
git add app/client/src/main.tsx
git commit -m "feat: pass splashDone flag from Root to App"
```

---

## Task 5: Update App.tsx — Joyride integration

**Files:**
- Modify: `app/client/src/App.tsx`
- Modify: `app/client/src/components/SearchPanel.tsx` (add `onFirstFacilityId` prop)

- [ ] **Add `onFirstFacilityId` prop to SearchPanel** (so App can learn the first loaded facility ID without lifting all list state)

In `SearchPanel.tsx`, update the `Props` interface and the `load` function:

```tsx
// Props interface — add:
interface Props {
  onSelect: (id: string) => void;
  selectedId: string | null;
  onFirstFacilityId?: (id: string | null) => void;  // add this
}

// In the component signature:
export default function SearchPanel({ onSelect, selectedId, onFirstFacilityId }: Props) {

// In the load function, after setFacilities(data):
    fetchFacilities({ q, page: pg, limit: LIMIT, state, facilityType, contradictionsOnly })
      .then((data) => {
        setFacilities(data);
        setLoading(false);
        if (pg === 1) onFirstFacilityId?.(data[0]?.facility_id ?? null);  // add this line
      })
      .catch(() => setLoading(false));
```

- [ ] **Replace App.tsx entirely**

```tsx
// app/client/src/App.tsx
import { useState, useEffect, useRef, useCallback } from "react";
import Joyride, { ACTIONS, EVENTS, type CallBackProps } from "react-joyride";
import type { FacilityDetail } from "./types";
import SearchPanel from "./components/SearchPanel";
import GuidedAnalysis from "./components/GuidedAnalysis";
import Sidebar from "./components/Sidebar";
import DashboardPage from "./pages/DashboardPage";
import KanbanPage from "./pages/KanbanPage";
import { ANALYST_ID } from "./lib/analyst";
import { fetchFacilityDetail } from "./lib/api";
import { TOUR_STEPS } from "./lib/tour";

export type View = "desk" | "dashboard" | "board";
export { ANALYST_ID };

const TOUR_KEY = "fiq_tour_seen";

interface Props {
  splashDone: boolean;
}

export default function App({ splashDone }: Props) {
  const [view, setView] = useState<View>("desk");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<FacilityDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Tour state
  const [tourRun, setTourRun] = useState(false);
  const [tourStepIndex, setTourStepIndex] = useState(0);
  const firstFacilityIdRef = useRef<string | null>(null);

  // Auto-start after splash
  useEffect(() => {
    if (!splashDone) return;
    if (!localStorage.getItem(TOUR_KEY)) {
      setTourRun(true);
    }
  }, [splashDone]);

  function startTour() {
    setTourStepIndex(0);
    setTourRun(true);
  }

  function resetDemo() {
    localStorage.removeItem(TOUR_KEY);
    window.location.href = window.location.pathname + "?splash=on";
  }

  const selectFirstFacility = useCallback(() => {
    const id = firstFacilityIdRef.current;
    if (id) setSelectedId(id);
  }, []);

  const handleTourCallback = useCallback(
    ({ action, index, type }: CallBackProps) => {
      if (type === EVENTS.STEP_BEFORE) {
        const step = TOUR_STEPS[index];
        if (step.meta?.view) setView(step.meta.view);
        if (step.meta?.selectFirst) selectFirstFacility();
      }
      if (type === EVENTS.STEP_AFTER && action !== ACTIONS.CLOSE) {
        setTourStepIndex(index + 1);
      }
      if (action === ACTIONS.CLOSE || type === EVENTS.TOUR_END) {
        setTourRun(false);
        localStorage.setItem(TOUR_KEY, "1");
      }
    },
    [selectFirstFacility],
  );

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
      <Joyride
        steps={TOUR_STEPS}
        run={tourRun}
        stepIndex={tourStepIndex}
        callback={handleTourCallback}
        continuous
        showSkipButton
        showProgress
        disableScrolling
        spotlightClicks={false}
        styles={{
          options: {
            primaryColor: "#5FD3E3",
            backgroundColor: "var(--fiq-bg-surface)",
            textColor: "var(--fiq-text)",
            arrowColor: "var(--fiq-bg-surface)",
            overlayColor: "rgba(6, 15, 18, 0.6)",
            zIndex: 10000,
          },
          tooltip: {
            borderRadius: 10,
            border: "1px solid var(--fiq-border-md)",
          },
          buttonNext: {
            backgroundColor: "#5FD3E3",
            color: "#0B2026",
            borderRadius: 6,
            fontWeight: 700,
          },
          buttonBack: {
            color: "var(--fiq-text-subdued)",
          },
          buttonSkip: {
            color: "var(--fiq-text-faintest)",
          },
        }}
      />

      <Sidebar view={view} onViewChange={setView} onStartTour={startTour} onResetDemo={resetDemo} />

      {view === "desk" && (
        <>
          <div style={{
            width: 360, minWidth: 360, flexShrink: 0,
            borderRight: "1px solid var(--fiq-border)",
            display: "flex", flexDirection: "column", overflow: "hidden",
          }}>
            <SearchPanel
              onSelect={setSelectedId}
              selectedId={selectedId}
              onFirstFacilityId={(id) => { firstFacilityIdRef.current = id; }}
            />
          </div>
          <div style={{ flex: 1, overflowY: "auto", background: "var(--fiq-bg)" }}>
            {loadingDetail ? (
              <div style={{ padding: 32, color: "var(--fiq-text-faintest)", fontSize: 13 }}>Loading...</div>
            ) : detail ? (
              <GuidedAnalysis detail={detail} analystId={ANALYST_ID} />
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

      {view === "board" && (
        <div style={{ flex: 1, overflow: "hidden" }}>
          <KanbanPage onNavigateToFacility={navigateToFacility} />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Commit**

```bash
git add app/client/src/App.tsx app/client/src/components/SearchPanel.tsx
git commit -m "feat: wire Joyride into App with tour state and splash gate"
```

---

## Task 6: Update Sidebar — Start Tour + hidden reset

**Files:**
- Modify: `app/client/src/components/Sidebar.tsx`

- [ ] **Replace the entire file**

```tsx
// app/client/src/components/Sidebar.tsx
import { useState } from "react";
import type { View } from "../App";
import { getTheme, toggleTheme } from "../lib/theme";

interface Props {
  view: View;
  onViewChange: (v: View) => void;
  onStartTour: () => void;
  onResetDemo: () => void;
}

const NAV: { view: View; icon: string; label: string }[] = [
  { view: "desk", icon: "⊞", label: "Trust Desk" },
  { view: "dashboard", icon: "◫", label: "Dashboard" },
  { view: "board", icon: "⊟", label: "Board" },
];

export default function Sidebar({ view, onViewChange, onStartTour, onResetDemo }: Props) {
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
    background: "rgba(15,23,42,0.92)", color: "#ffffff",
    fontSize: 10, padding: "3px 8px", borderRadius: 4,
    whiteSpace: "nowrap", pointerEvents: "none",
    border: "1px solid rgba(255,255,255,0.1)", zIndex: 50,
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

      {/* Start Tour button */}
      <button
        onClick={onStartTour}
        className="fiq-sidebar-btn"
        title="Start Tour"
        style={{ ...btnBase, color: "#5FD3E3", fontSize: 13 }}
      >
        ◎
        <span className="fiq-sidebar-tip" style={tip}>Start Tour</span>
      </button>

      {/* Theme toggle */}
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

      {/* Hidden reset — small dot, no tooltip, restores splash+tour for next judge */}
      <button
        onClick={onResetDemo}
        title=""
        aria-label="Reset demo"
        style={{
          ...btnBase,
          width: 6, height: 6,
          borderRadius: "50%",
          background: "var(--fiq-border)",
          marginBottom: 4,
          opacity: 0.3,
        }}
      />
    </div>
  );
}
```

- [ ] **Commit**

```bash
git add app/client/src/components/Sidebar.tsx
git commit -m "feat: add Start Tour button and hidden demo reset to Sidebar"
```

---

## Task 7: Smoke test

- [ ] **Build and open the app locally**

```bash
cd /Users/brett.plemons/Documents/Development/facilityiq/app
npm run dev
```

Open `http://localhost:5173/?splash=on` in a browser.

- [ ] **Verify splash + tour auto-start**
  - Splash gate screen appears (logo + Enter button)
  - Click Enter → 15-second animation plays
  - After animation, Joyride step 1 (FacilityIQ welcome, centered) appears
  - Click Next → view switches to dashboard, step 2 targets KPI row
  - Click Next → step 3 targets score distribution chart
  - Click Next → view switches to desk, step 4 targets search bar
  - Click Next → step 5 targets filters row
  - Click Next → a facility auto-selects, step 6 targets the trust scorecard
  - Click Next → step 7 targets evidence panel
  - Click Next → step 8 targets workbench
  - Click Next → view switches to board, step 9 targets the kanban columns
  - Click Finish → tour ends, `fiq_tour_seen` written to localStorage

- [ ] **Verify "Start Tour" button**
  - Reload page without `?splash=on` — no splash, no auto-tour (key is set)
  - Click the `◎` button in the sidebar → tour starts from step 1

- [ ] **Verify hidden reset**
  - Click the small dot at the bottom of the sidebar
  - Page reloads to `?splash=on`
  - Splash plays, then tour auto-starts (localStorage was cleared)

- [ ] **Fix any step targeting issues**

If a step tooltip appears at the wrong position or says "target not found", it's because the view switch + render hasn't completed before Joyride scans the DOM. Add a delay in the callback for affected steps:

```tsx
// In handleTourCallback, inside the STEP_BEFORE branch:
if (step.meta?.view) {
  setView(step.meta.view);
  // Give React a tick to render the new view before Joyride positions the tooltip
  setTimeout(() => {}, 50);
}
```

If steps 6-8 (desk with selected facility) have targeting issues because the facility hasn't loaded yet, increase the delay for `selectFirst` steps:

```tsx
if (step.meta?.selectFirst) {
  selectFirstFacility();
  // Facility detail fetch takes ~200ms; pause before Joyride tries to find the target
}
```

To add a step-level delay in Joyride, use the `spotlightClicks` or wrap `selectFirstFacility` in a brief timeout and defer `setTourStepIndex` until after the fetch. The simplest fix: after calling `selectFirstFacility()`, don't advance to that step — instead wait for `detail` to be set. Use a `useEffect` that advances the step index when `detail` arrives:

```tsx
// In App.tsx — add a ref to track if we're waiting for a facility load for tour
const tourWaitingForFacility = useRef(false);

// In handleTourCallback STEP_BEFORE:
if (step.meta?.selectFirst) {
  tourWaitingForFacility.current = true;
  selectFirstFacility();
  return; // don't advance yet
}

// New useEffect — advance tour step once facility detail loads:
useEffect(() => {
  if (tourWaitingForFacility.current && detail) {
    tourWaitingForFacility.current = false;
    setTourStepIndex((i) => i); // trigger re-render so Joyride finds the element
  }
}, [detail]);
```

- [ ] **Final commit**

```bash
git add -A
git commit -m "feat: guided demo tour — splash sequencing, 9-step joyride, sidebar controls"
```
