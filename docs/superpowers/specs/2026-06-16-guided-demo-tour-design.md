# Guided Demo Tour — Design Spec

**Date:** 2026-06-16  
**Branch:** feature/guided-demo-tour  
**Status:** Approved

---

## 1. Overview

Integrate React Joyride to give judges a guided walkthrough of FacilityIQ. The tour covers all four judging criteria through natural storytelling (no explicit labels). It auto-starts after the splash screen on first load and can be replayed via a "Start Tour" button in the sidebar. A hidden reset button in the sidebar restores the full splash → tour experience for each new judge.

---

## 2. Architecture

### Component location
`Joyride` lives in `App.tsx` — the only component that already owns `view`, `setView`, and `setSelectedId`, which the callback needs to drive navigation.

### State added to `App`
```ts
const [tourRun, setTourRun] = useState(false);
const [tourStepIndex, setTourStepIndex] = useState(0);
```

### Splash → tour sequencing
`Root` (main.tsx) manages both splash and a `splashDone` flag:
- If `?splash=on` in URL: `splashDone` starts `false`, set to `true` when splash `onComplete` fires
- Otherwise: `splashDone` starts `true` (tour fires immediately on mount)

`App` receives `splashDone` as a prop. Auto-start fires once `splashDone` becomes true:
```ts
useEffect(() => {
  if (!splashDone) return;
  if (!localStorage.getItem("fiq_tour_seen")) setTourRun(true);
}, [splashDone]);
```

### Callback logic
```ts
function handleTourCallback({ action, index, type }) {
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
    localStorage.setItem("fiq_tour_seen", "1");
  }
}
```

`selectFirstFacility()` reads the first facility ID from the current search results and calls `setSelectedId()`.

### Step definitions file
`app/client/src/lib/tour.ts` — exports `TOUR_STEPS: Step[]`. Each step has a `meta` field (not part of Joyride's API, passed through via the step object) indicating view to navigate to and whether to auto-select the first facility.

---

## 3. Tour Steps

| # | Target | View | Title | Content |
|---|---|---|---|---|
| 1 | *(center, no target)* | — | **FacilityIQ** | "An LLM-powered trust desk for 10,000 India healthcare facilities — built on Databricks. Let's walk through how it works." |
| 2 | `[data-tour="dashboard-kpis"]` | → dashboard | **The scale** | "10,000 healthcare facilities processed in a single Databricks batch. One LLM call per facility extracts four trust dimensions simultaneously and writes results to Delta Lake." |
| 3 | `[data-tour="score-distribution"]` | dashboard | **Honest scoring** | "Every facility gets a trust score per dimension. Fields with low coverage — like capacity at 25% — are never scored. We surface 'Insufficient Data' rather than manufacture false confidence." |
| 4 | `[data-tour="search-bar"]` | → desk | **Finding what matters** | "Search across all 10,000 facilities by name, description, or clinical capability — with filters for state, type, and trust tier." |
| 5 | `[data-tour="search-filters"]` | desk | **The contradiction filter** | "This filter surfaces facilities where the LLM detected a conflict between structured fields and free text — the highest-priority cases for human review." |
| 6 | `[data-tour="trust-scorecard"]` | desk + auto-select | **Trust scorecard** | "Each facility shows scores across capability, equipment, procedure, and completeness — with a confidence tier on each that tells you exactly how much weight to place on it." |
| 7 | `[data-tour="evidence-panel"]` | desk | **Grounded in evidence** | "Every score links back to an exact quote from the source text, highlighted in context. If the text doesn't support a claim, the system says so — no inferences." |
| 8 | `[data-tour="workbench"]` | desk | **Analyst actions** | "Shortlist high-trust facilities, flag contradictions for follow-up, leave notes for teammates, or override a score with a reason — all persisted instantly." |
| 9 | `[data-tour="kanban-board"]` | → board | **The review pipeline** | "A full workflow tracks each facility from first look through email outreach, calls, and final validation — giving the whole team a shared view of 10,000 facilities." |

---

## 4. `data-tour` Attributes

| Attribute | Component | Element |
|---|---|---|
| `data-tour="dashboard-kpis"` | `DashboardPage` | KPI row `<div>` |
| `data-tour="score-distribution"` | `DashboardPage` | Score distribution card |
| `data-tour="search-bar"` | `SearchPanel` | Search `<input>` |
| `data-tour="search-filters"` | `SearchPanel` | Filters row `<div>` |
| `data-tour="trust-scorecard"` | `GuidedAnalysis` | Overall score section |
| `data-tour="evidence-panel"` | `GuidedAnalysis` | Evidence/fields section |
| `data-tour="workbench"` | `Workbench` | Root `<div>` |
| `data-tour="kanban-board"` | `KanbanPage` | Board container `<div>` |

---

## 5. Trigger & Reset

**Auto-start:** fires once per browser session, after splash completes, if `fiq_tour_seen` is absent from localStorage.

**"Start Tour" button:** visible button in `Sidebar`, resets `stepIndex` to 0 and sets `tourRun = true`.

**Hidden reset button:** small unlabeled icon at the very bottom of the sidebar (below theme toggle). Clicking it runs:
```ts
function resetDemo() {
  localStorage.removeItem("fiq_tour_seen");
  window.location.href = window.location.pathname + "?splash=on";
}
```
Restores the full splash → tour experience. Each new judge gets an identical run.

---

## 6. Styling

Use Joyride's `styles` prop to match FacilityIQ's CSS variables:
- Background: `var(--fiq-bg-surface)`
- Border: `var(--fiq-border-md)`
- Text: `var(--fiq-text)`
- Accent (beacon + progress): `#5FD3E3` (brand cyan)
- Overlay: semi-transparent dark, matching splash palette

---

## 7. Files Changed

| File | Change |
|---|---|
| `app/package.json` | Add `react-joyride` |
| `app/client/src/lib/tour.ts` | New — step definitions |
| `app/client/src/main.tsx` | Add `splashDone` flag, pass to `App` |
| `app/client/src/App.tsx` | Add Joyride, tour state, callback, `selectFirstFacility` |
| `app/client/src/components/Sidebar.tsx` | Add "Start Tour" button + hidden reset |
| `app/client/src/pages/DashboardPage.tsx` | Add `data-tour` attrs |
| `app/client/src/components/SearchPanel.tsx` | Add `data-tour` attrs |
| `app/client/src/components/GuidedAnalysis.tsx` | Add `data-tour` attrs |
| `app/client/src/components/Workbench.tsx` | Add `data-tour` attr |
| `app/client/src/pages/KanbanPage.tsx` | Add `data-tour` attr |
