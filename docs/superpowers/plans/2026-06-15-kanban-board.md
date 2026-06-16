# Kanban Review Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the QueuePage with a Jira-style Kanban board that lets analysts move facilities through a validation pipeline across six status columns.

**Architecture:** `KanbanPage.tsx` renders six fixed-width columns in a horizontally-scrolling board. Each column loads its cards via existing API routes (`/api/review/board/unstarted` for Not Started, `/api/review/board?status=X` for all others). Moving a card calls `POST /api/review/:facilityId` and applies an optimistic update immediately. Dummy data fallback via localStorage mirrors the existing action system. The `"queue"` view in `App.tsx` and `Sidebar.tsx` is renamed `"board"`.

**Tech Stack:** React 19, Tailwind (layout), CSS variables `--fiq-*` (colors), `createPortal` for the Parked reason modal. No new dependencies.

---

## File Map

| File | Action |
|---|---|
| `app/client/src/types.ts` | Modify — add `ReviewStatus` and `ReviewCard` types |
| `app/client/src/lib/dummy.ts` | Modify — add Kanban localStorage helpers |
| `app/client/src/lib/api.ts` | Modify — add `fetchBoardColumn` and `postReviewStatus` |
| `app/client/src/pages/KanbanPage.tsx` | Create — full Kanban board |
| `app/client/src/App.tsx` | Modify — rename `"queue"` view to `"board"`, swap `QueuePage` → `KanbanPage` |
| `app/client/src/components/Sidebar.tsx` | Modify — rename nav entry label to "Board" and view key to "board" |
| `app/client/src/pages/QueuePage.tsx` | Delete |

---

## Task 1: Add `ReviewStatus` + `ReviewCard` to `types.ts`

**Files:**
- Modify: `app/client/src/types.ts`

- [ ] **Step 1: Append to `app/client/src/types.ts`**

Read the file first, then add at the bottom:

```typescript
export type ReviewStatus =
  | "not_started"
  | "in_progress"
  | "email_sent"
  | "called"
  | "parked"
  | "validation_complete";

export interface ReviewCard {
  facility_id: string;
  facility_name: string;
  facility_type: string | null;
  state: string | null;
  status: ReviewStatus;
  parked_reason: string | null;
  assigned_to: string | null;
  notes: string | null;
  updated_by: string | null;
  updated_at: string;
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /Users/brett.plemons/Documents/Development/facilityiq/app && npm run typecheck 2>&1
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/brett.plemons/Documents/Development/facilityiq
git add app/client/src/types.ts
git commit -m "feat: add ReviewStatus and ReviewCard types"
```

---

## Task 2: Add Kanban localStorage helpers to `dummy.ts` + API methods to `api.ts`

**Files:**
- Modify: `app/client/src/lib/dummy.ts`
- Modify: `app/client/src/lib/api.ts`

- [ ] **Step 1: Append Kanban helpers to `app/client/src/lib/dummy.ts`**

Read the file first, then add at the very bottom:

```typescript
// ── Kanban board localStorage fallback ────────────────────────────────────────

import type { ReviewCard, ReviewStatus } from "../types";

const KANBAN_LS_KEY = "fiq_kanban";

interface LocalReviewEntry {
  status: string;
  parked_reason: string | null;
  notes: string | null;
  updated_at: string;
}

function getLocalKanbanBoard(): Record<string, LocalReviewEntry> {
  try {
    const raw = localStorage.getItem(KANBAN_LS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, LocalReviewEntry>) : {};
  } catch {
    return {};
  }
}

export function setLocalKanbanStatus(
  facilityId: string,
  status: string,
  parked_reason: string | null = null,
  notes: string | null = null,
): void {
  const board = getLocalKanbanBoard();
  board[facilityId] = { status, parked_reason, notes, updated_at: new Date().toISOString() };
  try {
    localStorage.setItem(KANBAN_LS_KEY, JSON.stringify(board));
  } catch {}
}

export function getLocalBoardColumn(status: string): ReviewCard[] {
  const board = getLocalKanbanBoard();
  return Object.entries(board)
    .filter(([, v]) => v.status === status)
    .map(([id, v]) => {
      const f = DUMMY_LIST.find((f) => f.facility_id === id);
      return {
        facility_id: id,
        facility_name: f?.facility_name ?? id,
        facility_type: f?.facility_type ?? null,
        state: f?.state ?? null,
        status: v.status as ReviewStatus,
        parked_reason: v.parked_reason,
        assigned_to: null,
        notes: v.notes,
        updated_by: null,
        updated_at: v.updated_at,
      };
    });
}

export function getLocalUnstartedFacilities(): ReviewCard[] {
  const board = getLocalKanbanBoard();
  const inBoard = new Set(Object.keys(board));
  return DUMMY_LIST.filter((f) => !inBoard.has(f.facility_id))
    .slice(0, 50)
    .map((f) => ({
      facility_id: f.facility_id,
      facility_name: f.facility_name,
      facility_type: f.facility_type,
      state: f.state,
      status: "not_started" as ReviewStatus,
      parked_reason: null,
      assigned_to: null,
      notes: null,
      updated_by: null,
      updated_at: new Date().toISOString(),
    }));
}
```

