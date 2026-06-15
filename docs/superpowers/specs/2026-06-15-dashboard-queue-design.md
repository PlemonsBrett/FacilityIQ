# FacilityIQ — Dashboard & Queue Design

**Date:** 2026-06-15  
**Status:** Approved  
**Scope:** Add a Summary Dashboard page and a Review Queue page to the existing React/AppKit app.

---

## Context

The app currently renders a single two-panel view: a facility search list on the left, a trust scorecard on the right. There is no routing and no way to see an overview of the dataset or the analyst's accumulated actions. This spec adds two new views and the navigation shell that connects all three.

---

## Navigation Shell

### Approach
A 40 px icon sidebar inserted to the left of the existing two-panel layout. No router — `App.tsx` holds a single `view` state (`"desk" | "dashboard" | "queue"`) and renders the appropriate view in the remaining space.

### Sidebar details
- **Width:** 40 px, `background: var(--fiq-bg-surface)`, `border-right: 1px solid var(--fiq-border)`
- **Icons (top to bottom):**
  - `⊞` — Trust Desk
  - `◫` — Dashboard
  - `⚑` — Queue
- **Active state:** `background: rgba(255,255,255,0.07)` highlight on the icon
- **Hover tooltip:** CSS-only popover label that appears to the right of the icon (same pattern as the brainstorm mockup)
- **Theme toggle:** moves from the SearchPanel header into the sidebar, at the bottom

### File changes
- `App.tsx` — add `view` state, render `<Sidebar>` + conditional view
- New file: `src/components/Sidebar.tsx`

---

## Dashboard Page

### Layout
Full-width single-column, `padding: 24px 28px`, scrollable.

```
┌─────────────────────────────────────────────────┐
│  "Overview"  sub: extraction summary             │
├──────┬──────┬──────┬──────┬──────────────────────┤
│ KPI  │ KPI  │ KPI  │ KPI  │ KPI                  │
├──────────────────────┬──────────────────────────┤
│  Score Distribution  │  Trust Tier Donut         │
│  (bar chart)         │  (pie chart + legend)     │
├──────────────────────┴──────────────────────────┤
│  Dimension Averages  │  Facility Type Breakdown  │
│  (horiz. bars)       │  + contradiction rate     │
├─────────────────────────────────────────────────┤
│  Top 3 / Bottom 3 facilities (side-by-side)      │
└─────────────────────────────────────────────────┘
```

### KPI cards (row of 5)
| Label | Value | Color |
|---|---|---|
| Facilities | total count | white |
| Avg Trust Score | mean of all scored dimensions | trust color |
| Contradictions | count of facilities with ≥1 contradiction | `#FF3621` |
| Shortlisted | analyst's shortlisted count | `#60a5fa` |
| Flagged | analyst's flagged count | `#fbbf24` |

### Charts (recharts)
1. **Score Distribution** — `BarChart`, 8 buckets (0–29, 30–39, …, 90–100), bars colored by trust tier (red/amber/green). X-axis: range label. Y-axis: facility count.
2. **Trust Tier Donut** — `PieChart` with `innerRadius`. Segments: High (≥70), Medium (40–69), Low (<40), Insufficient data only. Legend to the right.
3. **Dimension Averages** — horizontal bar rows (plain CSS, not recharts), one per dimension, colored by trust tier.
4. **Facility Type Breakdown** — horizontal bar rows (CSS), count per type + a second sub-section showing contradiction rate per type.

### Top/Bottom facilities
Two columns: "Highest Trust" (top 3) and "Lowest Trust" (bottom 3). Each row: facility name, state, score. Clicking a row sets `view = "desk"` and `selectedFacilityId` to that facility's ID, navigating directly to its scorecard.

### Data source
All data computed client-side from `DUMMY_LIST` and `DUMMY_DETAILS` (already in `dummy.ts`). No new API endpoints. When real Lakebase data is connected, the same `fetchFacilities` + `fetchFacilityDetail` calls feed the dashboard automatically.

### Files
- New file: `src/pages/DashboardPage.tsx`

---

## Queue Page

### Layout
Full-width, `padding: 24px 28px`.

```
┌─────────────────────────────────────────────┐
│  "Review Queue"  sub: your flagged/shortlisted│
├────────────────────┬────────────────────────┤
│ ⚑ Flagged  [2]    │ ★ Shortlisted  [3]      │  ← tab bar
├─────────────────────────────────────────────┤
│  (active tab list)                           │
│  ┌──────────────────────────────────────┐   │
│  │ Facility name          score  [badge]│   │
│  │ State · Type                         │   │
│  │ "Note text if present…"              │   │
│  └──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

### Tabs
- **⚑ Flagged** — facilities where the latest `flag` action has `content = "flagged"`
- **★ Shortlisted** — facilities where the latest `shortlist` action has `content = "added"`
- Count badge on each tab, styled with the matching action color

### List items
Each row shows:
- Facility name (bold)
- State · Type (muted)
- Trust score (right-aligned, trust color)
- Most recent note text, if any (italic, truncated to one line)
- ⚠ badge if the facility has a contradiction

Clicking a row: sets `view = "desk"` and `selectedFacilityId`, navigating to the Trust Desk with that facility open.

### Empty state
Each tab has its own empty state message:
- Flagged empty: *"No flagged facilities yet. Flag a facility from its scorecard."*
- Shortlisted empty: *"No shortlisted facilities yet. Add one from the workbench."*

### Data source
- Reads analyst actions from `latestLocalActions` (localStorage in dummy mode) across all facility IDs the analyst has touched
- Joins with `DUMMY_LIST` to get name/state/type/score for display
- When Lakebase is connected: a future `GET /api/analyst/:id/actions` endpoint replaces the localStorage scan

### Files
- New file: `src/pages/QueuePage.tsx`

---

## Shared prop: `onNavigateToFacility`

Both Dashboard and Queue need to navigate to a specific facility on the Trust Desk. `App.tsx` passes a callback:

```ts
(facilityId: string) => { setView("desk"); setSelectedId(facilityId); }
```

---

## Dummy data additions

The Queue needs to know which facility IDs the analyst has acted on. The current `latestLocalActions(facilityId, analystId)` requires a known `facilityId`. Add a helper to `dummy.ts`:

```ts
export function allActedFacilityIds(analystId: string): string[]
// Scans localStorage keys matching `fiq_actions_*_${analystId}` and returns the facility IDs
```

---

## Out of scope

- Multi-analyst views (all analysts' actions combined)
- Export / download queue
- Sorting or filtering within the Queue list (can be added later)
- State management library (useState in App.tsx is sufficient)
