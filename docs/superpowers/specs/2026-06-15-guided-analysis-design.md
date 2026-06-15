# GuidedAnalysis — ScoreCard Redesign Spec

**Date:** 2026-06-15  
**Status:** Approved  
**Scope:** Replace `ScoreCard.tsx`, `TrustDimension.tsx`, and `ContradictionAlert.tsx` with a new `GuidedAnalysis.tsx` component that presents facility data as a rich annotated profile with AI evidence bubbles.

**Reference:** Figma make export at `~/Downloads/Revamp Facility Data UI/src/app/App.tsx` — adapt to FacilityDetail data model and dual dark/light theme.

---

## Design Summary

The current ScoreCard shows extracted trust scores as the primary content, with raw facility data hidden behind collapsible rows. The redesign inverts this: **raw facility data is primary**, and **AI evidence appears as floating chat bubbles** anchored to the specific phrases that were used as evidence. Users review and annotate the data directly; the AI analysis is a layer on top.

---

## Layout (top to bottom)

```
┌─ Facility name + location chips ─────────────── 83 OVERALL · HIGH ─┐
│                                                  ⚑ Flag for Review   │
├─ TRUST DIMENSIONS ─────────────────────────────────────────────────┤
│  [Capability 88/100 HIGH] [Equipment 82/100] [Procedure 79/100]     │
│  [Completeness NO DATA]                                              │
├─ Facility Data card ────────────────────── [◈ Show all evidence] ──┤
│  IDENTITY                                                            │
│    Facility Name  Apollo Hospitals          [✓ Verify] [✏ Edit]     │
│    Description    A level-1 trauma centre offering…  [✓] [✏]       │
│                   ↑ amber highlight — hover shows contradiction      │
│  CLINICAL                                                            │
│    Capability     Cardiac surgery, bone marrow…      [✓] [✏]       │
│                   ↑ indigo highlight — hover shows evidence bubble   │
│  CAPACITY / OPERATIONS …                                             │
├─ Analyst Workbench ─────────────────────────────────────────────────┤
│  [Notes + comment] [Override score + reason]                         │
│  [Flag for Review + reason — full width]                             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## File Changes

| File | Action |
|---|---|
| `app/client/src/components/GuidedAnalysis.tsx` | **Create** — main component, all sub-components |
| `app/client/src/components/ScoreCard.tsx` | **Delete** |
| `app/client/src/components/TrustDimension.tsx` | **Delete** |
| `app/client/src/components/ContradictionAlert.tsx` | **Delete** |
| `app/client/src/App.tsx` | **Modify** — import GuidedAnalysis instead of ScoreCard |

`Workbench.tsx` stays unchanged; it mounts below GuidedAnalysis.

---

## Component Architecture (all in `GuidedAnalysis.tsx`)

### Types (local to file)

```ts
type HighlightType = "evidence" | "contradiction" | "insufficient";

interface TextHighlight {
  match: string;      // substring to find in the field value
  type: HighlightType;
  bubble: string;     // rationale text shown in the bubble
  score?: number | null;
  dimension?: string;
}