**Note on imports:** Read the existing imports at the top of `dummy.ts` (line 1) and add `ReviewCard, ReviewStatus` to the existing import from `"../types"`. It currently reads:

```typescript
import type { FacilityListItem, FacilityDetail, TrustSignal, UserAction } from "../types";
```

Change it to:

```typescript
import type { FacilityListItem, FacilityDetail, TrustSignal, UserAction, ReviewCard, ReviewStatus } from "../types";
```

Then append the helper functions (without the import line) at the bottom of the file.

- [ ] **Step 2: Add `fetchBoardColumn` and `postReviewStatus` to `app/client/src/api.ts`**

Read the file first. Add to the import from `"./dummy"`:

```typescript
// Add to the existing import from "./dummy":
import {
  filterDummyList,
  DUMMY_DETAILS,
  DUMMY_META,
  latestLocalActions,
  saveLocalAction,
  getLocalBoardColumn,
  setLocalKanbanStatus,
  getLocalUnstartedFacilities,
} from "./dummy";
```

Then add to the import from `"../types"`:

```typescript
// Add ReviewCard, ReviewStatus to the existing types import:
import type { FacilityListItem, FacilityDetail, UserAction, ReviewCard, ReviewStatus } from "../types";
```

Then append at the bottom of `api.ts`:

```typescript
export async function fetchBoardColumn(status: ReviewStatus): Promise<ReviewCard[]> {
  if (status === "not_started") {
    const result = await tryFetch<ReviewCard[]>("/api/review/board/unstarted?limit=50");
    if (result !== null) return result;
    return getLocalUnstartedFacilities();
  }
  const result = await tryFetch<ReviewCard[]>(`/api/review/board?status=${status}&limit=200`);
  if (result !== null) return result;
  return getLocalBoardColumn(status);
}

export async function postReviewStatus(
  facilityId: string,
  status: ReviewStatus,
  parked_reason: string | null = null,
  notes: string | null = null,
): Promise<void> {
  const result = await tryFetch<ReviewCard>(`/api/review/${facilityId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, parked_reason, notes }),
  });
  if (result === null) {
    setLocalKanbanStatus(facilityId, status, parked_reason, notes);
  }
}
```

- [ ] **Step 3: Typecheck**

```bash
cd /Users/brett.plemons/Documents/Development/facilityiq/app && npm run typecheck 2>&1
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/brett.plemons/Documents/Development/facilityiq
git add app/client/src/lib/dummy.ts app/client/src/lib/api.ts
git commit -m "feat: add Kanban board localStorage helpers and API methods"
```

---

## Task 3: Create `KanbanPage.tsx`

**Files:**
- Create: `app/client/src/pages/KanbanPage.tsx`

- [ ] **Step 1: Create the file**

```tsx
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import type { ReviewCard, ReviewStatus } from "../types";
import { scoreToInt, trustColor } from "../types";
import { DUMMY_LIST } from "../lib/dummy";
import { fetchBoardColumn, postReviewStatus } from "../lib/api";

// ── Column config ─────────────────────────────────────────────────────────────

const COLUMNS: { status: ReviewStatus; label: string; accent: string }[] = [
  { status: "not_started",         label: "Not Started", accent: "#94a3b8" },
  { status: "in_progress",         label: "In Review",   accent: "#60a5fa" },
  { status: "email_sent",          label: "Email Sent",  accent: "#a78bfa" },
  { status: "called",              label: "Called",      accent: "#fb923c" },
  { status: "parked",              label: "Parked",      accent: "#64748b" },
  { status: "validation_complete", label: "Validated",   accent: "#4ade80" },
];

