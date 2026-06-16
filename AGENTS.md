# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Context

FacilityIQ is a Databricks hackathon project (Databricks Data + AI Summit 2026, June 15–16) that processes a 10,000-record India healthcare facility dataset through an LLM trust-extraction pipeline, then exposes a TypeScript/AppKit analyst interface on Databricks Apps.

## Development Environment

**Pipeline (Python 3.12):** Dependencies managed with `uv` via `pyproject.toml`. Notebooks run inside Databricks — `spark` and Delta Lake APIs require a cluster context.

**App (TypeScript/Node.js):** Located in `app/`. Uses `@databricks/appkit` for the backend and React/Vite for the frontend.

```bash
# Pipeline
uv sync

# App (from app/)
npm install
npm run dev     # local dev server (proxies Lakebase via .env)
npm run build   # build client dist
```

## Architecture

### Data Flow

```
FDR CSV → facilities_raw (Delta) → LLM extraction pipeline → UC Delta tables
                                                                     ↓
                                                         Copy to Lakebase (Postgres public.*)
                                                                     ↓
                                                  TypeScript/AppKit App (Databricks Apps)
                                                                     ↕
                                                    Lakebase Postgres (facilityiq.* schema)
```

### Unity Catalog Delta Tables (pipeline output — read-only by app)

- **`workspace.facilityiq.facilities_raw`** — append-only source, all 51 FDR columns preserved. Never mutated.
- **`workspace.facilityiq.facilities_silver`** — typed and cleaned, one row per facility.
- **`workspace.facilityiq.facilities_gold`** — silver + latest analyst overrides merged in.
- **`workspace.facilityiq.facilities_trust_signals`** — LLM extraction output, one row per `(facility_id, dimension)`. Dimensions: `capability`, `equipment`, `procedure`, `completeness`.
- **`workspace.facilityiq.facilities_quality_scores`** — deterministic, SQL-driven quality scores.
- **`workspace.facilityiq.facilities_email_outreach`** — keyed by email for outreach campaigns.

### Lakebase Postgres Tables (app read/write)

The TypeScript app connects exclusively to Lakebase Postgres via `appkit.lakebase.query()`. Two schemas:

**`public.*` (copied from UC Delta — read by app):**
- `public.facilities` — facility data (from facilities_gold or silver)
- `public.trust_signals` — trust signal scores (from facilities_trust_signals)

**`facilityiq.*` (created and owned by app on startup):**
- `facilityiq.user_actions` — analyst actions (`note | override | shortlist | flag`)
- `facilityiq.facility_review` — kanban review status per facility
- `facilityiq.facilities_overrides` — field-level overrides (joined into facilities_gold)

### LLM Pipeline (`notebooks/01_trust_extraction.py`)

Single LLM call per facility extracts all four trust dimensions in one JSON response. Model: `databricks-meta-llama-3-3-70b-instruct`, `temperature=0.0`. Falls back to `databricks-meta-llama-3-1-8b-instruct` on rate limits. Prompt lives in `prompts/trust_extraction.py`.

Two critical rules the pipeline enforces:
1. **Coverage guard** — `capacity` (25% coverage) and `year_established` (48%) always produce `confidence_tier: "insufficient_data"` and `trust_score: null`. Never score low-coverage fields.
2. **Evidence grounding** — `evidence_text` must be an exact quote from source fields; the LLM must return `insufficient_data` rather than infer.

### App Structure (`app/`)

```
app/
├── server/server.ts          # Node.js/Express backend (AppKit), all API routes
├── client/src/               # React/Vite frontend
│   ├── App.tsx               # Root, routing
│   ├── ErrorBoundary.tsx     # Top-level error boundary
│   ├── pages/                # DashboardPage, KanbanPage, LakebasePage
│   ├── components/           # FacilityCard, GuidedAnalysis, SearchPanel, SplashScreen, Workbench, Sidebar
│   ├── lib/api.ts            # All fetch calls to /api/* (falls back to dummy data)
│   └── lib/analyst.ts        # Persistent analyst UUID (localStorage)
├── databricks.yml            # App bundle (separate from root pipeline bundle)
└── app.yaml                  # Databricks App manifest
```

The server uses `appkit.lakebase.query()` for all reads and writes — no Spark, no SQL warehouse. The client gracefully falls back to bundled dummy data when the DB is unreachable.

## Key Design Decisions

- **Single LLM pass per facility** — extracts all dimensions in one call (4x fewer API calls, enables cross-dimension contradiction detection in one context window).
- **Score suppression over low-confidence scores** — an "Insufficient Data" badge is more honest than a low number that implies the field was assessed.
- **Lakebase Postgres for app reads/writes** — always-on, sub-100ms latency vs. Spark cold starts. UC Delta tables are copied into Lakebase `public.*` for the app to query.
- **UC Delta for pipeline output** — pipeline writes to Delta (durable, time-travel, medallion SQL); app never touches Delta directly.
- **TypeScript/AppKit over Streamlit** — AppKit gives full React control for the analyst workbench UI without Python's constraint on interactivity.

## Notebook Execution Order

Run notebooks in sequence on a Databricks cluster:

1. `00_setup.py` — creates Delta tables, loads raw CSV, validates schema
2. `01_trust_extraction.py` — runs LLM batch pipeline over all facilities
3. `02_validate_signals.py` — spot-checks extraction quality

If `01_trust_extraction.py` hits rate limits, process top 2,000 records first. The pipeline automatically falls back to `databricks-meta-llama-3-1-8b-instruct` on rate-limit errors.
