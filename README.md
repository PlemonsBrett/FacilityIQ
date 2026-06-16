# FacilityIQ

> **Databricks Data + AI Summit 2026 Hackathon — Track 1: Facility Trust Desk**

FacilityIQ helps non-technical healthcare planners evaluate the trustworthiness of facility claims across 10,000 India healthcare records — grounding every score in cited evidence and surfacing uncertainty honestly.

---

## The Problem

The Virtue Foundation's **VF Match** platform already does facility discovery well — mapping facilities, surfacing medical deserts, connecting volunteers to underserved regions. What it doesn't have is **trust**.

India's healthcare facility dataset is messy: structured fields conflict with free text, capacity data exists for only 25% of facilities, and claimed capabilities can't be verified at face value. Planners making referral and resource decisions can't tell if a facility actually does what it claims.

**FacilityIQ is the trust layer VF Match is missing for India.**

> *"VF Match shows you facilities. FacilityIQ tells you whether to trust them."*

---

## What It Does

- **Trust Scoring** — per-facility scores across capability, equipment, and procedure dimensions
- **Evidence Citations** — every score traces back to the exact sentence in the source text
- **Uncertainty Badges** — low-coverage fields (capacity, year established) are flagged honestly, never scored
- **Contradiction Detection** — flags where structured fields directly conflict with free text
- **Analyst Workbench** — notes, overrides, shortlists, and flags that persist across sessions via Delta Lake

---

## Demo Flow

1. Open FacilityIQ → search "dialysis, Maharashtra"
2. See ranked trust scores with contradiction indicators
3. Drill into a facility → view Trust Scorecard with cited evidence
4. Spot a contradiction alert → flag for review
5. Add a note → close the app → reopen → note is still there

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Platform | Databricks Free Edition |
| App Framework | TypeScript/React + Node.js/Express (Databricks Apps via AppKit) |
| Storage | Delta Lake (Unity Catalog) + Lakebase Postgres |
| LLM | Databricks Foundation Model APIs (Llama 3.3 70B) |
| Orchestration | Databricks Workflows |

---

## Local Development

The project has two independent development environments: the Python pipeline (notebooks) and the TypeScript app.

**Pipeline (Python 3.12):** Dependencies managed with [uv](https://docs.astral.sh/uv/).

```bash
# Install uv (if not already installed)
curl -LsSf https://astral.sh/uv/install.sh | sh

# Install dependencies
uv sync
```

> Notebooks run inside Databricks — `spark` and Delta Lake APIs require a cluster context. Local Python is only for editing and linting.

**App (TypeScript/Node.js):** Located in `app/`.

```bash
cd app
npm install
npm run dev     # local dev server (proxies Lakebase via .env)
npm run build   # build client dist for deployment
```

> The app connects to Lakebase Postgres. Copy `.env.example` to `.env` and fill in your Databricks credentials before running `npm run dev`.

---

## Docs

- [Product Requirements Document](docs/PRD.md)
- [Technical Design Document](docs/TDD.md)
- [Backend Integration Guide](docs/BACKEND_INTEGRATION.md)
- [Data Validation Checks](docs/Data_Validation_Checks.md)

Data quality scoring queries live in [`sql/data_quality`](sql/data_quality/).

---

## Repository Structure

```
facilityiq/
├── docs/
│   ├── PRD.md                    # Product requirements
│   ├── TDD.md                    # Technical design
│   └── BACKEND_INTEGRATION.md   # Lakebase integration guide
├── notebooks/
│   ├── 00_setup.py               # Delta table setup, raw data load
│   ├── 01_trust_extraction.py    # LLM batch pipeline
│   └── 02_validate_signals.py    # Extraction quality checks
├── app/
│   ├── server/server.ts          # Node.js/Express backend (AppKit), all API routes
│   ├── client/src/               # React/Vite frontend
│   │   ├── App.tsx               # Root, routing
│   │   ├── pages/                # DashboardPage, KanbanPage
│   │   ├── components/           # FacilityCard, GuidedAnalysis, SearchPanel, SplashScreen, Sidebar
│   │   └── lib/api.ts            # All fetch calls to /api/*
│   ├── databricks.yml            # App bundle
│   └── app.yaml                  # Databricks App manifest
├── prompts/
│   ├── trust_extraction.py       # LLM prompt template
│   ├── trust_signals_writer.py   # Trust signals schema/writer
│   ├── quality_score.py          # Quality scoring logic
│   └── email_outreach.py         # Outreach metadata extraction
├── sql/
│   └── data_quality/             # Analytical data quality queries
└── pyproject.toml                # Pipeline dependencies (managed with uv)
```

Notebooks run on a Databricks cluster in order: `00_setup.py` → `01_trust_extraction.py` → `02_validate_signals.py`.

---

## Team

Built at Databricks Data + AI Summit 2026 Hackathon — June 15–16, 2026.