interface FacilityField {
  label: string;
  value: string | null;
  category: "Identity" | "Clinical" | "Capacity" | "Operations";
  highlights?: TextHighlight[];
  missing?: boolean;   // true when value is null — renders "Not provided"
}
```

### `buildFields(detail: FacilityDetail): FacilityField[]`

Derives `FacilityField[]` from `FacilityDetail`. For each facility field, find trust_signals where `source_field` matches the field key and build `TextHighlight[]`:

| Field label | `facility.*` key | Matched by `source_field` |
|---|---|---|
| Facility Name | `facility_name` | — |
| City | `district` | — |
| State | `state` | — |
| Facility Type | `facility_type` | — |
| Description | `description` | any signal with `contradiction === true` (contradiction_detail shown) |
| Capability | `capability` | `"capability"` |
| Equipment | `equipment` | `"equipment"` |
| Procedure | `procedure` | `"procedure"` |
| Bed Capacity | `capacity` (toString) | `"capacity"` |
| Year Established | `year_established` (toString) | `"year_established"` |

For each matched signal:
- If `confidence_tier === "insufficient_data"`: type = `"insufficient"`, bubble = signal.evidence_text
- If `contradiction === true`: type = `"contradiction"`, bubble = signal.contradiction_detail
- Otherwise: type = `"evidence"`, bubble = signal.evidence_text, include score + dimension

The `match` string: try `signal.evidence_text` as a substring of the field value. If not found, use the full field value string.

Description field special case: if any signal has `contradiction === true`, show the contradiction bubble on the description field. The `match` string is derived by scanning the description for phrases mentioned in `contradiction_detail` (best-effort substring search); fall back to highlighting the whole description if no match found.

### `segmentText(text, highlights): Segment[]`

Port directly from Figma code. Splits text into `{kind:"plain",text}` and `{kind:"highlight",text,highlight}` segments sorted by position. Handles non-overlapping matches.

### `HighlightSpan`

Renders one highlighted inline span. Props: `{ hl: TextHighlight; spanRef: React.RefObject<HTMLSpanElement>; forceOpen: boolean }`.

- Highlight classes: indigo (`bg-indigo-100 text-indigo-900`) for evidence, amber (`bg-amber-100 text-amber-900`) for contradiction/insufficient
- Dotted underline in matching color
- On mouseenter/mouseleave: calls parent's `showBubble(id)` / `hideBubble(id)` 
- Registers a `ref` so the bubble system can find the span's position

### Bubble positioning (imperative, on `<body>`)

The bubble system is managed by a ref map and imperative DOM manipulation (not React state) to avoid re-render jank. Bubbles are `<div>` elements appended to `<body>` with `position: absolute` (body has `position: relative` via a CSS class added to body on mount, removed on unmount).

**Placement algorithm** (same as v7 mockup):
1. Get span's `getBoundingClientRect()` + `window.scrollY` for document coords
2. Try 6 candidate positions in order: above-center, above-left, above-right, below-center, below-left, below-right
3. Pick first that doesn't overlap previously placed bubbles (8px padding)
4. Set CSS triangle tail direction and horizontal offset to point at the highlighted span
5. Animate in with `pop` keyframe

**Hide**: wipe `style.cssText = ''` to clear all inline styles. Never toggle classes to show/hide — always clear inline styles.

**Show all**: iterate spans in DOM order, place each bubble avoiding previous placements.

### `ScoreBand` (trust dimension card)

```
┌──────────────────────────────┐
│ CAPABILITY    [HIGH] badge  ✏│
│ 88            / 100          │
│ ████████████░░░░ bar        │
└──────────────────────────────┘
```

- Edit icon (✏) appears top-right of each card. Clicking it opens the Score Override modal pre-filled with that dimension.
- Insufficient data variant shows `⊘ Score suppressed` instead of number + bar, and has **no edit icon** (cannot override a suppressed score).

### `FieldRow`

Flex row: narrow uppercase label (130px) + full-width value. Value renders plain text or `segmentText` segments with `HighlightSpan`. Verify/Edit micro-actions below value on each row. Missing fields render "Not provided" in muted italic.

### `CategorySection`

Label + horizontal divider line + list of `FieldRow`. Categories in order: Identity → Clinical → Capacity → Operations.

---

## Styling approach

Use **Tailwind** for layout, spacing, and typography. Use **CSS variables** (`var(--fiq-*)`) for theme-adaptive colors (backgrounds, borders, text) so dark/light mode works automatically.

Hardcoded where theme-invariant:
- Indigo evidence highlight: `bg-indigo-100 text-indigo-900` (light) / adapt with `dark:` variants
- Amber contradiction highlight: `bg-amber-100 text-amber-900` / adapt with `dark:` variants  
- Evidence bubble bg: `white` / dark: `var(--fiq-bg-surface)`
- Contradiction bubble bg: `#fffbeb` / dark: `#271e08`
- Trust tier score colors: use `trustColor(score)` which already returns `var(--fiq-trust-*)` vars

The dark mode selector in the existing app is `[data-theme="dark"]` on `<html>`. Add `dark` class to `<html>` when `data-theme="dark"` so Tailwind `dark:` variants fire. Do this in `main.tsx` alongside `initTheme()`.

---

## Modals

Two modals live in `GuidedAnalysis.tsx` (rendered via a React portal to `document.body`):

### Flag for Review modal
Triggered by the **⚑ Flag for Review** button in the facility header (top-right, next to the overall score). The button is always visible.

- Text area: "Reason for flagging" (required — submit disabled until non-empty)
- Cancel / Submit buttons
- On submit: calls `postAction(facilityId, analystId, "flag", reason)`, closes modal
- Styling: red accent border/button consistent with the flag theme

### Score override modal
Triggered by a **pencil icon** (✏) that appears on each `ScoreBand` card (except Insufficient Data cards — those show no edit icon). One modal handles all dimensions; the dimension name is pre-filled from which card was clicked.

- Dimension label (read-only, from clicked card)
- Number input: "New score (0–100)" (required, validated 0–100)
- Text area: "Reason for override" (required — submit disabled until both filled)
- Cancel / Submit buttons
- On submit: calls `postAction(facilityId, analystId, "override", reason, dimension, score)`, closes modal

---

## Analyst Workbench changes

`Workbench.tsx` is kept but simplified:
- **Remove** shortlist section entirely
- **Remove** Override section (moved to ScoreBand card modals above)
- **Remove** Flag for Review section (moved to header modal above)
- **Keep** Notes section only — no required comment, just a text area and Save Note button

---

## App.tsx change

Replace `import ScoreCard` with `import GuidedAnalysis` and update the JSX render call. `GuidedAnalysis` takes the same props: `{ detail: FacilityDetail; analystId: string }`.

---

## Out of scope

- Edit field functionality (UI only — edits call `postAction("note", ...)` with the edit comment; no write-back to the Delta table)
- Verify functionality (UI only — calls `postAction("note", "Verified: <field>")`)
- Persisting "show all evidence" preference
- Mobile/responsive layout
