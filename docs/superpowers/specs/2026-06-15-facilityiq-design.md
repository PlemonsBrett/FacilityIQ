# FacilityIQ — Design Spec

**Date:** 2026-06-15  
**Hackathon:** Databricks Data + AI Summit 2026 (June 15–16)  
**Status:** Approved

---

## Decisions Made

| Decision | Choice |
|---|---|
| App framework | AppKit (TypeScript + React + shadcn/ui + Tailwind) |
| Deployment | Databricks Asset Bundles (DABs) — full IaC |
| Data read layer | Lakebase Synced Tables (Delta → Postgres) |
| Analyst actions storage | Lakebase Postgres (app-owned) |
| UI layout | Split panel — search list left, scorecard + workbench right |
| Visual style | Clinical Clarity · Navy Dark (#0B2026 base, #FF3621 accents, white score hero, semantic green/amber/red) |

---

## 1. Architecture

```
FDR CSV
  └─▶ notebooks/00_setup.py ──────▶ facilities_raw (Delta)
  └─▶ notebooks/01_trust_extraction.py ▶ facilities_trust_signals (Delta)
                                               │
                                    Lakebase Synced Tables
                                               │
                               ┌───────────────▼──────────────┐
                               │   Lakebase Postgres           │
                               │   • facilities (synced RO)    │
                               │   • trust_signals (synced RO) │
                               │   • user_actions (app-owned)  │
                               └───────────────┬───────────────┘
                                               │
                               ┌───────────────▼──────────────┐
                               │  AppKit Databricks App        │
                               │  Hono API + React frontend    │
                               │  Split panel · Navy Dark UI   │
                               └──────────────────────────────┘
```

**Layer responsibilities:**

- **Delta Lake** — source of truth. Written by notebooks only, never by the app. `facilities_raw` is append-only; `facilities_trust_signals` is the LLM extraction output.
- **Lakebase Synced Tables** — one-way sync from Delta → Postgres. `facilities` and `trust_signals` are read-only replicas in the app's query layer.
- **Lakebase Postgres** — app's single query target. Synced tables handle reads; `user_actions` is written directly by the app (append-only, latest-wins at read time).
- **AppKit** — TypeScript/React frontend with Hono backend. All data access through typed API routes querying Postgres via Drizzle ORM.
- **DABs (`databricks.yml`)** — declares Lakebase instance, synced table sync jobs, pipeline workflow, and Databricks App deployment as one deployable bundle.

---

## 2. Project Structure

```
facilityiq/
├── databricks.yml                    # DABs bundle
├── pyproject.toml                    # Python deps (notebooks only)
├── notebooks/
│   ├── 00_setup.py                   # Create Delta tables, load CSV
│   ├── 01_trust_extraction.py        # LLM batch pipeline (10k facilities)
│   └── 02_validate_signals.py        # Spot-check extraction quality
├── prompts/
│   └── trust_extraction.py           # Versioned prompt template
├── app/                              # AppKit project
│   ├── package.json
│   ├── app.yaml                      # Databricks App config
│   ├── src/
│   │   ├── server/
│   │   │   ├── index.ts              # Hono API server entry
│   │   │   ├── routes/
│   │   │   │   ├── facilities.ts     # GET /facilities (search + paginated list)
│   │   │   │   ├── facility.ts       # GET /facilities/:id (detail + trust signals)
│   │   │   │   └── actions.ts        # GET/POST /facilities/:id/actions
│   │   │   └── db/
│   │   │       ├── client.ts         # Lakebase Postgres connection
│   │   │       └── schema.ts         # Drizzle ORM schema (all 3 tables)
│   │   └── client/
│   │       ├── main.tsx              # React entry point
│   │       ├── App.tsx               # Split-panel layout shell
│   │       ├── components/
│   │       │   ├── SearchPanel.tsx   # Left: search bar + filters + paginated list
│   │       │   ├── FacilityCard.tsx  # Row item in the list
│   │       │   ├── ScoreCard.tsx     # Right: facility header + overall score
│   │       │   ├── TrustDimension.tsx # Expandable dimension with evidence panel
│   │       │   ├── ContradictionAlert.tsx
│   │       │   ├── UncertaintyBadge.tsx
│   │       │   └── Workbench.tsx     # Notes, overrides, shortlist, flags
│   │       └── lib/
│   │           └── api.ts            # Typed fetch wrappers
│   └── db/
│       └── migrations/               # Drizzle migration files
└── docs/
    ├── PRD.md
    ├── TDD.md
    └── superpowers/specs/
        └── 2026-06-15-facilityiq-design.md  # This file
```

---

## 3. Lakebase Schema (Drizzle)

### `facilities` — synced from `facilities_raw` (read-only)

```ts
export const facilities = pgTable('facilities', {
  facility_id:      text('facility_id').primaryKey(),
  facility_name:    text('facility_name').notNull(),
  facility_type:    text('facility_type'),
  state:            text('state'),
  district:         text('district'),
  description:      text('description'),
  capability:       text('capability'),
  procedure:        text('procedure'),
  equipment:        text('equipment'),
  capacity:         integer('capacity'),
  year_established: integer('year_established'),
  latitude:         real('latitude'),
  longitude:        real('longitude'),
})
```

### `trust_signals` — synced from `facilities_trust_signals` (read-only)

```ts
export const trust_signals = pgTable('trust_signals', {
  id:                   serial('id').primaryKey(),
  facility_id:          text('facility_id').notNull(),
  dimension:            text('dimension').notNull(),       // capability | equipment | procedure | completeness
  trust_score:          real('trust_score'),               // null = insufficient data
  confidence_tier:      text('confidence_tier').notNull(), // high | medium | low | insufficient_data
  evidence_text:        text('evidence_text'),
  source_field:         text('source_field'),
  contradiction:        boolean('contradiction').default(false),
  contradiction_detail: text('contradiction_detail'),
  extraction_model:     text('extraction_model').notNull(),
  extracted_at:         timestamp('extracted_at').notNull(),
})
```

### `user_actions` — app-owned, written directly

```ts
export const user_actions = pgTable('user_actions', {
  action_id:      text('action_id').primaryKey(),          // UUID
  facility_id:    text('facility_id').notNull(),
  analyst_id:     text('analyst_id').notNull(),            // session UUID for hackathon
  action_type:    text('action_type').notNull(),           // note | override | shortlist | flag
  dimension:      text('dimension'),                       // null for notes/flags
  content:        text('content'),
  override_score: real('override_score'),
  created_at:     timestamp('created_at').defaultNow(),
  updated_at:     timestamp('updated_at').defaultNow(),
})
```

**Effective state** for analyst actions: latest row per `(facility_id, analyst_id, action_type, dimension)` ordered by `updated_at` DESC. Append-only in the database; resolved at read time.

**Search** uses Postgres `ILIKE` across `facility_name`, `description`, `capability`, and `state`. No pgvector needed at 10k rows.

---

## 4. API Routes

| Method | Route | Description |
|---|---|---|
| GET | `/api/facilities` | Search + paginated list. Query params: `q`, `state`, `type`, `min_score`, `contradictions_only`, `page`, `limit` |
| GET | `/api/facilities/:id` | Full facility detail with trust signals. No analyst_id needed — returns raw facility + signal data. |
| GET | `/api/facilities/:id/actions?analyst_id=<uuid>` | Analyst actions for a facility, filtered to the calling analyst's session. Latest-wins resolved. |
| POST | `/api/facilities/:id/actions` | Append a new analyst action. Body includes `analyst_id`, `action_type`, `content`, optional `dimension` + `override_score`. |

**`analyst_id` flow:** On first load, the React client generates a UUID and stores it in `localStorage`. All subsequent requests that involve analyst actions include this UUID. No auth required for the hackathon — single-analyst assumption.

---

## 5. UI Design

### Layout

Split panel with persistent navy dark theme:

- **Left panel** (~360px fixed): search bar → filter row (state, type, min trust, contradictions-only toggle) → results count → scrollable facility list → pagination
- **Right panel** (flex): facility header with large white score number → contradiction alert (if present) → expandable trust dimension cards → analyst workbench

### Visual Style — Clinical Clarity · Navy Dark

| Token | Value | Usage |
|---|---|---|
| Background | `#0B2026` | Right panel, default surface |
| Sidebar background | `#061013` | Left panel, darker than content |
| Top bar | `#081519` | App header |
| Border | `rgba(255,255,255,0.06)` | Dividers, card borders |
| Primary accent | `#FF3621` | Logo bar, selected item indicator, contradiction alerts, CTA buttons |
| Score hero | `white` | Large trust score number |
| Trust HIGH | `#4ade80` | Score label, bar fill, badge |
| Trust MEDIUM | `#fbbf24` | Score label, bar fill, badge |
| Trust LOW | `#f87171` | Score label, bar fill, badge |
| Insufficient Data | `rgba(251,191,36,0.15)` bg + `#fbbf24` text | Suppressed score badge |
| Evidence panel | `rgba(255,255,255,0.04)` bg + `rgba(255,255,255,0.12)` left border | Quoted source text |
| Body text | `white` / `rgba(255,255,255,0.55)` / `rgba(255,255,255,0.30)` | Three-level text hierarchy |
| Labels | `rgba(255,255,255,0.30)`, uppercase, tracked | Dimension names, field labels |

### Key Components

**`FacilityCard`** — list item in left panel. Shows facility name, state/type, overall trust score (color-coded), and inline badges for shortlisted/flagged/contradiction states.

**`ScoreCard`** — right panel header. Facility name + metadata, large white score number (`font-size: 2rem, font-weight: 800`), confidence label in semantic color.

**`TrustDimension`** — collapsible card per dimension. Header row: dimension name + score + progress bar. Expanded state reveals evidence quote panel (source field labeled) and contradiction detail if present.

**`ContradictionAlert`** — appears between score header and dimensions when `contradiction = true`. Red-tinted banner showing structured field value vs. free-text quote, severity level, and recommendation text.

**`UncertaintyBadge`** — replaces score bar for `confidence_tier = 'insufficient_data'`. Amber badge + explanation text. Never shows a numeric score.

**`Workbench`** — 2×2 grid at bottom of right panel. Dark header bar "ANALYST WORKBENCH". Four cells: Notes (free text), Override Score (dimension selector + score input + reason), Shortlist (named list selector), Flag (toggle with timestamp).

---

## 6. LLM Pipeline

Single LLM call per facility extracts all four trust dimensions in one JSON response. No separate dimension passes.

**Model:** `databricks-meta-llama-3-1-70b-instruct`, `temperature=0.0`  
**Fallback:** `databricks-dbrx-instruct` if rate-limited  
**Output:** One row per `(facility_id, dimension)` written to `facilities_trust_signals`

**Coverage guard** — `capacity` (25%) and `year_established` (48%) always produce `confidence_tier: "insufficient_data"` and `trust_score: null`. Never scored.

**Evidence grounding** — `evidence_text` must be an exact quote from source fields. LLM must return `insufficient_data` rather than infer from absence.

**Error handling** — malformed JSON written to `extraction_errors` table; pipeline continues. Failed facilities can be retried.

**Rate limit strategy** — process top 2,000 by data completeness first, then remaining 8,000. Batch of 50 per API call with exponential backoff.

---

## 7. DABs Configuration (`databricks.yml`)

```yaml
bundle:
  name: facilityiq

targets:
  dev:
    mode: development
    default: true
  prod:
    mode: production

resources:
  apps:
    facilityiq_app:
      name: facilityiq
      source_code_path: ./app

  jobs:
    trust_extraction_pipeline:
      name: FacilityIQ Trust Extraction Pipeline
      tasks:
        - task_key: setup
          notebook_task:
            notebook_path: ./notebooks/00_setup.py
        - task_key: extract
          depends_on: [setup]
          notebook_task:
            notebook_path: ./notebooks/01_trust_extraction.py
        - task_key: validate
          depends_on: [extract]
          notebook_task:
            notebook_path: ./notebooks/02_validate_signals.py
```

Lakebase instance and Synced Tables sync configuration added after provisioning (host/endpoint values known only after `databricks lakebase create`).

---

## 8. Implementation Phases

| Phase | Scope | Target |
|---|---|---|
| **P0 — Foundation** | DABs scaffold, AppKit init, Lakebase provision, Delta tables created, CSV loaded | Night June 15 |
| **P1 — Pipeline** | LLM extraction notebook across 10k facilities, trust signals written to Delta | Night June 15 |
| **P2 — Sync** | Lakebase Synced Tables configured, Postgres populated, API routes wired | Morning June 16 |
| **P3 — App Core** | Search + list panel, scorecard with evidence, contradiction alert, uncertainty badge | Morning June 16 |
| **P4 — Workbench** | Analyst actions (notes, overrides, shortlist, flags), persistence | Midday June 16 |
| **P5 — Polish** | Navy dark theme applied fully, demo flow rehearsed | Afternoon June 16 |
| **P6 — Submit** | Devpost write-up, repo cleanup, deployed app URL | By 3:00 PM June 16 |