// ── KanbanCard ────────────────────────────────────────────────────────────────

function KanbanCard({
  card,
  onMove,
  onNavigate,
}: {
  card: ReviewCard;
  onMove: (card: ReviewCard, to: ReviewStatus) => void;
  onNavigate: (id: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const listItem = DUMMY_LIST.find((f) => f.facility_id === card.facility_id);
  const score = listItem ? scoreToInt(listItem.overall_trust_score) : null;

  return (
    <div
      className="rounded-xl p-3 group"
      style={{
        background: "var(--fiq-bg)",
        border: "1px solid var(--fiq-border)",
        cursor: "pointer",
      }}
      onClick={() => !menuOpen && onNavigate(card.facility_id)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div
            className="text-sm font-semibold leading-snug"
            style={{ color: "var(--fiq-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          >
            {card.facility_name}
          </div>
          <div className="text-[10px] mt-0.5" style={{ color: "var(--fiq-text-subdued)" }}>
            {[card.state, card.facility_type].filter(Boolean).join(" · ")}
          </div>
          {card.parked_reason && (
            <div className="text-[10px] mt-1 italic" style={{ color: "var(--fiq-text-faintest)" }}>
              {card.parked_reason}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {score !== null && (
            <span className="text-[10px] font-bold" style={{ color: trustColor(score) }}>
              {score}
            </span>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }}
            className="opacity-0 group-hover:opacity-100 transition-opacity rounded text-[11px] px-1"
            style={{ color: "var(--fiq-text-faintest)", background: "var(--fiq-bg-input)" }}
          >
            ···
          </button>
        </div>
      </div>

      {menuOpen && (
        <div
          className="mt-2 rounded-lg overflow-hidden"
          style={{ border: "1px solid var(--fiq-border)", background: "var(--fiq-bg-surface)" }}
          onClick={(e) => e.stopPropagation()}
        >
          {COLUMNS.filter((c) => c.status !== card.status).map((c) => (
            <button
              key={c.status}
              onClick={() => { setMenuOpen(false); onMove(card, c.status); }}
              className="w-full text-left flex items-center gap-2 px-3 py-1.5 text-[10px] transition-opacity hover:opacity-70"
              style={{ color: "var(--fiq-text-muted)" }}
            >
              <span style={{ color: c.accent }}>●</span>
              {c.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── KanbanColumn ──────────────────────────────────────────────────────────────

function KanbanColumn({
  label,
  accent,
  cards,
  onMove,
  onNavigate,
}: {
  status: ReviewStatus;
  label: string;
  accent: string;
  cards: ReviewCard[];
  onMove: (card: ReviewCard, to: ReviewStatus) => void;
  onNavigate: (id: string) => void;
}) {
  return (
    <div
      className="flex flex-col flex-shrink-0 rounded-xl overflow-hidden"
      style={{
        width: 260,
        background: "var(--fiq-bg-surface)",
        border: "1px solid var(--fiq-border)",
      }}
    >
      <div
        className="flex items-center justify-between px-3 py-2.5 flex-shrink-0"
        style={{ borderBottom: "1px solid var(--fiq-border)", borderLeft: `3px solid ${accent}` }}
      >
        <span className="text-[11px] font-semibold" style={{ color: "var(--fiq-text)" }}>
          {label}
        </span>
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{ background: `${accent}22`, color: accent }}
        >
          {cards.length}
        </span>
      </div>

      <div
        className="flex flex-col gap-2 p-2 overflow-y-auto"
        style={{ maxHeight: "calc(100vh - 170px)" }}
      >
        {cards.length === 0 ? (
          <div
            className="text-[10px] text-center py-6"
            style={{ color: "var(--fiq-text-faintest)" }}
          >
            No facilities
          </div>
        ) : (
          cards.map((card) => (
            <KanbanCard key={card.facility_id} card={card} onMove={onMove} onNavigate={onNavigate} />
          ))
        )}
      </div>
    </div>
  );
}

// ── ParkedReasonModal ─────────────────────────────────────────────────────────

function ParkedReasonModal({
  facilityName,
  onConfirm,
  onCancel,
}: {
  facilityName: string;
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
        <h3 className="font-semibold text-sm mb-1" style={{ color: "var(--fiq-text)" }}>
          Park Facility
        </h3>
        <p className="text-xs mb-4" style={{ color: "var(--fiq-text-faintest)" }}>
          {facilityName}
        </p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason for parking (required)"
          rows={3}
          className="w-full rounded-lg px-3 py-2 text-sm resize-none outline-none mb-4"
          style={{
            background: "var(--fiq-bg-input)",
            border: "1px solid var(--fiq-border-strong)",
            color: "var(--fiq-text)",
          }}
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

// ── KanbanPage ────────────────────────────────────────────────────────────────

interface Props {
  onNavigateToFacility: (id: string) => void;
}

export default function KanbanPage({ onNavigateToFacility }: Props) {
  const [columns, setColumns] = useState<Record<ReviewStatus, ReviewCard[]>>(() => {
    const empty = {} as Record<ReviewStatus, ReviewCard[]>;
    COLUMNS.forEach((c) => { empty[c.status] = []; });
    return empty;
  });
  const [loading, setLoading] = useState(true);
  const [parkingCard, setParkingCard] = useState<ReviewCard | null>(null);

  useEffect(() => {
    Promise.all(COLUMNS.map((c) => fetchBoardColumn(c.status))).then((results) => {
      const map = {} as Record<ReviewStatus, ReviewCard[]>;
      COLUMNS.forEach((col, i) => { map[col.status] = results[i]; });
      setColumns(map);
      setLoading(false);
    });
  }, []);

  async function handleMove(card: ReviewCard, toStatus: ReviewStatus) {
    if (toStatus === "parked") {
      setParkingCard(card);
      return;
    }
    await doMove(card, toStatus, null);
  }

  async function doMove(card: ReviewCard, toStatus: ReviewStatus, parkedReason: string | null) {
    setColumns((prev) => {
      const next = { ...prev };
      next[card.status] = (next[card.status] ?? []).filter(
        (c) => c.facility_id !== card.facility_id,
      );
      const moved: ReviewCard = {
        ...card,
        status: toStatus,
        parked_reason: parkedReason,
        updated_at: new Date().toISOString(),
      };
      next[toStatus] = [moved, ...(next[toStatus] ?? [])];
      return next;
    });
    await postReviewStatus(card.facility_id, toStatus, parkedReason);
  }

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div
        className="flex-shrink-0 px-6 py-4"
        style={{ borderBottom: "1px solid var(--fiq-border)" }}
      >
        <h1 className="text-xl font-bold" style={{ color: "var(--fiq-text)" }}>
          Review Board
        </h1>
        <p
          className="text-[10px] mt-0.5 uppercase tracking-wide"
          style={{ color: "var(--fiq-text-subdued)" }}
        >
          Facility validation pipeline
        </p>
      </div>

      {/* Board */}
      {loading ? (
        <div
          className="flex-1 flex items-center justify-center text-sm"
          style={{ color: "var(--fiq-text-faintest)" }}
        >
          Loading board…
        </div>
      ) : (
        <div
          className="flex-1 overflow-x-auto overflow-y-hidden px-6 py-4"
          style={{ display: "flex", gap: 12, alignItems: "flex-start" }}
        >
          {COLUMNS.map((col) => (
            <KanbanColumn
              key={col.status}
              status={col.status}
              label={col.label}
              accent={col.accent}
              cards={columns[col.status] ?? []}
              onMove={handleMove}
              onNavigate={onNavigateToFacility}
            />
          ))}
        </div>
      )}

      {parkingCard && (
        <ParkedReasonModal
          facilityName={parkingCard.facility_name}
          onConfirm={(reason) => {
            doMove(parkingCard, "parked", reason);
            setParkingCard(null);
          }}
          onCancel={() => setParkingCard(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /Users/brett.plemons/Documents/Development/facilityiq/app && npm run typecheck 2>&1
```
Expected: errors about `QueuePage` still being imported in `App.tsx` are fine — fixed next task. No other errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/brett.plemons/Documents/Development/facilityiq
git add app/client/src/pages/KanbanPage.tsx
git commit -m "feat: add KanbanPage with six-column review board"
```

---

## Task 4: Wire KanbanPage into App + update Sidebar + delete QueuePage

**Files:**
- Modify: `app/client/src/App.tsx`
- Modify: `app/client/src/components/Sidebar.tsx`
- Delete: `app/client/src/pages/QueuePage.tsx`

- [ ] **Step 1: Update `App.tsx`**

Read the file. Make these changes:

```tsx
// 1. Replace import:
// REMOVE: import QueuePage from "./pages/QueuePage";
// ADD:
import KanbanPage from "./pages/KanbanPage";

// 2. Change the View type:
// REMOVE: export type View = "desk" | "dashboard" | "queue";
// ADD:
export type View = "desk" | "dashboard" | "board";

// 3. Replace the queue render block:
// REMOVE:
//   {view === "queue" && (
//     <div style={{ flex: 1, overflowY: "auto" }}>
//       <QueuePage analystId={ANALYST_ID} onNavigateToFacility={navigateToFacility} />
//     </div>
//   )}
// ADD:
//   {view === "board" && (
//     <div style={{ flex: 1, overflow: "hidden" }}>
//       <KanbanPage onNavigateToFacility={navigateToFacility} />
//     </div>
//   )}
```

The board needs `overflow: "hidden"` (not `overflowY: "auto"`) because `KanbanPage` manages its own scroll axes (horizontal for columns, vertical within each column).

- [ ] **Step 2: Update `Sidebar.tsx`**

Read the file. Change the NAV array entry for queue:

```tsx
// REMOVE:
//   { view: "queue", icon: "⚑", label: "Queue" },
// ADD:
  { view: "board", icon: "⊟", label: "Board" },
```

The `⊟` icon visually suggests a board/grid. `view: View` is imported from `../App` so the type change in Step 1 ensures TypeScript accepts `"board"` here.

- [ ] **Step 3: Delete QueuePage**

```bash
rm /Users/brett.plemons/Documents/Development/facilityiq/app/client/src/pages/QueuePage.tsx
```

- [ ] **Step 4: Typecheck — must be clean**

```bash
cd /Users/brett.plemons/Documents/Development/facilityiq/app && npm run typecheck 2>&1
```
Expected: no errors. Fix any before committing.

- [ ] **Step 5: Commit**

```bash
cd /Users/brett.plemons/Documents/Development/facilityiq
git add app/client/src/App.tsx app/client/src/components/Sidebar.tsx
git rm app/client/src/pages/QueuePage.tsx
git commit -m "feat: wire KanbanPage into app, rename queue→board nav, remove QueuePage"
```

---

## Task 5: Browser verification

- [ ] **Step 1: Start dev server**

```bash
pkill -f "tsx watch.*server.ts" 2>/dev/null; sleep 1
cd /Users/brett.plemons/Documents/Development/facilityiq/app && npm run dev > /tmp/fiq.log 2>&1 &
for i in $(seq 1 20); do curl -sf http://localhost:8000 >/dev/null 2>&1 && echo "ready" && break || sleep 1; done
```

- [ ] **Step 2: Open and verify**

Open `http://localhost:8000`. Confirm:

1. Sidebar shows ⊟ Board icon (third from top); hovering shows "Board" tooltip
2. Click ⊟ → board renders with 6 columns: Not Started, In Review, Email Sent, Called, Parked, Validated
3. Not Started column shows up to 50 dummy facilities as cards
4. Each card shows facility name, state · type, and trust score (colored)
5. Hovering a card shows the `···` button
6. Click `···` → dropdown shows the other 5 statuses
7. Click a status → card moves to that column (optimistic update, no page reload)
8. Click "Parked" from the dropdown → modal appears requiring a reason; Cancel closes it; entering reason and clicking Park moves the card
9. Click a card body (not `···`) → navigates to Trust Desk with that facility open
10. Reload page → moved cards are still in their correct columns (localStorage persisted)

- [ ] **Step 3: Stop server**

```bash
pkill -f "tsx watch.*server.ts" 2>/dev/null
```

- [ ] **Step 4: Commit if any stray changes**

```bash
cd /Users/brett.plemons/Documents/Development/facilityiq && git status
```

If clean, nothing to do. If there are unstaged fixes:
```bash
git add -A && git commit -m "fix: board view post-verification adjustments"
```
