# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Context

FacilityIQ is a Databricks hackathon project (Databricks Data + AI Summit 2026, June 15–16) that processes a 10,000-record India healthcare facility dataset through an LLM trust-extraction pipeline, then exposes a Streamlit analyst interface. The repo is early-stage — most files under `app/`, `notebooks/`, and `prompts/` are stubs to be implemented.

## Development Environment

Python 3.12. Dependencies are managed with `uv` via `pyproject.toml`. The app runs on Databricks Apps (Streamlit) and the pipeline runs as a Databricks Workflow.

```bash
uv sync           # install dependencies
uv run python app/main.py   # run locally (limited without Databricks cluster)
```

There are no tests yet. Notebooks are designed to run inside Databricks, not locally — `spark` and Delta Lake APIs require a cluster context.

## Architecture

### Data Flow

```
FDR CSV → facilities_raw (Delta) → LLM extraction pipeline → facilities_trust_signals (Delta)
                                                                          ↕
                                                             Streamlit App (Databricks Apps)
                                                                          ↕
                                                          facilities_user_actions (Delta)
```

### Delta Tables

Three tables in Unity Catalog:

- **`facilities_raw`** — append-only source, all 51 FDR columns preserved. Never mutated.
- **`facilities_trust_signals`** — LLM extraction output, one row per `(facility_id, dimension)`, partitioned by `dimension`. Dimensions: `capability`, `equipment`, `procedure`, `completeness`.
- **`facilities_user_actions`** — append-only analyst action log (`note | override | shortlist | flag`). Effective state = latest row per `(facility_id, analyst_id, action_type, dimension)` by `updated_at`.

### LLM Pipeline (`notebooks/01_trust_extraction.py`)

Single LLM call per facility extracts all four trust dimensions in one JSON response. Model: `databricks-meta-llama-3-1-70b-instruct`, `temperature=0.0`. Prompt lives in `prompts/trust_extraction.py`.

Two critical rules the pipeline enforces:
1. **Coverage guard** — `capacity` (25% coverage) and `year_established` (48%) always produce `confidence_tier: "insufficient_data"` and `trust_score: null`. Never score low-coverage fields.
2. **Evidence grounding** — `evidence_text` must be an exact quote from source fields; the LLM must return `insufficient_data` rather than infer.

### App Structure (`app/`)

```
app/
├── main.py                   # Streamlit entry point
├── components/               # UI panels (search, scorecard, workbench, uncertainty badge)
├── services/                 # Data access (facility_service, trust_service, action_service)
└── utils/                    # delta_client.py (connection helpers), session.py (state)
```

Services query Delta via `spark.sql()`. The search query in `facility_service.py` joins `facilities_raw` with `facilities_trust_signals` and takes an `AVG(trust_score)` as the overall score. Analyst actions use append-only writes via `action_df.write.format("delta").mode("append").saveAsTable(...)`.

## Key Design Decisions

- **Single LLM pass per facility** — extracts all dimensions in one call (4x fewer API calls, enables cross-dimension contradiction detection in one context window).
- **Score suppression over low-confidence scores** — an "Insufficient Data" badge is more honest than a low number that implies the field was assessed.
- **Append-only action log** — provides full audit trail; Delta time travel makes this free. Latest-wins resolution at read time.
- **Streamlit over Gradio** — Streamlit's component model fits the multi-panel analyst workbench better than Gradio's model I/O paradigm.

## Notebook Execution Order

Run notebooks in sequence on a Databricks cluster:

1. `00_setup.py` — creates Delta tables, loads raw CSV, validates schema
2. `01_trust_extraction.py` — runs LLM batch pipeline over all facilities
3. `02_validate_signals.py` — spot-checks extraction quality

If `01_trust_extraction.py` hits rate limits, process top 2,000 records first and fall back to DBRX Instruct if Llama 3.1 70B is unavailable.
